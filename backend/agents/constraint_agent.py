"""
Constraint agent — validates equipment capacity and double-booking
in the solver's proposed schedule. Defense-in-depth.
"""
from __future__ import annotations

import logging
from typing import List

from agents.state import GraphState
from tools.conflict_tools import (
    DoubleBookingInput,
    EquipmentConflictInput,
    check_double_booking,
    check_equipment_conflict,
)

logger = logging.getLogger(__name__)


def constraint_agent(state: GraphState) -> GraphState:
    """
    Re-validate equipment and double-booking constraints against
    the current schedule output from the solver.

    Adds violations to state["conflict_violations"].
    """
    schedule = state.get("current_schedule")
    if not schedule or not schedule.feasible:
        return {**state, "conflict_violations": []}

    scenes    = state.get("scenes", [])
    equipment = state.get("equipment", [])
    entries   = schedule.schedule

    # Double-booking check (actors + location consolidation warnings)
    db_result = check_double_booking(DoubleBookingInput(scenes=scenes, schedule=entries))

    # Equipment conflict check
    eq_result = check_equipment_conflict(EquipmentConflictInput(
        scenes=scenes,
        equipment=equipment,
        schedule=entries,
    ))

    violations = db_result.violations + eq_result.violations
    logger.info("constraint_agent: %d violations", len(violations))
    return {**state, "conflict_violations": violations}
