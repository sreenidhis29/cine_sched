"""
Budget agent — validates cost against budget caps in the solver's
proposed schedule. Defense-in-depth.
"""
from __future__ import annotations

import logging

from agents.state import GraphState
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

    return {
        **state,
        "total_cost":       cost_result.total_cost,
        "budget_violations":budget_result.violations,
        "budget_warnings":  budget_result.warnings,
    }
