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
    SceneEquipment, scene_cast_table,
)
from db.session import get_db
from models.schemas import (
    BudgetCreate, BudgetResponse, BudgetUpdate,
    CastMemberCreate, CastMemberResponse, CastMemberUpdate,
    EquipmentCreate, EquipmentResponse, EquipmentUpdate,
    LocationCreate, LocationResponse, LocationUpdate,
    ProjectCreate, ProjectResponse, ProjectUpdate,
    SceneCreate, SceneResponse, SceneUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# PROJECT CRUD
# ─────────────────────────────────────────────────────────────────────────────
@router.get("", response_model=List[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    return db.query(Project).filter(Project.owner_id == user_id).all()


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    project = Project(id=str(uuid4()), name=body.name, description=body.description, owner_id=user_id)
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
    p = db.query(Project).filter(Project.id == project_id, Project.owner_id == user_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    p = db.query(Project).filter(Project.id == project_id, Project.owner_id == user_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
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
    p = db.query(Project).filter(Project.id == project_id, Project.owner_id == user_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(p)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# LOCATION CRUD
# ─────────────────────────────────────────────────────────────────────────────
def _require_project(project_id: str, user_id: str, db: Session) -> Project:
    p = db.query(Project).filter(Project.id == project_id, Project.owner_id == user_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
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


# ─────────────────────────────────────────────────────────────────────────────
# CAST CRUD
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/{project_id}/cast", response_model=List[CastMemberResponse])
def list_cast(project_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    return db.query(CastMember).filter(CastMember.project_id == project_id).all()


@router.post("/{project_id}/cast", response_model=CastMemberResponse, status_code=201)
def create_cast(project_id: str, body: CastMemberCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    cm = CastMember(id=str(uuid4()), project_id=project_id, **body.model_dump())
    db.add(cm)
    db.commit()
    db.refresh(cm)
    return cm


@router.patch("/{project_id}/cast/{cast_id}", response_model=CastMemberResponse)
def update_cast(project_id: str, cast_id: str, body: CastMemberUpdate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    _require_project(project_id, user_id, db)
    cm = db.query(CastMember).filter(CastMember.id == cast_id, CastMember.project_id == project_id).first()
    if not cm:
        raise HTTPException(status_code=404, detail="Cast member not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(cm, k, v)
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
