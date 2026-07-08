"""
Solver tool for CineSched — wraps cp_sat_scheduler.solve_schedule()
as a LangGraph-compatible tool with typed Pydantic I/O.
"""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from pydantic import BaseModel

from models.schemas import (
    SolverBudget,
    SolverCastMember,
    SolverEquipment,
    SolverLocation,
    SolverResult,
    SolverScene,
)
from solver.cp_sat_scheduler import solve_schedule


class RunSolverInput(BaseModel):
    scenes: List[SolverScene]
    cast: List[SolverCastMember]
    locations: List[SolverLocation]
    equipment: List[SolverEquipment]
    budget: SolverBudget
    relaxed_constraints: List[str] = []
    start_date: Optional[date] = None
    max_shoot_days: Optional[int] = None


def run_solver(inp: RunSolverInput) -> SolverResult:
    """
    Invoke the CP-SAT scheduling solver with the current project data.

    This is the ONLY mechanism that computes scheduling feasibility.
    LLM agents must never attempt to compute or infer a schedule —
    they only decide what constraints to relax and then call this tool.

    Returns a SolverResult (always, never raises).
    """
    return solve_schedule(
        scenes=inp.scenes,
        cast=inp.cast,
        locations=inp.locations,
        equipment=inp.equipment,
        budget=inp.budget,
        relaxed_constraints=inp.relaxed_constraints,
        start_date=inp.start_date,
        max_shoot_days=inp.max_shoot_days,
    )
