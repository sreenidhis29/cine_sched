"""
Scheduler agent — calls the CP-SAT solver via the solver_tool.
Never computes a schedule itself; always delegates to the solver.
"""
from __future__ import annotations

import logging

from agents.state import GraphState
from agents.utils import write_trace, Timer
from tools.solver_tool import RunSolverInput, run_solver

logger = logging.getLogger(__name__)


def scheduler_agent(state: GraphState) -> GraphState:
    """
    Invoke the CP-SAT solver with the current project data and any
    relaxed constraints decided by the critic agent in prior iterations.
    """
    inp = RunSolverInput(
        scenes=state.get("scenes", []),
        cast=state.get("cast", []),
        locations=state.get("locations", []),
        equipment=state.get("equipment", []),
        budget=state.get("budget"),
        relaxed_constraints=state.get("relaxed_constraints", []),
        start_date=state.get("start_date"),
        preferred_location_order=state.get("preferred_location_order"),
        preferred_shoot_dates=state.get("preferred_shoot_dates"),
    )

    logger.info(
        "scheduler_agent: iteration %d, relaxed=%s",
        state.get("iteration_count", 0),
        state.get("relaxed_constraints", [])
    )

    with Timer() as t:
        result = run_solver(inp)
    
    logger.info(
        "scheduler_agent result: feasible=%s, cost=%.2f, days=%d, violations=%s",
        result.feasible, result.total_cost, result.num_shoot_days, result.violations
    )

    if state.get("project_id") and state.get("run_id"):
        write_trace(
            project_id=state["project_id"],
            run_id=state["run_id"],
            agent_name="CP-SAT Scheduler",
            input_summary=f"Running CP-SAT solver with {len(inp.relaxed_constraints)} relaxed constraints.",
            output_summary=f"Computed schedule in {t.duration_ms}ms. Feasible: {result.feasible}, Total Cost: ${result.total_cost:,.2f}, Violations: {len(result.violations)}",
            tool_calls=[{"tool": "run_solver", "args": {"relaxed_constraints": inp.relaxed_constraints}}],
            duration_ms=t.duration_ms,
            confidence="high" if result.feasible else "medium"
        )

    return {
        **state,
        "current_schedule": result,
        "violations":       result.violations if not result.feasible else [],
    }
