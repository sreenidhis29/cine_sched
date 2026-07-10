"""
Explainer agent — generates a natural-language summary of the final schedule.
Uses the LLM router (Groq primary, Gemini fallback).
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Dict, List

from agents.state import GraphState
from agents.utils import write_trace, Timer
from llm.router import LLMRouterError, chat

logger = logging.getLogger(__name__)

EXPLAINER_SYSTEM_PROMPT = """
You are a friendly and professional film production coordinator assistant.
Your job is to explain a proposed shooting schedule to a producer or director
in clear, natural language.

When describing the schedule:
- Summarize the total number of shoot days and the date range.
- Mention which scenes fall on which days (group by day).
- Highlight any constraints that were relaxed and explain WHY that tradeoff was made.
- Note the total cost vs the budget.
- Use encouraging, professional language — even if the schedule required compromises.
- Keep the explanation under 300 words.
"""


def explainer_agent(state: GraphState) -> GraphState:
    """
    Generate a natural-language explanation of the final accepted (or rejected) schedule.
    Always runs as the last node in the pipeline.
    """
    schedule = state.get("current_schedule")
    accepted = state.get("accepted", False)
    reject_reason = state.get("reject_reason")
    total_cost = state.get("total_cost", 0.0)
    budget = state.get("budget")
    relaxed = state.get("relaxed_constraints", [])
    scenes = state.get("scenes", [])
    cast   = state.get("cast", [])

    scene_map = {s.id: s for s in scenes}
    cast_map  = {c.id: c for c in cast}

    # ── Build schedule summary ────────────────────────────────────────────
    if schedule and schedule.feasible and schedule.schedule:
        day_scenes: Dict[int, List[str]] = defaultdict(list)
        for entry in schedule.schedule:
            sc = scene_map.get(entry.scene_id)
            day_scenes[entry.shoot_day].append(sc.title if sc else entry.scene_id)

        day_summary = "\n".join(
            f"  Day {d}: {', '.join(titles)}"
            for d, titles in sorted(day_scenes.items())
        )
        schedule_text = f"Schedule ({schedule.num_shoot_days} shoot days):\n{day_summary}"
    else:
        schedule_text = "No feasible schedule was found."

    # ── Build relaxation summary ───────────────────────────────────────────
    if relaxed:
        relax_lines = []
        for token in relaxed:
            if token.startswith("actor_availability:"):
                cid = token.split(":", 1)[1]
                cm = cast_map.get(cid)
                relax_lines.append(f"  - Relaxed availability window for {cm.name if cm else cid}")
            elif token.startswith("location_availability:"):
                lid = token.split(":", 1)[1]
                relax_lines.append(f"  - Relaxed availability window for location {lid}")
            elif token == "budget":
                relax_lines.append("  - Budget cap was relaxed to allow the schedule to proceed")
        relaxation_text = "Relaxations made:\n" + "\n".join(relax_lines)
    else:
        relaxation_text = "No constraints were relaxed — this is the optimal schedule within all original constraints."

    budget_text = (
        f"Total cost: ${total_cost:,.2f} / Budget: ${budget.total_limit:,.2f}"
        if budget else f"Total cost: ${total_cost:,.2f}"
    )

    if not accepted and reject_reason:
        prompt = (
            f"The scheduling pipeline was unable to find an acceptable schedule.\n\n"
            f"Reason: {reject_reason}\n\n"
            f"{schedule_text}\n\n"
            f"{relaxation_text}\n\n"
            f"{budget_text}\n\n"
            f"Please explain this situation sympathetically and suggest what the production "
            f"team might do next (e.g., negotiate cast availability, adjust budget, reduce scope)."
        )
    else:
        prompt = (
            f"The scheduling pipeline has found an accepted schedule.\n\n"
            f"{schedule_text}\n\n"
            f"{relaxation_text}\n\n"
            f"{budget_text}\n\n"
            f"Please provide a clear, encouraging explanation of this schedule for the producer."
        )

    with Timer() as t:
        try:
            explanation = chat(
                messages=[{"role": "user", "content": prompt}],
                system_prompt=EXPLAINER_SYSTEM_PROMPT,
                temperature=0.4,
                max_tokens=600,
            )
        except LLMRouterError as e:
            logger.error("explainer_agent: LLM failed: %s", e)
            explanation = (
                f"{'✅ Schedule accepted.' if accepted else '❌ Schedule could not be finalized.'}\n\n"
                f"{schedule_text}\n\n{relaxation_text}\n\n{budget_text}"
            )

    if state.get("project_id") and state.get("run_id"):
        write_trace(
            project_id=state["project_id"],
            run_id=state["run_id"],
            agent_name="Explainer Agent",
            input_summary="Generating a natural-language summary of the final schedule output.",
            output_summary=f"Generated explanation ({len(explanation)} chars).",
            tool_calls=[{"tool": "chat", "args": {}}],
            duration_ms=t.duration_ms,
            confidence="high"
        )

    return {**state, "final_explanation": explanation}
