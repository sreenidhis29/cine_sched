"""
SQLAlchemy ORM models for CineSched.
These mirror the Supabase Postgres schema defined in migrations/01_init.sql.
"""
from __future__ import annotations

import uuid
from datetime import date, time, datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Double, ForeignKey,
    Integer, JSON, Numeric, String, Text, Time, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    __allow_unmapped__ = True


def _uuid():
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────────────────────
# PROJECT
# ─────────────────────────────────────────────────────────────────────────────
class Project(Base):
    __tablename__ = "projects"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name        = Column(String, nullable=False)
    description = Column(Text)
    owner_id    = Column(UUID(as_uuid=False), nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # relationships
    locations       : List[Location]    = relationship("Location",    back_populates="project", cascade="all, delete-orphan")
    scenes          : List[Scene]       = relationship("Scene",       back_populates="project", cascade="all, delete-orphan")
    cast_members    : List[CastMember]  = relationship("CastMember",  back_populates="project", cascade="all, delete-orphan")
    equipment_items : List[Equipment]   = relationship("Equipment",   back_populates="project", cascade="all, delete-orphan")
    budget          : Optional[Budget]  = relationship("Budget",      back_populates="project", uselist=False, cascade="all, delete-orphan")
    schedules       : List[Schedule]    = relationship("Schedule",    back_populates="project", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────────────────────
# LOCATION
# ─────────────────────────────────────────────────────────────────────────────
class Location(Base):
    __tablename__ = "locations"

    id                  = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id          = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name                = Column(String, nullable=False)
    address             = Column(Text)
    latitude            = Column(Double)
    longitude           = Column(Double)
    availability_start  = Column(Date)
    availability_end    = Column(Date)
    cost_per_day        = Column(Numeric(10, 2), default=0)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    project : Project       = relationship("Project", back_populates="locations")
    scenes  : List[Scene]   = relationship("Scene",   back_populates="location")


# ─────────────────────────────────────────────────────────────────────────────
# CAST MEMBER
# ─────────────────────────────────────────────────────────────────────────────
class CastMember(Base):
    __tablename__ = "cast_members"

    id                  = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id          = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name                = Column(String, nullable=False)
    role                = Column(String)
    availability_start  = Column(Date)
    availability_end    = Column(Date)
    cost_per_day        = Column(Numeric(10, 2), default=0)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    project : Project       = relationship("Project", back_populates="cast_members")
    scenes  : List[Scene]   = relationship("Scene", secondary="scene_cast", back_populates="cast_members")


# ─────────────────────────────────────────────────────────────────────────────
# EQUIPMENT
# ─────────────────────────────────────────────────────────────────────────────
class Equipment(Base):
    __tablename__ = "equipment"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id      = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name            = Column(String, nullable=False)
    quantity        = Column(Integer, default=1)
    cost_per_day    = Column(Numeric(10, 2), default=0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    project : Project       = relationship("Project", back_populates="equipment_items")
    scenes  : List[Scene]   = relationship("Scene", secondary="scene_equipment", back_populates="equipment_items")


# ─────────────────────────────────────────────────────────────────────────────
# SCENE
# ─────────────────────────────────────────────────────────────────────────────
class Scene(Base):
    __tablename__ = "scenes"

    id                  = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id          = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    scene_number        = Column(Integer, nullable=False)
    title               = Column(String, nullable=False)
    description         = Column(Text)
    setting             = Column(String, default="INT")
    time_of_day         = Column(String, default="DAY")
    pages               = Column(Numeric(5, 2), default=1)
    duration_minutes    = Column(Integer, default=60)
    location_id         = Column(UUID(as_uuid=False), ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    project         : Project           = relationship("Project",    back_populates="scenes")
    location        : Optional[Location]= relationship("Location",   back_populates="scenes")
    cast_members    : List[CastMember]  = relationship("CastMember", secondary="scene_cast",      back_populates="scenes")
    equipment_items : List[Equipment]   = relationship("Equipment",  secondary="scene_equipment",  back_populates="scenes")
    scene_equipment_links               = relationship("SceneEquipment", back_populates="scene",   cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────────────────────
# JUNCTION TABLES
# ─────────────────────────────────────────────────────────────────────────────
from sqlalchemy import Table  # noqa: E402 — imported here to avoid circular issues

scene_cast_table = Table(
    "scene_cast",
    Base.metadata,
    Column("scene_id",       UUID(as_uuid=False), ForeignKey("scenes.id",       ondelete="CASCADE"), primary_key=True),
    Column("cast_member_id", UUID(as_uuid=False), ForeignKey("cast_members.id", ondelete="CASCADE"), primary_key=True),
)


class SceneEquipment(Base):
    """Junction with extra data (quantity_required)."""
    __tablename__ = "scene_equipment"

    scene_id            = Column(UUID(as_uuid=False), ForeignKey("scenes.id",     ondelete="CASCADE"), primary_key=True)
    equipment_id        = Column(UUID(as_uuid=False), ForeignKey("equipment.id",  ondelete="CASCADE"), primary_key=True)
    quantity_required   = Column(Integer, default=1)

    scene     : Scene     = relationship("Scene",     back_populates="scene_equipment_links")
    equipment : Equipment = relationship("Equipment")


# ─────────────────────────────────────────────────────────────────────────────
# BUDGET
# ─────────────────────────────────────────────────────────────────────────────
class Budget(Base):
    __tablename__ = "budgets"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id      = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True)
    total_limit     = Column(Numeric(12, 2), nullable=False, default=0)
    cast_cap        = Column(Numeric(12, 2))
    location_cap    = Column(Numeric(12, 2))
    equipment_cap   = Column(Numeric(12, 2))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    project : Project = relationship("Project", back_populates="budget")


# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULE
# ─────────────────────────────────────────────────────────────────────────────
class Schedule(Base):
    __tablename__ = "schedules"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id      = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    run_id          = Column(UUID(as_uuid=False), default=_uuid, nullable=False)
    total_cost      = Column(Numeric(12, 2))
    is_feasible     = Column(Boolean, default=False)
    is_accepted     = Column(Boolean, default=False)
    explanation     = Column(Text)
    violations      = Column(JSON, default=list)
    relaxations     = Column(JSON, default=list)
    iteration_count = Column(Integer, default=0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    project : Project               = relationship("Project",       back_populates="schedules")
    entries : List[ScheduleEntry]   = relationship("ScheduleEntry", back_populates="schedule", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULE ENTRY
# ─────────────────────────────────────────────────────────────────────────────
class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    schedule_id = Column(UUID(as_uuid=False), ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False)
    scene_id    = Column(UUID(as_uuid=False), ForeignKey("scenes.id",    ondelete="CASCADE"), nullable=False)
    shoot_day   = Column(Integer, nullable=False)
    shoot_date  = Column(Date)
    start_time  = Column(Time)
    end_time    = Column(Time)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    schedule : Schedule = relationship("Schedule", back_populates="entries")
    scene    : Scene    = relationship("Scene")


# ─────────────────────────────────────────────────────────────────────────────
# REASONING TRACE (PHASE 2)
# ─────────────────────────────────────────────────────────────────────────────
class ReasoningTrace(Base):
    __tablename__ = "reasoning_trace"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id      = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    run_id          = Column(UUID(as_uuid=False), nullable=False)
    agent_name      = Column(String, nullable=False)
    timestamp       = Column(DateTime(timezone=True), server_default=func.now())
    input_summary   = Column(Text)
    output_summary  = Column(Text)
    tool_calls      = Column(JSON, default=list)
    duration_ms     = Column(Integer)
    confidence      = Column(String(20), default="medium")

    project : Project = relationship("Project")


# ─────────────────────────────────────────────────────────────────────────────
# AGENT MEMORY (PHASE 2)
# ─────────────────────────────────────────────────────────────────────────────
class AgentMemory(Base):
    __tablename__ = "agent_memory"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id      = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    decision_type   = Column(String, nullable=False)
    context         = Column(JSON, default=dict)
    outcome         = Column(Text)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    project : Project = relationship("Project")
