"""
Pydantic schemas for CineSched API request/response validation.
These are the data-transfer objects (DTOs) used in FastAPI endpoints.
"""
from __future__ import annotations

from datetime import date, time, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# LOCATION
# ─────────────────────────────────────────────────────────────────────────────
class LocationBase(BaseModel):
    name: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    availability_start: Optional[date] = None
    availability_end: Optional[date] = None
    cost_per_day: float = 0.0


class LocationCreate(LocationBase):
    pass


class LocationUpdate(LocationBase):
    name: Optional[str] = None


class LocationResponse(LocationBase):
    id: str
    project_id: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# CAST MEMBER
# ─────────────────────────────────────────────────────────────────────────────
class CastMemberBase(BaseModel):
    name: str
    role: Optional[str] = None
    availability_start: Optional[date] = None
    availability_end: Optional[date] = None
    cost_per_day: float = 0.0


class CastMemberCreate(CastMemberBase):
    pass


class CastMemberUpdate(CastMemberBase):
    name: Optional[str] = None


class CastMemberResponse(CastMemberBase):
    id: str
    project_id: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# EQUIPMENT
# ─────────────────────────────────────────────────────────────────────────────
class EquipmentBase(BaseModel):
    name: str
    quantity: int = 1
    cost_per_day: float = 0.0


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(EquipmentBase):
    name: Optional[str] = None


class EquipmentResponse(EquipmentBase):
    id: str
    project_id: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# SCENE
# ─────────────────────────────────────────────────────────────────────────────
class SceneBase(BaseModel):
    scene_number: int
    title: str
    description: Optional[str] = None
    setting: str = "INT"            # INT | EXT | INT/EXT
    time_of_day: str = "DAY"        # DAY | NIGHT | DUSK | DAWN
    pages: float = 1.0
    duration_minutes: int = 60
    location_id: Optional[str] = None


class SceneCreate(SceneBase):
    cast_member_ids: List[str] = []
    equipment_ids: List[str] = []


class SceneUpdate(SceneBase):
    scene_number: Optional[int] = None
    title: Optional[str] = None
    cast_member_ids: Optional[List[str]] = None
    equipment_ids: Optional[List[str]] = None


class SceneResponse(SceneBase):
    id: str
    project_id: str
    cast_members: List[CastMemberResponse] = []
    equipment_items: List[EquipmentResponse] = []
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# BUDGET
# ─────────────────────────────────────────────────────────────────────────────
class BudgetBase(BaseModel):
    total_limit: float
    cast_cap: Optional[float] = None
    location_cap: Optional[float] = None
    equipment_cap: Optional[float] = None


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BudgetBase):
    total_limit: Optional[float] = None


class BudgetResponse(BudgetBase):
    id: str
    project_id: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# PROJECT
# ─────────────────────────────────────────────────────────────────────────────
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(ProjectBase):
    name: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: str
    owner_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULE ENTRY
# ─────────────────────────────────────────────────────────────────────────────
class ScheduleEntryResponse(BaseModel):
    id: str
    scene_id: str
    shoot_day: int
    shoot_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULE
# ─────────────────────────────────────────────────────────────────────────────
class ScheduleResponse(BaseModel):
    id: str
    project_id: str
    run_id: str
    total_cost: Optional[float] = None
    is_feasible: bool
    is_accepted: bool
    explanation: Optional[str] = None
    violations: List[str] = []
    relaxations: List[str] = []
    iteration_count: int
    entries: List[ScheduleEntryResponse] = []
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# SOLVER DATA MODELS (used internally between agents and solver)
# ─────────────────────────────────────────────────────────────────────────────
class SolverScene(BaseModel):
    id: str
    scene_number: int
    title: str
    duration_minutes: int
    location_id: Optional[str] = None
    cast_member_ids: List[str] = []
    equipment_requirements: dict = {}   # equipment_id -> quantity_required


class SolverCastMember(BaseModel):
    id: str
    name: str
    availability_start: Optional[date] = None
    availability_end: Optional[date] = None
    cost_per_day: float = 0.0


class SolverLocation(BaseModel):
    id: str
    name: str
    availability_start: Optional[date] = None
    availability_end: Optional[date] = None
    cost_per_day: float = 0.0


class SolverEquipment(BaseModel):
    id: str
    name: str
    quantity: int = 1
    cost_per_day: float = 0.0


class SolverBudget(BaseModel):
    total_limit: float
    cast_cap: Optional[float] = None
    location_cap: Optional[float] = None
    equipment_cap: Optional[float] = None


class SolverEntryResult(BaseModel):
    scene_id: str
    shoot_day: int


class SolverResult(BaseModel):
    feasible: bool
    schedule: List[SolverEntryResult] = []
    total_cost: float = 0.0
    violations: List[str] = []
    num_shoot_days: int = 0


# ─────────────────────────────────────────────────────────────────────────────
# API REQUEST / RESPONSE HELPERS
# ─────────────────────────────────────────────────────────────────────────────
class RunScheduleRequest(BaseModel):
    start_date: Optional[date] = None   # if provided, map shoot_day -> calendar date
    relaxed_constraints: List[str] = []


class WhatIfRequest(BaseModel):
    message: str                        # natural-language what-if question


class WhatIfResponse(BaseModel):
    schedule: Optional[ScheduleResponse] = None
    explanation: str
