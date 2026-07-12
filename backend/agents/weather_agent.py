"""
Weather agent — Phase 4 advisory node in the LangGraph pipeline.

Checks exterior scenes' scheduled dates against the Open-Meteo 16-day forecast.
Skips gracefully if no start_date or shoot-base coordinates are available.
Produces soft advisory violations only — never triggers replanning.
"""
from __future__ import annotations

import logging

from agents.state import GraphState
from agents.utils import write_trace, Timer
from tools.weather_tools import WeatherCheckInput, check_weather_risk

logger = logging.getLogger(__name__)


def weather_agent(state: GraphState) -> GraphState:
    """
    Advisory node: flag exterior scenes scheduled on high-risk weather days.

    Prerequisites (all optional — skips gracefully if absent):
        - state["start_date"]: the first shoot date (needed to map shoot_day -> calendar date)
        - state["shoot_base_lat"] / state["shoot_base_lon"]: coordinates for the forecast
        - state["current_schedule"]: a feasible solver result with schedule entries

    Output:
        state["weather_violations"]: list of advisory strings (may be empty)
    """
    schedule = state.get("current_schedule")
    start_date = state.get("start_date")
    lat = state.get("shoot_base_lat")
    lon = state.get("shoot_base_lon")

    # Skip conditions
    if not schedule or not schedule.feasible:
        return {**state, "weather_violations": []}
    if not start_date:
        logger.info("weather_agent: no start_date — skipping weather check")
        return {**state, "weather_violations": []}
    if lat is None or lon is None:
        logger.info("weather_agent: no shoot-base coordinates — skipping weather check")
        return {**state, "weather_violations": []}

    scenes = state.get("scenes", [])
    locations = state.get("locations", [])
    entries = schedule.schedule

    with Timer() as t:
        inp = WeatherCheckInput(
            scenes=scenes,
            schedule_entries=entries,
            locations=locations,
            start_date=start_date,
            shoot_base_lat=lat,
            shoot_base_lon=lon,
        )
        result = check_weather_risk(inp)

    logger.info("weather_agent: %d weather advisory violations", len(result.violations))

    if state.get("project_id") and state.get("run_id"):
        ext_scenes = [s for s in scenes if "EXT" in (s.setting or "").upper()]
        write_trace(
            project_id=state["project_id"],
            run_id=state["run_id"],
            agent_name="Weather Agent",
            input_summary=(
                f"Checking {len(ext_scenes)} exterior scene(s) against "
                f"Open-Meteo forecast at ({lat:.3f}, {lon:.3f}) from {start_date}."
            ),
            output_summary=(
                f"{len(result.violations)} weather advisories raised."
                if result.violations
                else "No weather advisories."
            ),
            tool_calls=[{"tool": "check_weather_risk", "args": {}}],
            duration_ms=t.duration_ms,
            confidence="high" if not result.violations else "medium",
        )

    extra_context = state.get("extra_context") or {}
    # Ensure it's a dict and update
    new_extra = {**extra_context, "day_forecasts": result.day_forecasts}

    return {
        **state,
        "weather_violations": result.violations,
        "extra_context": new_extra,
    }

