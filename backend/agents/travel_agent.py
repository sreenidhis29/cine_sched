"""
Travel agent — Phase 4 advisory node in the LangGraph pipeline.

Checks driving time between consecutive shoot-day locations via OSRM.
Skips gracefully if locations lack coordinates or schedule is empty.
Produces soft advisory violations only — never triggers replanning.
"""
from __future__ import annotations

import logging

from agents.state import GraphState
from agents.utils import write_trace, Timer
from tools.travel_tools import TravelCheckInput, check_travel_feasibility

logger = logging.getLogger(__name__)


def travel_agent(state: GraphState) -> GraphState:
    """
    Advisory node: flag unrealistic location-to-location jumps between consecutive
    shoot days based on OSRM driving duration.

    Prerequisites (all optional — skips gracefully if absent):
        - state["current_schedule"]: feasible solver result
        - Locations with lat/lon coordinates (skips pairs without coords)

    Output:
        state["travel_violations"]: list of advisory strings (may be empty)
    """
    schedule = state.get("current_schedule")

    if not schedule or not schedule.feasible:
        return {**state, "travel_violations": []}

    scenes = state.get("scenes", [])
    locations = state.get("locations", [])
    entries = schedule.schedule

    if len(entries) < 2:
        return {**state, "travel_violations": []}

    with Timer() as t:
        inp = TravelCheckInput(
            scenes=scenes,
            schedule_entries=entries,
            locations=locations,
        )
        result = check_travel_feasibility(inp)

    logger.info("travel_agent: %d travel advisory violations", len(result.violations))

    if state.get("project_id") and state.get("run_id"):
        write_trace(
            project_id=state["project_id"],
            run_id=state["run_id"],
            agent_name="Travel Agent",
            input_summary=(
                f"Checking travel feasibility across {len(entries)} schedule entries "
                f"at {len(locations)} location(s)."
            ),
            output_summary=(
                f"{len(result.violations)} travel advisories raised."
                if result.violations
                else "No travel advisories — all consecutive locations within threshold."
            ),
            tool_calls=[{"tool": "check_travel_feasibility", "args": {}}],
            duration_ms=t.duration_ms,
            confidence="high" if not result.violations else "medium",
        )

    return {**state, "travel_violations": result.violations}
