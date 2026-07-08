"""
LangGraph GraphState for CineSched Phase 1 pipeline.
All agents read from and write to this shared state dict.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional, TypedDict

from models.schemas import (
    SolverBudget,
    SolverCastMember,
    SolverEntryResult,
    SolverEquipment,
    SolverLocation,
    SolverResult,
    SolverScene,
)


class GraphState(TypedDict, total=False):
    # ── Input data ───────────────────────────────────────────────────────────
    project_id: str
    scenes: List[SolverScene]
    cast: List[SolverCastMember]
    locations: List[SolverLocation]
    equipment: List[SolverEquipment]
    budget: SolverBudget
    start_date: Optional[date]

    # ── Solver state ─────────────────────────────────────────────────────────
    current_schedule: Optional[SolverResult]          # output of last solver run
    relaxed_constraints: List[str]                    # tokens like "actor_availability:<id>"

    # ── Validation state ─────────────────────────────────────────────────────
    violations: List[str]                             # all violations from all validators
    availability_violations: List[str]
    conflict_violations: List[str]
    budget_violations: List[str]
    budget_warnings: List[str]
    total_cost: float

    # ── Critic / control state ───────────────────────────────────────────────
    iteration_count: int
    accepted: bool                                    # True = schedule is final & accepted
    reject_reason: Optional[str]                      # set if critic gives up at cap

    # ── Output ───────────────────────────────────────────────────────────────
    final_explanation: Optional[str]

    # ── Pass-through metadata ────────────────────────────────────────────────
    whatif_question: Optional[str]                    # set for what-if runs
    extra_context: Optional[Dict[str, Any]]           # extensible for later phases
