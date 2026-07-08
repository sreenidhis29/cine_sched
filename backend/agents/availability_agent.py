"""
Availability agent — validates actor and location availability windows
against the solver's proposed schedule. Defense-in-depth.
"""
from __future__ import annotations

import logging
from typing import List

from agents.state import GraphState
from tools.availability_tools import (
    ActorAvailabilityInput,
    LocationWindowInput,
    check_actor_availability,
    check_location_window,
)

logger = logging.getLogger(__name__)


def availability_agent(state: GraphState) -> GraphState:
    """
    Re-validate every actor and location availability constraint
    against the current schedule output from the solver.

    Adds any discovered violations to state["availability_violations"].
    """
    schedule = state.get("current_schedule")
    if not schedule or not schedule.feasible:
        # Nothing to validate if solver already said infeasible
        return {**state, "availability_violations": []}

    scenes    = state.get("scenes", [])
    cast      = state.get("cast", [])
    locations = state.get("locations", [])
    entries   = schedule.schedule
    start_date= state.get("start_date")
    relaxed   = state.get("relaxed_constraints", [])

    violations: List[str] = []

    # Check each cast member's availability
    for cm in cast:
        if f"actor_availability:{cm.id}" in relaxed:
            continue
        scenes_for_cm = [s for s in scenes if cm.id in s.cast_member_ids]
        result = check_actor_availability(ActorAvailabilityInput(
            cast_member=cm,
            scenes_for_cast=scenes_for_cm,
            schedule=entries,
            start_date=start_date,
        ))
        violations.extend(result.violations)

    # Check each location's availability
    for loc in locations:
        if f"location_availability:{loc.id}" in relaxed:
            continue
        scenes_at_loc = [s for s in scenes if s.location_id == loc.id]
        result = check_location_window(LocationWindowInput(
            location=loc,
            scenes_at_location=scenes_at_loc,
            schedule=entries,
            start_date=start_date,
        ))
        violations.extend(result.violations)

    logger.info("availability_agent: %d violations", len(violations))
    return {**state, "availability_violations": violations}
