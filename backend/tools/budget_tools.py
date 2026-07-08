"""
Budget validation tools for CineSched.
Calculates actual schedule cost and checks against budget sub-caps.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional

from pydantic import BaseModel

from models.schemas import (
    SolverBudget,
    SolverCastMember,
    SolverEntryResult,
    SolverEquipment,
    SolverLocation,
    SolverScene,
)


# ─────────────────────────────────────────────────────────────────────────────
# calc_schedule_cost
# ─────────────────────────────────────────────────────────────────────────────
class ScheduleCostInput(BaseModel):
    scenes: List[SolverScene]
    cast: List[SolverCastMember]
    locations: List[SolverLocation]
    equipment: List[SolverEquipment]
    schedule: List[SolverEntryResult]


class ScheduleCostResult(BaseModel):
    total_cost: float
    cast_cost: float
    location_cost: float
    equipment_cost: float
    num_shoot_days: int
    cost_breakdown: Dict[str, float]   # category -> amount


def calc_schedule_cost(inp: ScheduleCostInput) -> ScheduleCostResult:
    """
    Calculate the total and per-category cost of a proposed schedule.

    Cost model:
    - Cast: cost_per_day × number of days they appear in scenes
    - Location: cost_per_day × number of distinct days the location is used
    - Equipment: cost_per_day × number of distinct days any scene using it is scheduled
    """
    scene_map: Dict[str, SolverScene]       = {s.id: s for s in inp.scenes}
    cast_map:  Dict[str, SolverCastMember]  = {c.id: c for c in inp.cast}
    loc_map:   Dict[str, SolverLocation]    = {l.id: l for l in inp.locations}
    equip_map: Dict[str, SolverEquipment]   = {e.id: e for e in inp.equipment}

    # Days each cast member appears in a scheduled scene
    cast_active_days:  Dict[str, set] = defaultdict(set)
    loc_active_days:   Dict[str, set] = defaultdict(set)
    equip_active_days: Dict[str, set] = defaultdict(set)

    shoot_days: set = set()

    for entry in inp.schedule:
        scene = scene_map.get(entry.scene_id)
        if not scene:
            continue
        day = entry.shoot_day
        shoot_days.add(day)

        for cast_id in scene.cast_member_ids:
            cast_active_days[cast_id].add(day)

        if scene.location_id:
            loc_active_days[scene.location_id].add(day)

        for equip_id in scene.equipment_requirements:
            equip_active_days[equip_id].add(day)

    # Compute costs
    cast_cost = sum(
        cast_map[cid].cost_per_day * len(days)
        for cid, days in cast_active_days.items()
        if cid in cast_map
    )
    location_cost = sum(
        loc_map[lid].cost_per_day * len(days)
        for lid, days in loc_active_days.items()
        if lid in loc_map
    )
    equipment_cost = sum(
        equip_map[eid].cost_per_day * len(days)
        for eid, days in equip_active_days.items()
        if eid in equip_map
    )

    total_cost = cast_cost + location_cost + equipment_cost

    breakdown = {
        "cast": round(cast_cost, 2),
        "location": round(location_cost, 2),
        "equipment": round(equipment_cost, 2),
    }
    # Per-person breakdown
    for cid, days in cast_active_days.items():
        cm = cast_map.get(cid)
        if cm:
            breakdown[f"cast.{cm.name}"] = round(cm.cost_per_day * len(days), 2)

    return ScheduleCostResult(
        total_cost=round(total_cost, 2),
        cast_cost=round(cast_cost, 2),
        location_cost=round(location_cost, 2),
        equipment_cost=round(equipment_cost, 2),
        num_shoot_days=len(shoot_days),
        cost_breakdown=breakdown,
    )


# ─────────────────────────────────────────────────────────────────────────────
# check_budget_cap
# ─────────────────────────────────────────────────────────────────────────────
class BudgetCapInput(BaseModel):
    cost_result: ScheduleCostResult
    budget: SolverBudget


class BudgetCapResult(BaseModel):
    violations: List[str]
    warnings: List[str]
    ok: bool
    over_budget_by: float


def check_budget_cap(inp: BudgetCapInput) -> BudgetCapResult:
    """
    Check whether the schedule's cost fits within the project budget and sub-caps.

    Returns violations for hard overruns and warnings for anything close (>90%).
    """
    r = inp.cost_result
    b = inp.budget
    violations: List[str] = []
    warnings: List[str] = []

    # Total cap
    over_by = 0.0
    if r.total_cost > b.total_limit:
        over_by = r.total_cost - b.total_limit
        violations.append(
            f"Total cost ${r.total_cost:,.2f} exceeds total budget ${b.total_limit:,.2f} "
            f"(over by ${over_by:,.2f})"
        )
    elif r.total_cost > b.total_limit * 0.9:
        warnings.append(
            f"Total cost ${r.total_cost:,.2f} is within 10% of budget ${b.total_limit:,.2f}"
        )

    # Sub-caps
    if b.cast_cap and r.cast_cost > b.cast_cap:
        violations.append(
            f"Cast cost ${r.cast_cost:,.2f} exceeds cast cap ${b.cast_cap:,.2f}"
        )

    if b.location_cap and r.location_cost > b.location_cap:
        violations.append(
            f"Location cost ${r.location_cost:,.2f} exceeds location cap ${b.location_cap:,.2f}"
        )

    if b.equipment_cap and r.equipment_cost > b.equipment_cap:
        violations.append(
            f"Equipment cost ${r.equipment_cost:,.2f} exceeds equipment cap ${b.equipment_cap:,.2f}"
        )

    return BudgetCapResult(
        violations=violations,
        warnings=warnings,
        ok=len(violations) == 0,
        over_budget_by=round(over_by, 2),
    )
