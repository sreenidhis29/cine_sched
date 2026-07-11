from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import asc
from typing import List

from api.auth import get_current_user_id
from db.models import ScheduleEntry, Scene, CastMember, scene_cast_table, Schedule, User
from db.session import get_db

router = APIRouter()

@router.get("/me/schedule")
def get_my_schedule(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """
    Returns the authenticated user's personalized call sheet.

    Finds all scenes the user is a cast/crew member of, joined with the latest
    accepted/feasible schedule entries across all their projects.

    Lookup strategy (in order):
    1. CastMember rows where user_id == this user's id.
    2. CastMember rows where linked_email == this user's email (fallback for draft records
       before admin has clicked "Generate Invite", or for legacy data).
    """
    # Get user's email for linked_email fallback
    user = db.query(User).filter(User.id == user_id).first()
    user_email = user.email if user else None

    # 1. Find all cast member records linked to this user (by user_id OR linked_email)
    cm_query = db.query(CastMember)
    if user_email:
        from sqlalchemy import or_
        cast_members = cm_query.filter(
            or_(
                CastMember.user_id == user_id,
                CastMember.linked_email == user_email
            )
        ).all()
    else:
        cast_members = cm_query.filter(CastMember.user_id == user_id).all()

    if not cast_members:
        return []

    cast_ids = [cm.id for cm in cast_members]

    # Build a map of scene_id -> cast_role (the character/role name for this person)
    cast_role_map: dict = {}
    for cm in cast_members:
        cast_role_map[cm.id] = cm.role or ""

    # 2. Find all scenes these cast members are in
    scene_ids_query = db.query(scene_cast_table.c.scene_id).filter(
        scene_cast_table.c.cast_member_id.in_(cast_ids)
    )

    # 3. Get the latest feasible schedule per project
    schedules = db.query(Schedule).filter(Schedule.is_feasible == True).all()
    latest_schedules: dict = {}
    for s in schedules:
        if s.project_id not in latest_schedules:
            latest_schedules[s.project_id] = s
        else:
            if s.created_at > latest_schedules[s.project_id].created_at:
                latest_schedules[s.project_id] = s

    active_schedule_ids = [s.id for s in latest_schedules.values()]
    if not active_schedule_ids:
        return []

    # 4. Query ScheduleEntry for matching scenes
    entries = db.query(ScheduleEntry).join(Scene).filter(
        ScheduleEntry.schedule_id.in_(active_schedule_ids),
        ScheduleEntry.scene_id.in_(scene_ids_query)
    ).order_by(
        asc(ScheduleEntry.shoot_date),
        asc(ScheduleEntry.shoot_day),
        asc(ScheduleEntry.start_time)
    ).all()

    # 5. For each entry, determine which cast_role the user is playing
    results = []
    for entry in entries:
        # Find the cast member entry relevant to this scene
        relevant_cm = next(
            (cm for cm in cast_members if cm.project_id == entry.scene.project_id),
            None
        )
        cast_role = relevant_cm.role if relevant_cm else ""

        results.append({
            "project_name": entry.scene.project.name,
            "project_id": entry.scene.project_id,
            "scene_number": entry.scene.scene_number,
            "scene_title": entry.scene.title,
            "cast_role": cast_role,
            "shoot_day": entry.shoot_day,
            "shoot_date": str(entry.shoot_date) if entry.shoot_date else None,
            "start_time": entry.start_time.isoformat() if entry.start_time else None,
            "end_time": entry.end_time.isoformat() if entry.end_time else None,
            "location_name": entry.scene.location.name if entry.scene.location else "TBD",
        })

    return results

