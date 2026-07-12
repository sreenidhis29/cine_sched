"""
Projects API — CRUD for projects and all sub-resources.
All endpoints are scoped to the authenticated user via RLS at the DB layer.
"""
from __future__ import annotations

import json
import logging
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.auth import get_current_user_id
from db.models import (
    Budget, CastMember, Equipment, Location, Project, Scene,
    SceneEquipment, scene_cast_table, PlannerRun,
)
from db.session import get_db
from models.schemas import (
    BudgetCreate, BudgetResponse, BudgetUpdate,
    CastMemberCreate, CastMemberResponse, CastMemberUpdate,
    EquipmentCreate, EquipmentResponse, EquipmentUpdate,
    LocationCreate, LocationResponse, LocationUpdate,
    ProjectCreate, ProjectResponse, ProjectUpdate,
    SceneCreate, SceneResponse, SceneUpdate,
    RoutePlanRequest, RouteResult,
    ShootWindowPlanRequest, ShootWindowResult,
    BudgetPlanRequest, BudgetResult,
    PlannerRunResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# PROJECT CRUD
# ─────────────────────────────────────────────────────────────────────────────
@router.get("", response_model=List[ProjectResponse])
def list_projects(
    org_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    from db.models import OrgMember
    # Get all projects from orgs where the user is an active member
    org_ids = [m.org_id for m in db.query(OrgMember).filter(OrgMember.user_id == user_id, OrgMember.status == "active").all()]
    
    query = db.query(Project).filter(Project.org_id.in_(org_ids))
    if org_id:
        query = query.filter(Project.org_id == org_id)
        
    return query.all()


class ProjectCreateOrg(ProjectCreate):
    org_id: str

@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(
    body: ProjectCreateOrg,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    from db.models import OrgMember
    member = db.query(OrgMember).filter(OrgMember.org_id == body.org_id, OrgMember.user_id == user_id, OrgMember.status == "active").first()
    if not member or member.org_role not in ["owner", "admin", "producer", "line_producer"]:
        raise HTTPException(status_code=403, detail="Not authorized to create projects in this org")
        
    project = Project(id=str(uuid4()), name=body.name, description=body.description, org_id=body.org_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    return _require_project(project_id, user_id, db)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    p = _require_project(project_id, user_id, db)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    p = _require_project(project_id, user_id, db)
    db.delete(p)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# LOCATION CRUD
# ─────────────────────────────────────────────────────────────────────────────
def _require_project(project_id: str, user_id: str, db: Session) -> Project:
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
        
    from db.models import OrgMember
    member = db.query(OrgMember).filter(OrgMember.org_id == p.org_id, OrgMember.user_id == user_id, OrgMember.status == "active").first()
    if not member:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    return p


@router.get("/{project_id}/locations", response_model=List[LocationResponse])
def list_locations(project_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    return db.query(Location).filter(Location.project_id == project_id).all()


@router.post("/{project_id}/locations", response_model=LocationResponse, status_code=201)
def create_location(project_id: str, body: LocationCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    loc = Location(id=str(uuid4()), project_id=project_id, **body.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.post("/{project_id}/route-plan", response_model=RouteResult)
def run_route_plan(
    project_id: str,
    body: RoutePlanRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Run route optimization on project locations without persisting anything.
    """
    _require_project(project_id, user_id, db)
    
    locations = db.query(Location).filter(Location.project_id == project_id).all()
    if not locations:
        raise HTTPException(status_code=400, detail="Project has no locations to optimize.")
        
    from solver.route_optimizer import optimize_route
    from models.schemas import RouteResult
    try:
        result = optimize_route(
            locations=locations,
            trip_type=body.trip_type,
            start_location_id=body.start_location_id
        )
        
        # Persist run
        run = PlannerRun(
            project_id=project_id,
            plan_type="route",
            config_json=body.model_dump(),
            result_json=result.model_dump()
        )
        db.add(run)
        db.commit()
        
        return result
    except Exception as e:
        logger.error(f"Error optimizing route: {e}")
        raise HTTPException(status_code=500, detail=f"Route planning failed: {str(e)}")


@router.post("/{project_id}/shoot-window-plan", response_model=ShootWindowResult)
def run_shoot_window_plan(
    project_id: str,
    body: ShootWindowPlanRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Evaluate weather suitability for exterior locations.
    """
    _require_project(project_id, user_id, db)

    from solver.shoot_window_optimizer import get_exterior_locations, optimize_shoot_windows

    if body.location_ids is not None:
        # Load the specific locations requested
        locations = db.query(Location).filter(Location.id.in_(body.location_ids), Location.project_id == project_id).all()
    else:
        # Auto-derive exterior locations
        locations = get_exterior_locations(project_id, db)

    if not locations:
        raise HTTPException(status_code=400, detail="No locations selected or detected for shoot-window planning.")

    try:
        result = optimize_shoot_windows(
            locations=locations,
            date_range_days=min(16, max(1, body.date_range_days))
        )
        
        # Persist run
        run = PlannerRun(
            project_id=project_id,
            plan_type="shoot_window",
            config_json=body.model_dump(),
            result_json=result.model_dump()
        )
        db.add(run)
        db.commit()
        
        return result
    except Exception as e:
        logger.error(f"Error optimizing shoot windows: {e}")
        raise HTTPException(status_code=500, detail=f"Shoot-window planning failed: {str(e)}")


@router.post("/{project_id}/budget-plan", response_model=BudgetResult)
def run_budget_plan(
    project_id: str,
    body: BudgetPlanRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Run budget optimization breakdown based on active planners.
    """
    _require_project(project_id, user_id, db)

    from solver.budget_optimizer import compute_budget

    try:
        route_dict = body.route_plan.model_dump() if body.route_plan else None
        window_dict = body.shoot_window_plan.model_dump() if body.shoot_window_plan else None

        result = compute_budget(
            project_id=project_id,
            db=db,
            route_plan=route_dict,
            shoot_window_plan=window_dict,
            crew_hourly_rate=body.crew_hourly_rate
        )
        
        # Persist run
        run = PlannerRun(
            project_id=project_id,
            plan_type="budget",
            config_json=body.model_dump(),
            result_json=result.model_dump()
        )
        db.add(run)
        db.commit()
        
        return result
    except Exception as e:
        logger.error(f"Error computing budget breakdown: {e}")
        raise HTTPException(status_code=500, detail=f"Budget calculation failed: {str(e)}")


@router.get("/{project_id}/planner-runs", response_model=Optional[PlannerRunResponse])
def get_latest_planner_run(
    project_id: str,
    plan_type: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get the most recent planner run of a given type.
    """
    _require_project(project_id, user_id, db)
    
    run = (
        db.query(PlannerRun)
        .filter(PlannerRun.project_id == project_id, PlannerRun.plan_type == plan_type)
        .order_by(PlannerRun.created_at.desc())
        .first()
    )
    return run


@router.patch("/{project_id}/locations/{loc_id}", response_model=LocationResponse)
def update_location(project_id: str, loc_id: str, body: LocationUpdate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    loc = db.query(Location).filter(Location.id == loc_id, Location.project_id == project_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(loc, k, v)
    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/{project_id}/locations/{loc_id}", status_code=204)
def delete_location(project_id: str, loc_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    loc = db.query(Location).filter(Location.id == loc_id, Location.project_id == project_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    db.delete(loc)
    db.commit()


@router.get("/{project_id}/locations/geocode", response_model=List[dict])
def geocode_location(
    project_id: str,
    q: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    _require_project(project_id, user_id, db)
    
    # Try to find shoot base coordinates for biasing (if any location has coords)
    locs = db.query(Location).filter(Location.project_id == project_id).all()
    near_lat = None
    near_lon = None
    for loc in locs:
        if loc.latitude is not None and loc.longitude is not None:
            near_lat = float(loc.latitude)
            near_lon = float(loc.longitude)
            break
            
    from integrations.geocoding_client import geocode_query
    results = geocode_query(q, near_lat=near_lat, near_lon=near_lon)
    return [
        {
            "name": r.name,
            "address": r.address,
            "lat": r.lat,
            "lon": r.lon
        } for r in results
    ]


# ─────────────────────────────────────────────────────────────────────────────
# CAST CRUD
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{project_id}/cast", response_model=List[CastMemberResponse])
def list_cast(project_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    return db.query(CastMember).filter(CastMember.project_id == project_id).all()


@router.post("/{project_id}/cast", response_model=CastMemberResponse)
def add_cast_member(
    project_id: str,
    body: CastMemberCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    _require_project(project_id, user_id, db)
    
    # Auto-link user_id if email exists
    linked_user_id = None
    if body.linked_email:
        from db.models import User
        user = db.query(User).filter(User.email == body.linked_email).first()
        if user:
            linked_user_id = user.id
            
    cm = CastMember(id=str(uuid4()), project_id=project_id, user_id=linked_user_id, **body.model_dump())
    db.add(cm)
    db.commit()
    db.refresh(cm)
    return cm


@router.patch("/{project_id}/cast/{cast_id}", response_model=CastMemberResponse)
def update_cast_member(
    project_id: str,
    cast_id: str,
    body: CastMemberUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    _require_project(project_id, user_id, db)
    cm = db.query(CastMember).filter(CastMember.id == cast_id, CastMember.project_id == project_id).first()
    if not cm:
        raise HTTPException(status_code=404, detail="Cast member not found")
        
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(cm, k, v)
        
    # Check linked_email updates
    if body.linked_email is not None:
        from db.models import User
        user = db.query(User).filter(User.email == body.linked_email).first()
        cm.user_id = user.id if user else None
        
    db.commit()
    db.refresh(cm)
    return cm


@router.delete("/{project_id}/cast/{cast_id}", status_code=204)
def delete_cast(project_id: str, cast_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    cm = db.query(CastMember).filter(CastMember.id == cast_id, CastMember.project_id == project_id).first()
    if not cm:
        raise HTTPException(status_code=404, detail="Cast member not found")
    db.delete(cm)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# EQUIPMENT CRUD
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{project_id}/equipment", response_model=List[EquipmentResponse])
def list_equipment(project_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    return db.query(Equipment).filter(Equipment.project_id == project_id).all()


@router.post("/{project_id}/equipment", response_model=EquipmentResponse, status_code=201)
def create_equipment(project_id: str, body: EquipmentCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    eq = Equipment(id=str(uuid4()), project_id=project_id, **body.model_dump())
    db.add(eq)
    db.commit()
    db.refresh(eq)
    return eq


@router.patch("/{project_id}/equipment/{eq_id}", response_model=EquipmentResponse)
def update_equipment(project_id: str, eq_id: str, body: EquipmentUpdate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    eq = db.query(Equipment).filter(Equipment.id == eq_id, Equipment.project_id == project_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(eq, k, v)
    db.commit()
    db.refresh(eq)
    return eq


@router.delete("/{project_id}/equipment/{eq_id}", status_code=204)
def delete_equipment(project_id: str, eq_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    eq = db.query(Equipment).filter(Equipment.id == eq_id, Equipment.project_id == project_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    db.delete(eq)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# SCENES CRUD
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{project_id}/scenes", response_model=List[SceneResponse])
def list_scenes(project_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    return db.query(Scene).filter(Scene.project_id == project_id).all()


@router.post("/{project_id}/scenes", response_model=SceneResponse, status_code=201)
def create_scene(project_id: str, body: SceneCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    data = body.model_dump()
    cast_ids = data.pop("cast_member_ids", [])
    equipment_ids = data.pop("equipment_ids", [])

    scene = Scene(id=str(uuid4()), project_id=project_id, **data)
    db.add(scene)
    db.flush()

    # Add cast relationships
    for cid in cast_ids:
        cm = db.query(CastMember).filter(CastMember.id == cid, CastMember.project_id == project_id).first()
        if cm:
            scene.cast_members.append(cm)

    # Add equipment relationships
    for eid in equipment_ids:
        eq = db.query(Equipment).filter(Equipment.id == eid, Equipment.project_id == project_id).first()
        if eq:
            se = SceneEquipment(scene_id=scene.id, equipment_id=eq.id, quantity_required=1)
            db.add(se)

    db.commit()
    db.refresh(scene)
    return scene


@router.patch("/{project_id}/scenes/{scene_id}", response_model=SceneResponse)
def update_scene(project_id: str, scene_id: str, body: SceneUpdate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    scene = db.query(Scene).filter(Scene.id == scene_id, Scene.project_id == project_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    data = body.model_dump(exclude_none=True)
    cast_ids = data.pop("cast_member_ids", None)
    equipment_ids = data.pop("equipment_ids", None)

    for k, v in data.items():
        setattr(scene, k, v)

    if cast_ids is not None:
        scene.cast_members = []
        for cid in cast_ids:
            cm = db.query(CastMember).filter(CastMember.id == cid).first()
            if cm:
                scene.cast_members.append(cm)

    if equipment_ids is not None:
        db.query(SceneEquipment).filter(SceneEquipment.scene_id == scene_id).delete()
        for eid in equipment_ids:
            se = SceneEquipment(scene_id=scene_id, equipment_id=eid, quantity_required=1)
            db.add(se)

    db.commit()
    db.refresh(scene)
    return scene


@router.delete("/{project_id}/scenes/{scene_id}", status_code=204)
def delete_scene(project_id: str, scene_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    scene = db.query(Scene).filter(Scene.id == scene_id, Scene.project_id == project_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    db.delete(scene)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# BUDGET
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{project_id}/budget", response_model=BudgetResponse)
def get_budget(project_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    b = db.query(Budget).filter(Budget.project_id == project_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not set for this project")
    return b


@router.put("/{project_id}/budget", response_model=BudgetResponse)
def upsert_budget(project_id: str, body: BudgetCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    b = db.query(Budget).filter(Budget.project_id == project_id).first()
    if b:
        for k, v in body.model_dump(exclude_none=True).items():
            setattr(b, k, v)
    else:
        b = Budget(id=str(uuid4()), project_id=project_id, **body.model_dump())
        db.add(b)
    db.commit()
    db.refresh(b)
    return b


# ─────────────────────────────────────────────────────────────────────────────
# PROJECT-LEVEL ROLE OVERRIDE
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel as _BaseModel

class ProjectRoleRequest(_BaseModel):
    project_role: Optional[str]  # None clears the override


@router.patch("/{project_id}/members/{target_user_id}/role")
def set_project_role(
    project_id: str,
    target_user_id: str,
    body: ProjectRoleRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Set (or clear) a project-specific role override for a user, separate from their org-wide role.
    Example: an org-level "crew" member can be set as "dop" specifically on one project.
    Restricted to org owners and admins.
    """
    from db.models import OrgMember, ProjectMember, Organization

    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # Confirm requester is org owner/admin
    requester_membership = db.query(OrgMember).filter(
        OrgMember.org_id == proj.org_id,
        OrgMember.user_id == user_id,
        OrgMember.status == "active",
    ).first()
    if not requester_membership or requester_membership.org_role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only org owners and admins can set project roles")

    # Confirm target user is an org member
    target_membership = db.query(OrgMember).filter(
        OrgMember.org_id == proj.org_id,
        OrgMember.user_id == target_user_id,
        OrgMember.status == "active",
    ).first()
    if not target_membership:
        raise HTTPException(status_code=404, detail="Target user is not a member of this organization")

    # Upsert ProjectMember row
    pm = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == target_user_id,
    ).first()

    if pm:
        pm.project_role = body.project_role
    else:
        pm = ProjectMember(
            id=str(uuid4()),
            project_id=project_id,
            user_id=target_user_id,
            project_role=body.project_role,
        )
        db.add(pm)

    db.commit()
    return {"status": "ok", "project_role": body.project_role}


@router.get("/{project_id}/members")
def get_project_members(
    project_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    List members who have been explicitly added to this project (ProjectMember rows).
    """
    p = _require_project(project_id, user_id, db)
    
    from db.models import ProjectMember, User, OrgMember
    project_members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    
    # Enrich with user info and their underlying org role
    results = []
    for pm in project_members:
        u = db.query(User).filter(User.id == pm.user_id).first()
        om = db.query(OrgMember).filter(OrgMember.org_id == p.org_id, OrgMember.user_id == pm.user_id).first()
        if u and om:
            results.append({
                "id": pm.id,
                "project_id": pm.project_id,
                "user_id": pm.user_id,
                "project_role": pm.project_role,
                "user_name": u.name,
                "user_email": u.email,
                "org_role": om.org_role
            })
            
    return results

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 5: APPROVALS
# ─────────────────────────────────────────────────────────────────────────────
from models.schemas import ApprovalResponse
from db.models import Approval, Schedule

@router.get("/{project_id}/approvals", response_model=List[ApprovalResponse])
def list_approvals(
    project_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    _require_project(project_id, user_id, db)
    approvals = db.query(Approval).filter(Approval.project_id == project_id).order_by(Approval.created_at.desc()).all()
    # Add approver name for UI convenience
    for a in approvals:
        if a.approver:
            a.approver_name = a.approver.name
    return approvals


@router.post("/{project_id}/approve/{run_id}", response_model=ApprovalResponse)
def approve_schedule(
    project_id: str,
    run_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    from datetime import datetime, timezone
    
    p = _require_project(project_id, user_id, db)
    # Check permissions
    from db.models import OrgMember, ProjectMember
    # Get project override or org role
    pm = db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id).first()
    om = db.query(OrgMember).filter(OrgMember.org_id == p.org_id, OrgMember.user_id == user_id, OrgMember.status == "active").first()
    
    role = pm.project_role if (pm and pm.project_role) else (om.org_role if om else None)
    if role not in ["owner", "admin", "producer", "line_producer"]:
        raise HTTPException(status_code=403, detail="Not authorized to approve schedules")

    approval = db.query(Approval).filter(Approval.project_id == project_id, Approval.run_id == run_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if approval.status != "pending":
        raise HTTPException(status_code=400, detail=f"Approval is already {approval.status}")

    # Mark as approved
    approval.status = "approved"
    approval.approved_by = user_id
    approval.approved_at = datetime.now(timezone.utc)

    # Mark schedule as accepted
    schedule = db.query(Schedule).filter(Schedule.project_id == project_id, Schedule.run_id == run_id).first()
    if schedule:
        schedule.is_accepted = True

    db.commit()
    db.refresh(approval)
    
    if approval.approver:
        approval.approver_name = approval.approver.name
        
    # Phase 5: Trigger schedule finalized email to the person who approved it
    from integrations.notifications import send_schedule_finalized_email
    from db.models import User
    from config import settings
    u = db.query(User).filter(User.id == user_id).first()
    if u:
        schedule_link = f"{settings.FRONTEND_URL}/projects/{project_id}/schedule"
        send_schedule_finalized_email(u.email, p.name, schedule_link)
        
    return approval


@router.post("/{project_id}/reject/{run_id}", response_model=ApprovalResponse)
def reject_schedule(
    project_id: str,
    run_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    from datetime import datetime, timezone
    
    p = _require_project(project_id, user_id, db)
    # Check permissions
    from db.models import OrgMember, ProjectMember
    pm = db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id).first()
    om = db.query(OrgMember).filter(OrgMember.org_id == p.org_id, OrgMember.user_id == user_id, OrgMember.status == "active").first()
    
    role = pm.project_role if (pm and pm.project_role) else (om.org_role if om else None)
    if role not in ["owner", "admin", "producer", "line_producer"]:
        raise HTTPException(status_code=403, detail="Not authorized to reject schedules")

    approval = db.query(Approval).filter(Approval.project_id == project_id, Approval.run_id == run_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if approval.status != "pending":
        raise HTTPException(status_code=400, detail=f"Approval is already {approval.status}")

    approval.status = "rejected"
    approval.approved_by = user_id
    approval.approved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(approval)
    
    if approval.approver:
        approval.approver_name = approval.approver.name
        
    return approval
