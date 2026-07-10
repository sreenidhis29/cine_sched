"""
Critic agent — the decision maker in the replan loop.

Logic:
1. Collect all violations from availability, conflict, and budget agents.
2. If no violations → set accepted=True, route to explainer.
3. If violations exist AND iteration_count < MAX_ITERATIONS (4):
   - Use the LLM router to decide which constraint to relax.
   - Update relaxed_constraints in state.
   - Increment iteration_count.
   - Route back to scheduler_agent (handled by graph conditional edge).
4. If at the cap → accepted=False, set reject_reason with a clear message.
"""
from __future__ import annotations

import json
import logging
from typing import List

from pydantic import BaseModel

from agents.state import GraphState
from agents.utils import write_trace, read_agent_memory, write_agent_memory, Timer
from llm.router import LLMRouterError, structured_call

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 4


class RelaxationDecision(BaseModel):
    """Structured output expected from the critic LLM call."""
    rationale: str
    constraint_to_relax: str       # e.g. "actor_availability:<id>" or "budget" or "location_availability:<id>"
    relaxation_description: str    # human-readable explanation of what was relaxed


CRITIC_SYSTEM_PROMPT = """
You are the critic agent for a film production scheduling system.
Your job is to decide which constraint to relax so that the CP-SAT scheduling solver
can find a feasible schedule.

Rules:
- You may NEVER relax a constraint that the user has already relaxed in this run.
- Always prefer relaxing actor availability over location availability.
- Only relax budget as a last resort.
- Your constraint_to_relax MUST be one of these formats:
  - "actor_availability:<cast_member_id>"   (relax that actor's availability window)
  - "location_availability:<location_id>"   (relax that location's availability window)
  - "budget"                                (allow going over budget)
- Respond with ONLY valid JSON. No markdown. No commentary.
"""


def critic_agent(state: GraphState) -> GraphState:
    """
    Aggregate violations, decide whether to accept or replan, and
    optionally choose a constraint relaxation via the LLM router.
    """
    with Timer() as t:
        # ── Collect all violations ─────────────────────────────────────────────
        all_violations: List[str] = []

    solver_infeasible = (
        state.get("current_schedule") is None
        or not state.get("current_schedule").feasible
    )
    if solver_infeasible:
        all_violations.extend(state.get("violations", []))

    all_violations.extend(state.get("availability_violations", []))
    all_violations.extend(state.get("conflict_violations", []))
    all_violations.extend(state.get("budget_violations", []))

    iteration = state.get("iteration_count", 0)

    logger.info(
        "critic_agent: iteration=%d, violations=%d, solver_feasible=%s",
        iteration, len(all_violations), not solver_infeasible
    )

    # ── No violations → accept ─────────────────────────────────────────────
    if not all_violations:
        logger.info("critic_agent: no violations — accepting schedule")
        return {
            **state,
            "accepted": True,
            "violations": [],
            "reject_reason": None,
        }

    # ── Cap reached → reject ───────────────────────────────────────────────
    if iteration >= MAX_ITERATIONS:
        reason = (
            f"Schedule could not be made feasible after {MAX_ITERATIONS} attempts. "
            f"Remaining violations:\n"
            + "\n".join(f"  • {v}" for v in all_violations)
        )
        logger.warning("critic_agent: cap reached — rejecting. %s", reason)
        
        if state.get("project_id") and state.get("run_id"):
            write_trace(
                project_id=state["project_id"],
                run_id=state["run_id"],
                agent_name="Critic Agent",
                input_summary=f"Iteration {iteration}/{MAX_ITERATIONS}. Found {len(all_violations)} violations.",
                output_summary=f"Max iterations reached. Giving up.",
                tool_calls=[],
                duration_ms=t.duration_ms,
                confidence="low"
            )

        return {
            **state,
            "accepted": False,
            "reject_reason": reason,
            "violations": all_violations,
        }

    # ── Ask LLM which constraint to relax ─────────────────────────────────
    already_relaxed = state.get("relaxed_constraints", [])
    scenes    = state.get("scenes", [])
    cast      = state.get("cast", [])
    locations = state.get("locations", [])

    cast_info = "\n".join(
        f"  cast_id={c.id}, name={c.name}, avail={c.availability_start}–{c.availability_end}"
        for c in cast
    )
    loc_info = "\n".join(
        f"  location_id={l.id}, name={l.name}, avail={l.availability_start}–{l.availability_end}"
        for l in locations
    )

    project_id = state.get("project_id")
    past_memory = read_agent_memory(project_id) if project_id else []
    memory_info = json.dumps(past_memory, indent=2) if past_memory else "No past decisions available."

    user_message = f"""
Current violations (iteration {iteration + 1}):
{chr(10).join(f'  - {v}' for v in all_violations)}

Already relaxed constraints (do NOT re-relax these):
{already_relaxed if already_relaxed else '  (none yet)'}

Available cast members:
{cast_info}

Available locations:
{loc_info}

Past decisions memory (use this context to avoid repeating bad relaxations across runs):
{memory_info}

Choose exactly ONE constraint to relax to make the schedule feasible.
"""

    try:
        decision: RelaxationDecision = structured_call(
            messages=[{"role": "user", "content": user_message}],
            system_prompt=CRITIC_SYSTEM_PROMPT,
            schema=RelaxationDecision,
        )
        new_relaxation = decision.constraint_to_relax
        logger.info(
            "critic_agent: relaxing '%s' — %s",
            new_relaxation, decision.rationale
        )
        new_relaxed = list(set(already_relaxed + [new_relaxation]))
        
        if state.get("project_id"):
            write_agent_memory(
                project_id=state["project_id"],
                decision_type="constraint_relaxation",
                context={"violations": all_violations, "iteration": iteration},
                outcome=new_relaxation
            )

        if state.get("project_id") and state.get("run_id"):
            write_trace(
                project_id=state["project_id"],
                run_id=state["run_id"],
                agent_name="Critic Agent",
                input_summary=f"Iteration {iteration+1}. Violations: {len(all_violations)}. Past memory: {len(past_memory)} entries.",
                output_summary=f"Decided to relax: {new_relaxation}. Rationale: {decision.rationale}",
                tool_calls=[{"tool": "structured_call", "args": {"schema": "RelaxationDecision"}}],
                duration_ms=t.duration_ms,
                confidence="medium"
            )

        return {
            **state,
            "relaxed_constraints": new_relaxed,
            "iteration_count": iteration + 1,
            "violations": all_violations,
            "accepted": False,
        }
    except LLMRouterError as e:
        logger.error("critic_agent: LLM failed, cannot choose relaxation: %s", e)
        
        if state.get("project_id") and state.get("run_id"):
            write_trace(
                project_id=state["project_id"],
                run_id=state["run_id"],
                agent_name="Critic Agent",
                input_summary=f"Attempting to decide relaxation via LLM.",
                output_summary=f"LLM Error: {e}",
                tool_calls=[],
                duration_ms=t.duration_ms,
                confidence="low"
            )

        return {
            **state,
            "accepted": False,
            "reject_reason": f"LLM unavailable for constraint relaxation: {e}",
            "violations": all_violations,
        }
