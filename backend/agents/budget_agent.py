"""
Budget agent — validates cost against budget caps in the solver's
proposed schedule. Defense-in-depth.
"""
from __future__ import annotations

import logging

from agents.state import GraphState
from agents.utils import write_trace, Timer
from tools.budget_tools import (
    BudgetCapInput,
    ScheduleCostInput,
    calc_schedule_cost,
    check_budget_cap,
)

logger = logging.getLogger(__name__)


def budget_agent(state: GraphState) -> GraphState:
    """
    Calculate the actual cost of the proposed schedule and validate
    it against the project budget and sub-caps.

    Adds violations/warnings to state and updates state["total_cost"].
    """
    schedule = state.get("current_schedule")
    if not schedule or not schedule.feasible:
        return {**state, "budget_violations": [], "budget_warnings": [], "total_cost": 0.0}

    scenes    = state.get("scenes", [])
    cast      = state.get("cast", [])
    locations = state.get("locations", [])
    equipment = state.get("equipment", [])
    budget    = state.get("budget")
    entries   = schedule.schedule

    with Timer() as t:
        cost_result = calc_schedule_cost(ScheduleCostInput(
            scenes=scenes,
            cast=cast,
            locations=locations,
            equipment=equipment,
            schedule=entries,
        ))

        budget_result = check_budget_cap(BudgetCapInput(cost_result=cost_result, budget=budget))

    logger.info(
        "budget_agent: total=%.2f, cast=%.2f, location=%.2f, equip=%.2f | violations=%d",
        cost_result.total_cost,
        cost_result.cast_cost,
        cost_result.location_cost,
        cost_result.equipment_cost,
        len(budget_result.violations),
    )

    if state.get("project_id") and state.get("run_id"):
        output_summary = f"Total Cost: ${cost_result.total_cost:,.2f}. Found {len(budget_result.violations)} violations."
        if budget_result.warnings:
            output_summary += f" ({len(budget_result.warnings)} warnings)"
        
        write_trace(
            project_id=state["project_id"],
            run_id=state["run_id"],
            agent_name="Budget Validator",
            input_summary="Calculating total schedule cost and comparing against budget limits.",
            output_summary=output_summary,
            tool_calls=[{"tool": "calc_schedule_cost", "args": {}}, {"tool": "check_budget_cap", "args": {}}],
            duration_ms=t.duration_ms,
            confidence="high"
        )

    return {
        **state,
        "total_cost":       cost_result.total_cost,
        "budget_violations":budget_result.violations,
        "budget_warnings":  budget_result.warnings,
    }
