"""
Availability tools for CineSched.
Checks actor and location availability windows against a proposed schedule.
These are LangGraph-compatible tools with Pydantic I/O.
"""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field

from models.schemas import SolverCastMember, SolverEntryResult, SolverLocation, SolverScene


# ─────────────────────────────────────────────────────────────────────────────
# check_actor_availability
# ─────────────────────────────────────────────────────────────────────────────
class ActorAvailabilityInput(BaseModel):
    cast_member: SolverCastMember
    scenes_for_cast: List[SolverScene]
    schedule: List[SolverEntryResult]
    start_date: Optional[date] = None


class ActorAvailabilityResult(BaseModel):
    cast_id: str
    cast_name: str
    violations: List[str]
    ok: bool


def check_actor_availability(inp: ActorAvailabilityInput) -> ActorAvailabilityResult:
    """
    Check whether a cast member is available on every shoot day
    to which their scenes have been assigned.

    Returns a result with a list of violations (empty = OK).
    """
    ref = inp.start_date or date(2024, 3, 1)
    violations: List[str] = []

    scene_day_map = {entry.scene_id: entry.shoot_day for entry in inp.schedule}

    for scene in inp.scenes_for_cast:
        shoot_day = scene_day_map.get(scene.id)
        if shoot_day is None:
            continue

        shoot_date = ref.__class__(
            ref.year, ref.month, ref.day
        )
        from datetime import timedelta
        shoot_date = ref + timedelta(days=shoot_day - 1)

        cm = inp.cast_member
        if cm.availability_start and shoot_date < cm.availability_start:
            violations.append(
                f"'{cm.name}' is not available on day {shoot_day} "
                f"(earliest: {cm.availability_start}) for scene '{scene.title}'"
            )
        if cm.availability_end and shoot_date > cm.availability_end:
            violations.append(
                f"'{cm.name}' is not available on day {shoot_day} "
                f"(latest: {cm.availability_end}) for scene '{scene.title}'"
            )

    return ActorAvailabilityResult(
        cast_id=inp.cast_member.id,
        cast_name=inp.cast_member.name,
        violations=violations,
        ok=len(violations) == 0,
    )


# ─────────────────────────────────────────────────────────────────────────────
# check_location_window
# ─────────────────────────────────────────────────────────────────────────────
class LocationWindowInput(BaseModel):
    location: SolverLocation
    scenes_at_location: List[SolverScene]
    schedule: List[SolverEntryResult]
    start_date: Optional[date] = None


class LocationWindowResult(BaseModel):
    location_id: str
    location_name: str
    violations: List[str]
    ok: bool


def check_location_window(inp: LocationWindowInput) -> LocationWindowResult:
    """
    Check whether a location is open on every shoot day its scenes are assigned to.
    """
    from datetime import timedelta
    ref = inp.start_date or date(2024, 3, 1)
    violations: List[str] = []
    scene_day_map = {entry.scene_id: entry.shoot_day for entry in inp.schedule}

    for scene in inp.scenes_at_location:
        shoot_day = scene_day_map.get(scene.id)
        if shoot_day is None:
            continue
        shoot_date = ref + timedelta(days=shoot_day - 1)
        loc = inp.location
        if loc.availability_start and shoot_date < loc.availability_start:
            violations.append(
                f"Location '{loc.name}' not available on day {shoot_day} "
                f"(opens: {loc.availability_start}) for scene '{scene.title}'"
            )
        if loc.availability_end and shoot_date > loc.availability_end:
            violations.append(
                f"Location '{loc.name}' not available on day {shoot_day} "
                f"(closes: {loc.availability_end}) for scene '{scene.title}'"
            )

    return LocationWindowResult(
        location_id=inp.location.id,
        location_name=inp.location.name,
        violations=violations,
        ok=len(violations) == 0,
    )
