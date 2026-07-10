"""
Parser agent — first node in the LangGraph pipeline.
Normalizes raw input data into a clean GraphState so downstream agents
can work with well-typed, consistent data.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any, Dict

from agents.state import GraphState
from agents.utils import write_trace, Timer
from models.schemas import (
    SolverBudget,
    SolverCastMember,
    SolverEquipment,
    SolverLocation,
    SolverScene,
)

logger = logging.getLogger(__name__)


def parser_agent(state: GraphState) -> GraphState:
    """
    Validate and normalize the GraphState inputs.
    - Ensure all lists are present (defaults to empty).
    - Ensure budget is set.
    - Initialize mutable state fields (relaxed_constraints, violations, etc.).
    - Log a summary of what's being scheduled.
    """
    scenes   = state.get("scenes", []) or []
    cast     = state.get("cast", []) or []
    locations= state.get("locations", []) or []
    equipment= state.get("equipment", []) or []
    budget   = state.get("budget") or SolverBudget(total_limit=0)

    with Timer() as t:
        logger.info(
            "parser_agent: %d scenes, %d cast, %d locations, %d equipment",
            len(scenes), len(cast), len(locations), len(equipment)
        )

        # Warn about scenes with unknown locations or cast
        loc_ids  = {l.id for l in locations}
        cast_ids = {c.id for c in cast}
        for s in scenes:
            if s.location_id and s.location_id not in loc_ids:
                logger.warning("Scene '%s' references unknown location_id '%s'", s.title, s.location_id)
            for cid in s.cast_member_ids:
                if cid not in cast_ids:
                    logger.warning("Scene '%s' references unknown cast_id '%s'", s.title, cid)

    if state.get("project_id") and state.get("run_id"):
        write_trace(
            project_id=state["project_id"],
            run_id=state["run_id"],
            agent_name="Parser Agent",
            input_summary="Raw input constraints and entities.",
            output_summary=f"Parsed {len(scenes)} scenes, {len(cast)} cast, {len(locations)} locations, {len(equipment)} equipment items.",
            tool_calls=[],
            duration_ms=t.duration_ms,
            confidence="high"
        )

    return {
        **state,
        "scenes":                scenes,
        "cast":                  cast,
        "locations":             locations,
        "equipment":             equipment,
        "budget":                budget,
        # Initialize / reset mutable state
        "relaxed_constraints":   state.get("relaxed_constraints") or [],
        "violations":            [],
        "availability_violations": [],
        "conflict_violations":   [],
        "budget_violations":     [],
        "budget_warnings":       [],
        "total_cost":            0.0,
        "iteration_count":       state.get("iteration_count", 0),
        "accepted":              False,
        "reject_reason":         None,
        "final_explanation":     None,
        "current_schedule":      state.get("current_schedule"),
    }
