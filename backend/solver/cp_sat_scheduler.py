"""
CP-SAT Scheduler for CineSched.

This is the ONLY component that computes scheduling feasibility.
LLM agents reason about WHAT to relax — this solver computes WHETHER a schedule
is feasible given those constraints.

Constraints modelled:
  - Day capacity: total scene duration per day ≤ MAX_MINUTES_PER_DAY (600 min / 10 hrs)
  - Actor availability: each scene's cast must be available on the assigned shoot day.
  - Location availability: each scene's location must be open on the assigned shoot day.
  - Equipment capacity: total quantity of each equipment item required on any day ≤ available qty.
  - Location consolidation: at most one distinct location active per day (soft penalty).

Objective: minimize total production cost + location-move penalty.

relaxed_constraints is a list of strings indicating which hard constraints have been
loosened by the critic agent. Supported tokens:
  "actor_availability:<cast_id>"   — ignore availability window for that cast member
  "location_availability:<loc_id>" — ignore availability window for that location
  "budget"                         — skip budget-cap check inside the solver
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Dict, List, Optional, Set

from ortools.sat.python import cp_model

from models.schemas import (
    SolverBudget,
    SolverCastMember,
    SolverEntryResult,
    SolverEquipment,
    SolverLocation,
    SolverResult,
    SolverScene,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────
MAX_MINUTES_PER_DAY = 600       # 10-hour shoot day
MAX_DAYS_HORIZON = 30           # maximum shoot days we'll ever consider
LOCATION_MOVE_PENALTY = 500     # cost penalty per location change between days (in solver units)
SCALE = 100                     # scale factor to keep costs as integers (cents)
WEATHER_PREFERENCE_PENALTY = 200  # soft penalty for shooting exterior scene on non-preferred day
ROUTE_PREFERENCE_PENALTY = 100    # soft penalty for pairwise order inversion of locations


def _date_to_day(ref: date, d: date) -> int:
    """Convert an absolute date to a 1-indexed shoot day number relative to ref."""
    return (d - ref).days + 1


def _parse_relaxed(relaxed_constraints: List[str]) -> tuple[Set[str], Set[str], bool]:
    """Parse the relaxed_constraints list into typed sets."""
    relaxed_actors: Set[str] = set()
    relaxed_locations: Set[str] = set()
    relax_budget = False
    for token in relaxed_constraints:
        if token.startswith("actor_availability:"):
            relaxed_actors.add(token.split(":", 1)[1])
        elif token.startswith("location_availability:"):
            relaxed_locations.add(token.split(":", 1)[1])
        elif token == "budget":
            relax_budget = True
    return relaxed_actors, relaxed_locations, relax_budget


# ─────────────────────────────────────────────────────────────────────────────
# SOLVER ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────
def solve_schedule(
    scenes: List[SolverScene],
    cast: List[SolverCastMember],
    locations: List[SolverLocation],
    equipment: List[SolverEquipment],
    budget: SolverBudget,
    relaxed_constraints: Optional[List[str]] = None,
    start_date: Optional[date] = None,
    max_shoot_days: Optional[int] = None,
    preferred_location_order: Optional[List[str]] = None,
    preferred_shoot_dates: Optional[Dict[str, List[str]]] = None,
) -> SolverResult:
    """
    Solve the film scheduling problem using OR-Tools CP-SAT.

    Returns a SolverResult. On infeasibility, returns feasible=False with
    a human-readable violations list — never raises an exception.
    """
    relaxed_constraints = relaxed_constraints or []
    relaxed_actors, relaxed_locations, relax_budget = _parse_relaxed(relaxed_constraints)

    if not scenes:
        return SolverResult(feasible=True, schedule=[], total_cost=0.0, violations=[], num_shoot_days=0)

    # ── Build lookup dicts ──────────────────────────────────────────────────
    cast_by_id: Dict[str, SolverCastMember]     = {c.id: c for c in cast}
    loc_by_id: Dict[str, SolverLocation]        = {l.id: l for l in locations}
    equip_by_id: Dict[str, SolverEquipment]     = {e.id: e for e in equipment}

    # ── Determine day horizon ───────────────────────────────────────────────
    ref_date = start_date or date(2024, 3, 1)

    # Find latest required availability end
    latest_day = 1
    for loc in locations:
        if loc.availability_end:
            d = _date_to_day(ref_date, loc.availability_end)
            latest_day = max(latest_day, d)
    for cm in cast:
        if cm.availability_end:
            d = _date_to_day(ref_date, cm.availability_end)
            latest_day = max(latest_day, d)

    num_days = min(max_shoot_days or MAX_DAYS_HORIZON, max(latest_day, len(scenes)))
    num_days = min(num_days, MAX_DAYS_HORIZON)

    logger.info("CP-SAT: %d scenes, %d cast, %d locations, %d equipment, %d-day horizon",
                len(scenes), len(cast), len(locations), len(equipment), num_days)
    logger.info("Solver received %d preferred stops, %d preferred date sets",
                len(preferred_location_order or []), len(preferred_shoot_dates or {}))

    # ── Build CP-SAT model ──────────────────────────────────────────────────
    model = cp_model.CpModel()

    # Decision variables: scene_day[i] ∈ [1, num_days]
    scene_day: Dict[str, cp_model.IntVar] = {}
    for s in scenes:
        scene_day[s.id] = model.new_int_var(1, num_days, f"day_{s.id}")

    # Boolean: is_scene_on_day[scene_id][day] = 1 iff scene assigned to that day
    is_scene_on_day: Dict[str, List[cp_model.BoolVar]] = {}
    for s in scenes:
        is_scene_on_day[s.id] = []
        for d in range(1, num_days + 1):
            b = model.new_bool_var(f"scene_{s.id}_day_{d}")
            is_scene_on_day[s.id].append(b)
        # Link: exactly one day is selected
        model.add_exactly_one(is_scene_on_day[s.id])
        # Link booleans to the integer variable
        for d_idx, b in enumerate(is_scene_on_day[s.id]):
            day_val = d_idx + 1
            model.add(scene_day[s.id] == day_val).only_enforce_if(b)
            model.add(scene_day[s.id] != day_val).only_enforce_if(b.negated())

    # ── Constraint 1: Day capacity ──────────────────────────────────────────
    scene_duration: Dict[str, int] = {s.id: s.duration_minutes for s in scenes}
    for d in range(1, num_days + 1):
        day_load = []
        for s in scenes:
            b = is_scene_on_day[s.id][d - 1]
            day_load.append(b * scene_duration[s.id])
        model.add(sum(day_load) <= MAX_MINUTES_PER_DAY)

    violations_found: List[str] = []

    # ── Constraint 2: Actor availability ───────────────────────────────────
    for s in scenes:
        for cast_id in s.cast_member_ids:
            if cast_id in relaxed_actors:
                continue
            cm = cast_by_id.get(cast_id)
            if cm is None:
                continue
            if cm.availability_start:
                first_day = _date_to_day(ref_date, cm.availability_start)
                # scene_day[s.id] >= first_day
                model.add(scene_day[s.id] >= max(1, first_day))
            if cm.availability_end:
                last_day = _date_to_day(ref_date, cm.availability_end)
                if last_day < 1:
                    # Actor never available — infeasible unless relaxed
                    violations_found.append(
                        f"Actor '{cm.name}' has no availability in the scheduling window"
                    )
                    return SolverResult(feasible=False, schedule=[], total_cost=0.0,
                                        violations=violations_found, num_shoot_days=0)
                model.add(scene_day[s.id] <= min(num_days, last_day))

    # ── Constraint 3: Location availability ────────────────────────────────
    for s in scenes:
        if not s.location_id:
            continue
        if s.location_id in relaxed_locations:
            continue
        loc = loc_by_id.get(s.location_id)
        if loc is None:
            continue
        if loc.availability_start:
            first_day = _date_to_day(ref_date, loc.availability_start)
            model.add(scene_day[s.id] >= max(1, first_day))
        if loc.availability_end:
            last_day = _date_to_day(ref_date, loc.availability_end)
            if last_day < 1:
                violations_found.append(
                    f"Location '{loc.name}' has no availability in the scheduling window"
                )
                return SolverResult(feasible=False, schedule=[], total_cost=0.0,
                                    violations=violations_found, num_shoot_days=0)
            model.add(scene_day[s.id] <= min(num_days, last_day))

    # ── Constraint 4: Equipment capacity ───────────────────────────────────
    for equip in equipment:
        for d in range(1, num_days + 1):
            daily_usage = []
            for s in scenes:
                qty_required = s.equipment_requirements.get(equip.id, 0)
                if qty_required > 0:
                    b = is_scene_on_day[s.id][d - 1]
                    daily_usage.append(b * qty_required)
            if daily_usage:
                model.add(sum(daily_usage) <= equip.quantity)

    # ── Objective: minimize cost + location-move penalty ───────────────────
    # Build per-location day-is-active booleans for location consolidation
    # (one location per day — soft via penalty, not hard constraint)
    loc_active_on_day: Dict[str, List[cp_model.BoolVar]] = {}
    for loc in locations:
        loc_active_on_day[loc.id] = []
        for d in range(1, num_days + 1):
            scenes_at_loc = [s for s in scenes if s.location_id == loc.id]
            if not scenes_at_loc:
                loc_active_on_day[loc.id].append(model.new_constant(0))
                continue
            b_loc = model.new_bool_var(f"loc_{loc.id}_active_day_{d}")
            scene_bools_today = [is_scene_on_day[s.id][d - 1] for s in scenes_at_loc]
            # b_loc = OR(scene_bools_today)
            model.add_bool_or(scene_bools_today).only_enforce_if(b_loc)
            model.add_bool_and([b.negated() for b in scene_bools_today]).only_enforce_if(b_loc.negated())
            loc_active_on_day[loc.id].append(b_loc)

    # Location-move penalty: penalize when more than one location is active on same day
    num_locs_active_per_day = []
    for d in range(1, num_days + 1):
        day_active = [loc_active_on_day[loc.id][d - 1] for loc in locations]
        num_locs_active_per_day.append(day_active)

    # Cost components (scaled to integers)
    cost_terms = []

    # Scene duration cost proxy (number of shoot days * base day rate)
    for s in scenes:
        # cost = duration * rate per minute (approximate)
        pass  # captured in location + cast cost below

    # Cast cost: cost_per_day for each day the cast member has a scene
    cast_used_on_day: Dict[str, List[cp_model.BoolVar]] = {}
    for cm in cast:
        cast_used_on_day[cm.id] = []
        for d in range(1, num_days + 1):
            scenes_with_cm = [s for s in scenes if cm.id in s.cast_member_ids]
            if not scenes_with_cm:
                cast_used_on_day[cm.id].append(model.new_constant(0))
                continue
            b_cm = model.new_bool_var(f"cm_{cm.id}_active_day_{d}")
            scene_bools = [is_scene_on_day[s.id][d - 1] for s in scenes_with_cm]
            model.add_bool_or(scene_bools).only_enforce_if(b_cm)
            model.add_bool_and([b.negated() for b in scene_bools]).only_enforce_if(b_cm.negated())
            cast_used_on_day[cm.id].append(b_cm)
            cost_terms.append(int(cm.cost_per_day * SCALE) * b_cm)

    # Location active cost
    for loc in locations:
        for d in range(1, num_days + 1):
            b = loc_active_on_day[loc.id][d - 1]
            if hasattr(b, '__mul__'):  # is a real BoolVar, not a constant
                cost_terms.append(int(loc.cost_per_day * SCALE) * b)

    # Location-move penalty: penalize each day where >1 location is active
    for d in range(1, num_days + 1):
        day_locs = num_locs_active_per_day[d - 1]
        # num active locations on this day (sum of booleans)
        # penalty = max(0, num_active - 1) * LOCATION_MOVE_PENALTY
        # We model this by summing booleans and subtracting 1 (clamped)
        if len(day_locs) > 1:
            overflow = model.new_int_var(0, len(locations) - 1, f"loc_overflow_day_{d}")
            real_day_locs = [b for b in day_locs if hasattr(b, 'index')]
            if real_day_locs:
                model.add(overflow == sum(real_day_locs) - 1)
                # clamp to 0
                overflow_clamped = model.new_int_var(0, len(locations) - 1, f"loc_overflow_clamped_day_{d}")
                model.add_max_equality(overflow_clamped, [overflow, model.new_constant(0)])
                cost_terms.append(LOCATION_MOVE_PENALTY * SCALE * overflow_clamped)

    # ── Soft preferences from Route Planner & Shoot-Window Planner ──────────────────
    # Soft weather preference: penalize shooting exterior scenes on non-preferred days
    if preferred_shoot_dates:
        for s in scenes:
            is_ext = s.setting and "ext" in s.setting.lower()
            if is_ext and s.location_id in preferred_shoot_dates:
                preferred_dates = preferred_shoot_dates[s.location_id]
                for d in range(1, num_days + 1):
                    shoot_date = ref_date + timedelta(days=d - 1)
                    if shoot_date.isoformat() not in preferred_dates:
                        b = is_scene_on_day[s.id][d - 1]
                        cost_terms.append(WEATHER_PREFERENCE_PENALTY * SCALE * b)

    # Soft routing order preference: penalize sequence order inversions
    if preferred_location_order:
        loc_order_idx = {loc_id: idx for idx, loc_id in enumerate(preferred_location_order)}
        valid_scenes = [s for s in scenes if s.location_id in loc_order_idx]
        for i in range(len(valid_scenes)):
            for j in range(i + 1, len(valid_scenes)):
                s_a = valid_scenes[i]
                s_b = valid_scenes[j]
                if s_a.location_id == s_b.location_id:
                    continue
                
                idx_a = loc_order_idx[s_a.location_id]
                idx_b = loc_order_idx[s_b.location_id]
                
                if idx_a < idx_b:
                    first_scene, second_scene = s_a, s_b
                else:
                    first_scene, second_scene = s_b, s_a
                
                inversion = model.new_bool_var(f"inv_{first_scene.id}_{second_scene.id}")
                model.add(scene_day[first_scene.id] > scene_day[second_scene.id]).only_enforce_if(inversion)
                model.add(scene_day[first_scene.id] <= scene_day[second_scene.id]).only_enforce_if(inversion.negated())
                cost_terms.append(ROUTE_PREFERENCE_PENALTY * SCALE * inversion)

    if cost_terms:
        model.minimize(sum(cost_terms))

    # ── Solve ───────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.num_workers = 4
    solver.parameters.log_search_progress = False

    status = solver.solve(model)
    logger.info("CP-SAT status: %s", solver.status_name(status))

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        schedule_entries: List[SolverEntryResult] = []
        assigned_days: Set[int] = set()
        for s in scenes:
            day_val = solver.value(scene_day[s.id])
            assigned_days.add(day_val)
            shoot_date = ref_date + timedelta(days=day_val - 1) if start_date else None
            schedule_entries.append(SolverEntryResult(scene_id=s.id, shoot_day=day_val))

        # Compute actual cost from solution
        total_cost_scaled = solver.objective_value
        total_cost = total_cost_scaled / SCALE

        return SolverResult(
            feasible=True,
            schedule=schedule_entries,
            total_cost=round(total_cost, 2),
            violations=[],
            num_shoot_days=len(assigned_days),
        )

    elif status == cp_model.INFEASIBLE:
        # Report what's likely infeasible
        infeasibility_reasons = _diagnose_infeasibility(
            scenes, cast, locations, equipment, ref_date, num_days,
            relaxed_actors, relaxed_locations
        )
        return SolverResult(
            feasible=False,
            schedule=[],
            total_cost=0.0,
            violations=infeasibility_reasons or ["Schedule is infeasible with current constraints"],
            num_shoot_days=0,
        )
    else:
        # UNKNOWN or MODEL_INVALID
        return SolverResult(
            feasible=False,
            schedule=[],
            total_cost=0.0,
            violations=[f"Solver returned status: {solver.status_name(status)}"],
            num_shoot_days=0,
        )


def _diagnose_infeasibility(
    scenes: List[SolverScene],
    cast: List[SolverCastMember],
    locations: List[SolverLocation],
    equipment: List[SolverEquipment],
    ref_date: date,
    num_days: int,
    relaxed_actors: Set[str],
    relaxed_locations: Set[str],
) -> List[str]:
    """Heuristic diagnosis of why the schedule is infeasible."""
    reasons = []

    cast_by_id = {c.id: c for c in cast}
    loc_by_id  = {l.id: l for l in locations}

    for s in scenes:
        # Narrow actor windows
        for cid in s.cast_member_ids:
            if cid in relaxed_actors:
                continue
            cm = cast_by_id.get(cid)
            if not cm:
                continue
            if cm.availability_start and cm.availability_end:
                window = (_date_to_day(ref_date, cm.availability_end) -
                          _date_to_day(ref_date, cm.availability_start) + 1)
                if window <= 0:
                    reasons.append(
                        f"Actor '{cm.name}' has zero-day availability window"
                    )
        # Tight location windows
        if s.location_id and s.location_id not in relaxed_locations:
            loc = loc_by_id.get(s.location_id)
            if loc and loc.availability_start and loc.availability_end:
                window = (_date_to_day(ref_date, loc.availability_end) -
                          _date_to_day(ref_date, loc.availability_start) + 1)
                if window <= 0:
                    reasons.append(
                        f"Location '{loc.name}' has zero-day availability window"
                    )

    # Check equipment oversubscription
    equip_by_id = {e.id: e for e in equipment}
    for equip in equipment:
        # Sum requirements across all scenes on a given day
        scenes_needing = [(s, s.equipment_requirements.get(equip.id, 0))
                          for s in scenes if s.equipment_requirements.get(equip.id, 0) > 0]
        if sum(qty for _, qty in scenes_needing) > equip.quantity * num_days:
            reasons.append(
                f"Equipment '{equip.name}' is over-subscribed across all possible schedule days"
            )

    if not reasons:
        reasons.append(
            "Schedule is infeasible — likely due to overlapping narrow availability windows "
            "or day-capacity overrun. Consider relaxing actor/location windows or splitting long scenes."
        )

    return reasons
