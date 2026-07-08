import pytest
from datetime import date
from models.schemas import (
    SolverBudget, SolverCastMember, SolverEquipment,
    SolverLocation, SolverScene
)
from solver.cp_sat_scheduler import solve_schedule


def test_solver_feasible():
    scenes = [
        SolverScene(id="s1", scene_number=1, title="Scene 1", duration_minutes=60, location_id="loc1", cast_member_ids=["c1"], equipment_requirements={"e1": 1}),
        SolverScene(id="s2", scene_number=2, title="Scene 2", duration_minutes=60, location_id="loc1", cast_member_ids=["c1"], equipment_requirements={"e1": 1})
    ]
    cast = [
        SolverCastMember(id="c1", name="Actor 1", availability_start=date(2024, 3, 1), availability_end=date(2024, 3, 5), cost_per_day=100)
    ]
    locations = [
        SolverLocation(id="loc1", name="Loc 1", availability_start=date(2024, 3, 1), availability_end=date(2024, 3, 5), cost_per_day=500)
    ]
    equipment = [
        SolverEquipment(id="e1", name="Camera", quantity=1, cost_per_day=200)
    ]
    budget = SolverBudget(total_limit=5000)

    result = solve_schedule(scenes, cast, locations, equipment, budget, start_date=date(2024, 3, 1))
    
    assert result.feasible is True
    assert len(result.schedule) == 2
    assert result.num_shoot_days >= 1
    assert result.total_cost > 0


def test_solver_infeasible_narrow_window():
    scenes = [
        SolverScene(id="s1", scene_number=1, title="Scene 1", duration_minutes=60, location_id="loc1", cast_member_ids=["c1", "c2"]),
    ]
    cast = [
        # c1 and c2 have no overlapping days
        SolverCastMember(id="c1", name="Actor 1", availability_start=date(2024, 3, 1), availability_end=date(2024, 3, 2), cost_per_day=100),
        SolverCastMember(id="c2", name="Actor 2", availability_start=date(2024, 3, 4), availability_end=date(2024, 3, 5), cost_per_day=100)
    ]
    locations = [
        SolverLocation(id="loc1", name="Loc 1", availability_start=date(2024, 3, 1), availability_end=date(2024, 3, 10), cost_per_day=500)
    ]
    equipment = []
    budget = SolverBudget(total_limit=5000)

    result = solve_schedule(scenes, cast, locations, equipment, budget, start_date=date(2024, 3, 1))
    
    assert result.feasible is False
    assert len(result.schedule) == 0
    assert len(result.violations) > 0


def test_solver_relaxed_becomes_feasible():
    scenes = [
        SolverScene(id="s1", scene_number=1, title="Scene 1", duration_minutes=60, location_id="loc1", cast_member_ids=["c1", "c2"]),
    ]
    cast = [
        SolverCastMember(id="c1", name="Actor 1", availability_start=date(2024, 3, 1), availability_end=date(2024, 3, 2), cost_per_day=100),
        SolverCastMember(id="c2", name="Actor 2", availability_start=date(2024, 3, 4), availability_end=date(2024, 3, 5), cost_per_day=100)
    ]
    locations = [
        SolverLocation(id="loc1", name="Loc 1", availability_start=date(2024, 3, 1), availability_end=date(2024, 3, 10), cost_per_day=500)
    ]
    equipment = []
    budget = SolverBudget(total_limit=5000)

    # Relax c2's availability constraint
    relaxed = ["actor_availability:c2"]

    result = solve_schedule(scenes, cast, locations, equipment, budget, relaxed_constraints=relaxed, start_date=date(2024, 3, 1))
    
    assert result.feasible is True
    assert len(result.schedule) == 1
