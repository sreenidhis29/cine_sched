"""
Scheduler agent — calls the CP-SAT solver via the solver_tool.
Never computes a schedule itself; always delegates to the solver.
"""
from __future__ import annotations

import logging

from agents.state import GraphState
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
    )

    logger.info(
        "scheduler_agent: iteration %d, relaxed=%s",
        state.get("iteration_count", 0),
        state.get("relaxed_constraints", [])
    )

    result = run_solver(inp)
    logger.info(
        "scheduler_agent result: feasible=%s, cost=%.2f, days=%d, violations=%s",
        result.feasible, result.total_cost, result.num_shoot_days, result.violations
    )

    return {
        **state,
        "current_schedule": result,
        "violations":       result.violations if not result.feasible else [],
    }
