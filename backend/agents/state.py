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
    run_id: str
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
    pending_approval: bool                            # Phase 5: True if requires human review
    threshold_reason: Optional[str]                   # Phase 5: Reason for pending approval

    # ── Output ───────────────────────────────────────────────────────────────
    final_explanation: Optional[str]

    # ── Pass-through metadata ────────────────────────────────────────────────
    whatif_question: Optional[str]                    # set for what-if runs
    extra_context: Optional[Dict[str, Any]]           # extensible for later phases

    # ── Phase 4: Advisory (soft) violations ──────────────────────────────────
    # These do NOT trigger the replan loop — they are informational warnings only.
    weather_violations: List[str]                     # exterior scenes on high-risk weather days
    travel_violations: List[str]                      # unrealistic location jump between shoot days
    continuity_violations: List[str]                  # continuity-tagged scenes scheduled far apart

    # Phase 4: Shoot-base coordinates (Option 1: first geocoded project location)
    # Used by weather_agent for forecast lookup and location_suggestion_agent for search proximity.
    shoot_base_lat: Optional[float]
    shoot_base_lon: Optional[float]

    # Phase 4: Location suggestions from location_suggestion_agent
    # Dict[scene_id -> List[{name, address, lat, lon}]] -- suggestions only, never auto-committed.
    location_suggestions: Optional[Dict[str, Any]]
