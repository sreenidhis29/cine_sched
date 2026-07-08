"""
Conflict detection tools for CineSched.
Checks for double-booking and equipment over-subscription in a proposed schedule.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, List

from pydantic import BaseModel

from models.schemas import SolverEntryResult, SolverEquipment, SolverScene


# ─────────────────────────────────────────────────────────────────────────────
# check_double_booking
# ─────────────────────────────────────────────────────────────────────────────
class DoubleBookingInput(BaseModel):
    scenes: List[SolverScene]
    schedule: List[SolverEntryResult]


class DoubleBookingResult(BaseModel):
    violations: List[str]
    ok: bool


def check_double_booking(inp: DoubleBookingInput) -> DoubleBookingResult:
    """
    Detect any actor or location double-booked across two scenes on the same day.

    Note: The CP-SAT solver enforces capacity constraints, but this tool provides
    defense-in-depth validation of the solver's output.
    """
    scene_map: Dict[str, SolverScene] = {s.id: s for s in inp.scenes}
    violations: List[str] = []

    # Group scenes by shoot day
    day_scenes: Dict[int, List[SolverScene]] = defaultdict(list)
    for entry in inp.schedule:
        scene = scene_map.get(entry.scene_id)
        if scene:
            day_scenes[entry.shoot_day].append(scene)

    for day, day_scene_list in day_scenes.items():
        # Check actor double-booking: one actor can only do one scene at a time
        actor_scenes: Dict[str, List[str]] = defaultdict(list)
        for scene in day_scene_list:
            for cast_id in scene.cast_member_ids:
                actor_scenes[cast_id].append(scene.title)

        for cast_id, scene_titles in actor_scenes.items():
            if len(scene_titles) > 1:
                violations.append(
                    f"Day {day}: Actor ID '{cast_id}' is double-booked in scenes: "
                    f"{', '.join(scene_titles)}"
                )

        # Check location consolidation: warn if >1 location is used on same day
        locations_today: Dict[str, List[str]] = defaultdict(list)
        for scene in day_scene_list:
            if scene.location_id:
                locations_today[scene.location_id].append(scene.title)

        if len(locations_today) > 1:
            loc_ids = list(locations_today.keys())
            violations.append(
                f"Day {day}: Multiple locations active ({len(loc_ids)} locations). "
                f"This increases costs and crew travel. "
                f"Consider consolidating scenes to one location per day."
            )

    return DoubleBookingResult(violations=violations, ok=len(violations) == 0)


# ─────────────────────────────────────────────────────────────────────────────
# check_equipment_conflict
# ─────────────────────────────────────────────────────────────────────────────
class EquipmentConflictInput(BaseModel):
    scenes: List[SolverScene]
    equipment: List[SolverEquipment]
    schedule: List[SolverEntryResult]


class EquipmentConflictResult(BaseModel):
    violations: List[str]
    ok: bool


def check_equipment_conflict(inp: EquipmentConflictInput) -> EquipmentConflictResult:
    """
    Verify that no shoot day requires more equipment than is available.
    Defense-in-depth check of solver output.
    """
    scene_map: Dict[str, SolverScene] = {s.id: s for s in inp.scenes}
    equip_map: Dict[str, SolverEquipment] = {e.id: e for e in inp.equipment}
    violations: List[str] = []

    # Group scenes by day
    day_scenes: Dict[int, List[SolverScene]] = defaultdict(list)
    for entry in inp.schedule:
        scene = scene_map.get(entry.scene_id)
        if scene:
            day_scenes[entry.shoot_day].append(scene)

    for day, day_scene_list in day_scenes.items():
        daily_demand: Dict[str, int] = defaultdict(int)
        for scene in day_scene_list:
            for equip_id, qty in scene.equipment_requirements.items():
                daily_demand[equip_id] += qty

        for equip_id, demand in daily_demand.items():
            equip = equip_map.get(equip_id)
            if equip and demand > equip.quantity:
                violations.append(
                    f"Day {day}: Equipment '{equip.name}' requires {demand} units "
                    f"but only {equip.quantity} available"
                )

    return EquipmentConflictResult(violations=violations, ok=len(violations) == 0)
