"""
Schedule API endpoints:
  POST /projects/{id}/run      — run the LangGraph scheduling pipeline
  GET  /projects/{id}/schedule — retrieve the latest schedule
  POST /projects/{id}/whatif   — run what-if replan with a modified question
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from agents.graph import run_scheduling_pipeline
from agents.state import GraphState
from api.auth import get_current_user_id
from db.models import (
    Budget, CastMember, Equipment, Location, Project, Schedule,
    ScheduleEntry, Scene, SceneEquipment, ReasoningTrace
)
from db.session import get_db
from llm.router import chat as llm_chat, LLMRouterError
from models.schemas import (
    RunScheduleRequest, ScheduleResponse, SolverBudget, SolverCastMember,
    SolverEntryResult, SolverEquipment, SolverLocation, SolverScene,
    WhatIfRequest, WhatIfResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _build_solver_data(project_id: str, db: Session) -> tuple:
    """Load all project entities and convert to Solver* Pydantic models."""
    scenes_db   = db.query(Scene).filter(Scene.project_id == project_id).all()
    cast_db     = db.query(CastMember).filter(CastMember.project_id == project_id).all()
    locs_db     = db.query(Location).filter(Location.project_id == project_id).all()
    equip_db    = db.query(Equipment).filter(Equipment.project_id == project_id).all()
    budget_db   = db.query(Budget).filter(Budget.project_id == project_id).first()

    cast = [SolverCastMember(
        id=str(c.id),
        name=c.name,
        availability_start=c.availability_start,
        availability_end=c.availability_end,
        cost_per_day=float(c.cost_per_day or 0),
    ) for c in cast_db]

    locations = [SolverLocation(
        id=str(l.id),
        name=l.name,
        availability_start=l.availability_start,
        availability_end=l.availability_end,
        cost_per_day=float(l.cost_per_day or 0),
    ) for l in locs_db]

    equipment = [SolverEquipment(
        id=str(e.id),
        name=e.name,
        quantity=e.quantity or 1,
        cost_per_day=float(e.cost_per_day or 0),
    ) for e in equip_db]

    equip_map = {str(e.id): e for e in equip_db}

    scenes = []
    for s in scenes_db:
        # Load scene equipment requirements
        equip_requirements = {}
        for se_link in s.scene_equipment_links:
            equip_requirements[str(se_link.equipment_id)] = se_link.quantity_required

        scenes.append(SolverScene(
            id=str(s.id),
            scene_number=s.scene_number,
            title=s.title,
            duration_minutes=s.duration_minutes or 60,
            setting=s.setting or "INT",
            location_id=str(s.location_id) if s.location_id else None,
            cast_member_ids=[str(c.id) for c in s.cast_members],
            equipment_requirements=equip_requirements,
            continuity_tags=list(s.continuity_tags or []),
        ))

    budget = SolverBudget(
        total_limit=float(budget_db.total_limit) if budget_db else 999999,
        cast_cap=float(budget_db.cast_cap) if budget_db and budget_db.cast_cap else None,
        location_cap=float(budget_db.location_cap) if budget_db and budget_db.location_cap else None,
        equipment_cap=float(budget_db.equipment_cap) if budget_db and budget_db.equipment_cap else None,
    )

    # Phase 4: also return raw location DB records for coordinate extraction
    return scenes, cast, locations, equipment, budget, locs_db


def _save_schedule(
    project_id: str,
    final_state: GraphState,
    db: Session,
) -> Schedule:
    """Persist the pipeline result to the schedules table."""
    solver_result = final_state.get("current_schedule")
    run_id = final_state.get("run_id") or str(uuid4())

    # Delete old schedules for this project (keep latest only in Phase 1)
    db.query(Schedule).filter(Schedule.project_id == project_id).delete()

    schedule = Schedule(
        id=str(uuid4()),
        project_id=project_id,
        run_id=run_id,
        total_cost=final_state.get("total_cost", 0.0),
        is_feasible=bool(solver_result and solver_result.feasible),
        is_accepted=bool(final_state.get("accepted", False)),
        explanation=final_state.get("final_explanation"),
        violations=list(final_state.get("violations", [])),
        relaxations=list(final_state.get("relaxed_constraints", [])),
        iteration_count=final_state.get("iteration_count", 0),
        extra_context=final_state.get("extra_context") or {},
    )
    db.add(schedule)
    db.flush()

    # Save schedule entries
    if solver_result and solver_result.feasible:
        for entry in solver_result.schedule:
            se = ScheduleEntry(
                id=str(uuid4()),
                schedule_id=schedule.id,
                scene_id=entry.scene_id,
                shoot_day=entry.shoot_day,
            )
            db.add(se)
            
    # Phase 5: Create Approval record if needed
    if final_state.get("pending_approval"):
        from db.models import Approval
        approval = Approval(
            id=str(uuid4()),
            project_id=project_id,
            run_id=run_id,
            status="pending",
            threshold_reason=final_state.get("threshold_reason", "Requires manual approval")
        )
        db.add(approval)

    db.commit()
    db.refresh(schedule)
    return schedule


# ─────────────────────────────────────────────────────────────────────────────
# POST /projects/{id}/run
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/{project_id}/run", response_model=ScheduleResponse)
def run_schedule(
    project_id: str,
    body: RunScheduleRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Run the LangGraph scheduling pipeline for this project.
    Returns the resulting schedule (accepted or rejected with explanation).
    """
    from api.projects import _require_project
    p = _require_project(project_id, user_id, db)

    scenes, cast, locations, equipment, budget, locs_db = _build_solver_data(project_id, db)

    if not scenes:
        raise HTTPException(status_code=422, detail="Project has no scenes — add scenes before running.")

    # Phase 4: Determine shoot-base coordinates (Option 1: first location with lat/lon)
    # These are passed to weather_agent and travel_agent for forecast/routing checks.
    shoot_base_lat = None
    shoot_base_lon = None
    for loc_db in locs_db:
        if loc_db.latitude is not None and loc_db.longitude is not None:
            shoot_base_lat = float(loc_db.latitude)
            shoot_base_lon = float(loc_db.longitude)
            break

    # Phase 4: also pass lat/lon on SolverLocation objects for travel agent
    locations_with_coords = []
    for i, loc_db in enumerate(locs_db):
        sl = locations[i]
        # Attach coordinates as extra attributes the travel tool checks
        sl_dict = sl.model_dump()
        sl_dict["latitude"] = float(loc_db.latitude) if loc_db.latitude is not None else None
        sl_dict["longitude"] = float(loc_db.longitude) if loc_db.longitude is not None else None
        from models.schemas import SolverLocation as _SL
        locations_with_coords.append(_SL(**sl_dict))

    initial_state: GraphState = {
        "project_id":           project_id,
        "run_id":               str(uuid4()),
        "scenes":               scenes,
        "cast":                 cast,
        "locations":            locations_with_coords,
        "equipment":            equipment,
        "budget":               budget,
        "start_date":           body.start_date,
        "relaxed_constraints":  body.relaxed_constraints,
        "iteration_count":      0,
        # Phase 4: shoot-base coordinates for weather + geocoding agents
        "shoot_base_lat":       shoot_base_lat,
        "shoot_base_lon":       shoot_base_lon,
    }

    try:
        final_state = run_scheduling_pipeline(initial_state)
    except Exception as e:
        logger.exception("Scheduling pipeline failed for project %s", project_id)
        raise HTTPException(status_code=500, detail=f"Scheduling pipeline error: {e}")

    schedule = _save_schedule(project_id, final_state, db)
    
    # Phase 5: Trigger notification if pending approval
    if final_state.get("pending_approval"):
        from db.models import User
        from integrations.notifications import send_approval_request_email
        from config import settings
        
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            approval_link = f"{settings.FRONTEND_URL}/projects/{project_id}/approvals"
            send_approval_request_email(user.email, p.name, final_state.get("threshold_reason", ""), approval_link)
            
    return _schedule_to_response(schedule)


