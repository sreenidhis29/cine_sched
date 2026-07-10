"""
Constraint agent — validates equipment capacity and double-booking
in the solver's proposed schedule. Defense-in-depth.
"""
from __future__ import annotations

import logging
from typing import List

from agents.state import GraphState
from agents.utils import write_trace, Timer
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

    with Timer() as t:
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

    if state.get("project_id") and state.get("run_id"):
        output_summary = f"Found {len(violations)} conflict/equipment violations." if violations else "No conflict or equipment violations found."
        write_trace(
            project_id=state["project_id"],
            run_id=state["run_id"],
            agent_name="Constraint Validator",
            input_summary="Checking for double bookings and equipment overallocation.",
            output_summary=output_summary,
            tool_calls=[{"tool": "check_double_booking", "args": {}}, {"tool": "check_equipment_conflict", "args": {}}],
            duration_ms=t.duration_ms,
            confidence="high" if not violations else "medium"
        )

    return {**state, "conflict_violations": violations}
