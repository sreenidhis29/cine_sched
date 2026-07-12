"""
Travel feasibility tools for CineSched Phase 4.

Checks whether consecutive shoot days involve unrealistic location jumps
by querying the OSRM routing API for driving duration between location pairs.

Produces advisory (soft) violation strings — never blocks scheduling.

Threshold: 90 minutes driving time by default. Over that, an advisory is raised
suggesting overnight accommodation or a location swap consideration.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

from pydantic import BaseModel

from integrations.routing_client import TravelResult, get_travel_duration
from models.schemas import SolverEntryResult, SolverLocation, SolverScene

logger = logging.getLogger(__name__)

# Default driving time threshold in minutes
DEFAULT_TRAVEL_THRESHOLD_MINUTES = 90.0


class TravelCheckInput(BaseModel):
    scenes: List[SolverScene]
    schedule_entries: List[SolverEntryResult]
    locations: List[SolverLocation]
    threshold_minutes: float = DEFAULT_TRAVEL_THRESHOLD_MINUTES


class TravelCheckResult(BaseModel):
    violations: List[str]


def check_travel_feasibility(inp: TravelCheckInput) -> TravelCheckResult:
    """
    For each pair of consecutive shoot days, find the primary location for each
    day and check the driving time between them via OSRM.

    A violation is raised if travel time exceeds `threshold_minutes`.
    Pairs where either location has no lat/lon are silently skipped.

    Returns advisory violation strings — never hard blocks.
    """
    if len(inp.schedule_entries) < 2:
        return TravelCheckResult(violations=[])

    # Build location lookup
    location_by_id: Dict[str, SolverLocation] = {l.id: l for l in inp.locations}
    # Build scene lookup
    scene_by_id: Dict[str, SolverScene] = {s.id: s for s in inp.scenes}

    # Determine the primary location per shoot day:
    # Use the location of the first scene on each day (by scene_number order).
    day_scenes: Dict[int, List[SolverScene]] = {}
    for entry in inp.schedule_entries:
        scene = scene_by_id.get(entry.scene_id)
        if scene:
            day_scenes.setdefault(entry.shoot_day, []).append(scene)

    # Sort scenes within each day by scene_number for determinism
    primary_loc_per_day: Dict[int, Optional[SolverLocation]] = {}
    for day, scenes in day_scenes.items():
        scenes_sorted = sorted(scenes, key=lambda s: s.scene_number)
        for s in scenes_sorted:
            if s.location_id and s.location_id in location_by_id:
                primary_loc_per_day[day] = location_by_id[s.location_id]
                break
        else:
            primary_loc_per_day[day] = None

    sorted_days = sorted(primary_loc_per_day.keys())
    violations: List[str] = []

    for i in range(len(sorted_days) - 1):
        day_a = sorted_days[i]
        day_b = sorted_days[i + 1]
        loc_a = primary_loc_per_day.get(day_a)
        loc_b = primary_loc_per_day.get(day_b)

        # Skip if same location or either missing coords
        if not loc_a or not loc_b:
            continue
        if loc_a.id == loc_b.id:
            continue

        # Check if both locations have coordinates
        lat_a = loc_a.latitude
        lon_a = loc_a.longitude
        lat_b = loc_b.latitude
        lon_b = loc_b.longitude

        if not all([lat_a, lon_a, lat_b, lon_b]):
            logger.debug(
                "travel_tools: skipping Day %d→%d — missing coordinates for '%s' or '%s'",
                day_a, day_b, loc_a.name, loc_b.name,
            )
            continue


        result: TravelResult = get_travel_duration(lat_a, lon_a, lat_b, lon_b)

        if not result.ok:
            logger.debug(
                "travel_tools: OSRM unavailable for Day %d→%d (%s)",
                day_a, day_b, result.error,
            )
            continue

        if result.duration_minutes > inp.threshold_minutes:
            violations.append(
                f"[TRAVEL ADVISORY] Day {day_a}→{day_b}: "
                f"'{loc_a.name}' to '{loc_b.name}' is ~{result.duration_minutes:.0f} min drive "
                f"({result.distance_km:.1f} km). "
                f"Consider overnight accommodation or reordering shoot days."
            )

    logger.info("travel_tools: %d travel advisory violations", len(violations))
    return TravelCheckResult(violations=violations)
