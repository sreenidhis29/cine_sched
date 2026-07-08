import pytest
from datetime import date
from models.schemas import (
    SolverBudget, SolverCastMember, SolverEntryResult,
    SolverEquipment, SolverLocation, SolverScene
)
from tools.availability_tools import (
    ActorAvailabilityInput, LocationWindowInput,
    check_actor_availability, check_location_window
)
from tools.budget_tools import (
    BudgetCapInput, ScheduleCostInput,
    calc_schedule_cost, check_budget_cap
)
from tools.conflict_tools import (
    DoubleBookingInput, EquipmentConflictInput,
    check_double_booking, check_equipment_conflict
)


def test_actor_availability_tool():
    cm = SolverCastMember(id="c1", name="Actor 1", availability_start=date(2024, 3, 1), availability_end=date(2024, 3, 2))
    scenes = [SolverScene(id="s1", scene_number=1, title="Scene 1", duration_minutes=60, cast_member_ids=["c1"])]
    
    # Valid schedule
    schedule_valid = [SolverEntryResult(scene_id="s1", shoot_day=1)] # Day 1 is 2024-03-01
    res1 = check_actor_availability(ActorAvailabilityInput(cast_member=cm, scenes_for_cast=scenes, schedule=schedule_valid, start_date=date(2024, 3, 1)))
    assert res1.ok is True
    
    # Invalid schedule
    schedule_invalid = [SolverEntryResult(scene_id="s1", shoot_day=3)] # Day 3 is 2024-03-03
    res2 = check_actor_availability(ActorAvailabilityInput(cast_member=cm, scenes_for_cast=scenes, schedule=schedule_invalid, start_date=date(2024, 3, 1)))
    assert res2.ok is False
    assert len(res2.violations) == 1


def test_location_window_tool():
    loc = SolverLocation(id="l1", name="Loc 1", availability_start=date(2024, 3, 2), availability_end=date(2024, 3, 4))
    scenes = [SolverScene(id="s1", scene_number=1, title="Scene 1", duration_minutes=60, location_id="l1")]
    
    schedule_invalid = [SolverEntryResult(scene_id="s1", shoot_day=1)] # Day 1 is 2024-03-01
    res = check_location_window(LocationWindowInput(location=loc, scenes_at_location=scenes, schedule=schedule_invalid, start_date=date(2024, 3, 1)))
    assert res.ok is False
    assert len(res.violations) == 1


def test_double_booking_tool():
    scenes = [
        SolverScene(id="s1", scene_number=1, title="Scene 1", duration_minutes=60, cast_member_ids=["c1"]),
        SolverScene(id="s2", scene_number=2, title="Scene 2", duration_minutes=60, cast_member_ids=["c1"]),
    ]
    schedule = [
        SolverEntryResult(scene_id="s1", shoot_day=1),
        SolverEntryResult(scene_id="s2", shoot_day=1),
    ]
    # In a day-level schedule, this isn't strictly double booking unless they are at different locations, 
    # but the tool currently warns if an actor is in multiple scenes on the same day.
    res = check_double_booking(DoubleBookingInput(scenes=scenes, schedule=schedule))
    assert res.ok is False
    assert any("double-booked" in v for v in res.violations)


def test_equipment_conflict_tool():
    scenes = [
        SolverScene(id="s1", scene_number=1, title="Scene 1", duration_minutes=60, equipment_requirements={"e1": 2}),
    ]
    equipment = [SolverEquipment(id="e1", name="Eq 1", quantity=1)]
    schedule = [SolverEntryResult(scene_id="s1", shoot_day=1)]
    
    res = check_equipment_conflict(EquipmentConflictInput(scenes=scenes, equipment=equipment, schedule=schedule))
    assert res.ok is False
    assert len(res.violations) == 1


def test_budget_tools():
    scenes = [SolverScene(id="s1", scene_number=1, title="Scene 1", duration_minutes=60, cast_member_ids=["c1"])]
    cast = [SolverCastMember(id="c1", name="Actor 1", cost_per_day=500)]
    schedule = [SolverEntryResult(scene_id="s1", shoot_day=1)]
    
    cost_res = calc_schedule_cost(ScheduleCostInput(scenes=scenes, cast=cast, locations=[], equipment=[], schedule=schedule))
    assert cost_res.total_cost == 500
    
    budget = SolverBudget(total_limit=400, cast_cap=300)
    budget_res = check_budget_cap(BudgetCapInput(cost_result=cost_res, budget=budget))
    assert budget_res.ok is False
    assert len(budget_res.violations) == 2 # total cost and cast cap exceeded