# ─────────────────────────────────────────────────────────────────────────────
# GET /projects/{id}/schedule
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{project_id}/schedule", response_model=ScheduleResponse)
def get_schedule(
    project_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    from api.projects import _require_project
    p = _require_project(project_id, user_id, db)

    schedule = (
        db.query(Schedule)
        .filter(Schedule.project_id == project_id)
        .order_by(Schedule.created_at.desc())
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="No schedule found — run the scheduler first.")

    return _schedule_to_response(schedule)


# ─────────────────────────────────────────────────────────────────────────────
# GET /projects/{id}/trace
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{project_id}/trace")
def get_trace(
    project_id: str,
    run_id: str = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get the reasoning trace for a specific schedule run."""
    from api.projects import _require_project
    p = _require_project(project_id, user_id, db)

    query = db.query(ReasoningTrace).filter(ReasoningTrace.project_id == project_id)
    if run_id:
        query = query.filter(ReasoningTrace.run_id == run_id)
    else:
        # If no run_id, grab the most recent run_id from schedules
        latest_schedule = db.query(Schedule).filter(Schedule.project_id == project_id).order_by(Schedule.created_at.desc()).first()
        if latest_schedule:
            query = query.filter(ReasoningTrace.run_id == latest_schedule.run_id)

    traces = query.order_by(ReasoningTrace.timestamp.asc()).all()

    return {
        "project_id": project_id,
        "run_id": run_id or (latest_schedule.run_id if 'latest_schedule' in locals() and latest_schedule else None),
        "traces": [
            {
                "id": str(t.id),
                "agent_name": t.agent_name,
                "timestamp": t.timestamp,
                "input_summary": t.input_summary,
                "output_summary": t.output_summary,
                "tool_calls": t.tool_calls,
                "duration_ms": t.duration_ms,
                "confidence": t.confidence,
            } for t in traces
        ]
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /projects/{id}/whatif
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/{project_id}/whatif", response_model=WhatIfResponse)
def whatif(
    project_id: str,
    body: WhatIfRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Process a natural-language what-if question by extracting constraint relaxations
    via the LLM router, then re-running the scheduling pipeline.
    """
    from api.projects import _require_project
    p = _require_project(project_id, user_id, db)

    scenes, cast, locations, equipment, budget = _build_solver_data(project_id, db)

    # Use LLM to interpret the what-if question into constraint relaxations
    cast_info = "\n".join(f"  id={c.id}, name={c.name}" for c in cast)
    loc_info  = "\n".join(f"  id={l.id}, name={l.name}" for l in locations)

    whatif_prompt = f"""
A film production coordinator asked this what-if question:
"{body.message}"

Available cast:
{cast_info}

Available locations:
{loc_info}

Based on this question, identify which constraints should be relaxed.
Return a brief explanation of how you interpreted the question and what changes will be made.
(The actual schedule re-computation will be done by the CP-SAT solver, not you.)
"""
    WHATIF_SYSTEM = (
        "You are a film scheduling assistant. Interpret what-if questions "
        "and explain what constraint changes they imply. Be concise and professional."
    )

    try:
        interpretation = llm_chat(
            messages=[{"role": "user", "content": whatif_prompt}],
            system_prompt=WHATIF_SYSTEM,
        )
    except LLMRouterError:
        interpretation = f"Processing: {body.message}"

    # Re-run pipeline with context from the what-if question
    initial_state: GraphState = {
        "project_id":           project_id,
        "run_id":               str(uuid4()),
        "scenes":               scenes,
        "cast":                 cast,
        "locations":            locations,
        "equipment":            equipment,
        "budget":               budget,
        "relaxed_constraints":  [],
        "iteration_count":      0,
        "whatif_question":      body.message,
        "extra_context":        {"whatif_interpretation": interpretation},
    }

    try:
        final_state = run_scheduling_pipeline(initial_state)
    except Exception as e:
        logger.exception("What-if pipeline failed for project %s", project_id)
        raise HTTPException(status_code=500, detail=f"What-if pipeline error: {e}")

    schedule = _save_schedule(project_id, final_state, db)
    explanation = (
        f"**What-if interpretation:** {interpretation}\n\n"
        f"**New schedule result:**\n{final_state.get('final_explanation', '')}"
    )

    return WhatIfResponse(
        schedule=_schedule_to_response(schedule),
        explanation=explanation,
    )


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _schedule_to_response(s: Schedule) -> ScheduleResponse:
    from models.schemas import ScheduleEntryResponse
    entries = [
        ScheduleEntryResponse(
            id=str(e.id),
            scene_id=str(e.scene_id),
            shoot_day=e.shoot_day,
            shoot_date=e.shoot_date,
            start_time=e.start_time,
            end_time=e.end_time,
        )
        for e in s.entries
    ]
    return ScheduleResponse(
        id=str(s.id),
        project_id=str(s.project_id),
        run_id=str(s.run_id),
        total_cost=float(s.total_cost or 0),
        is_feasible=bool(s.is_feasible),
        is_accepted=bool(s.is_accepted),
        explanation=s.explanation,
        violations=list(s.violations or []),
        relaxations=list(s.relaxations or []),
        iteration_count=s.iteration_count or 0,
        entries=entries,
        extra_context=s.extra_context or {},
        created_at=s.created_at,
    )
