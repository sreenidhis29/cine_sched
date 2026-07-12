"""
API for Call Sheets
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import Optional
from pathlib import Path
import os

from api.auth import get_current_user_id
from api.projects import _require_project
from db.models import Schedule, Scene, CastMember
from db.session import get_db

from pdf.call_sheet_generator import generate_call_sheet

router = APIRouter()

@router.get("/{project_id}/callsheet/{day}")
def get_call_sheet(
    project_id: str,
    day: int,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Download the full call sheet for a specific day."""
    p = _require_project(project_id, user_id, db)
    
    # Get the latest accepted schedule
    schedule = db.query(Schedule).filter(Schedule.project_id == project_id, Schedule.is_accepted == True).order_by(Schedule.created_at.desc()).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="No accepted schedule found for this project")
        
    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    cast = db.query(CastMember).filter(CastMember.project_id == project_id).all()
    
    pdf_path = generate_call_sheet(p, schedule, day, scenes, cast)
    
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=500, detail="Failed to generate PDF")
        
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
        
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=callsheet_day_{day}.pdf"}
    )


@router.get("/{project_id}/callsheet/{day}/me")
def get_personal_call_sheet(
    project_id: str,
    day: int,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Download the personal call sheet for a specific day (filtered by user)."""
    p = _require_project(project_id, user_id, db)
    
    schedule = db.query(Schedule).filter(Schedule.project_id == project_id, Schedule.is_accepted == True).order_by(Schedule.created_at.desc()).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="No accepted schedule found for this project")
        
    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    cast = db.query(CastMember).filter(CastMember.project_id == project_id).all()
    
    pdf_path = generate_call_sheet(p, schedule, day, scenes, cast, user_id=user_id)
    
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=500, detail="Failed to generate PDF")
        
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
        
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=my_callsheet_day_{day}.pdf"}
    )


@router.get("/{project_id}/production-book/pdf")
def get_production_book(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Download the full Production Book combining all shoot days, route plans, and budgets."""
    p = _require_project(project_id, user_id, db)
    
    # Get the latest accepted schedule
    schedule = db.query(Schedule).filter(Schedule.project_id == project_id, Schedule.is_accepted == True).order_by(Schedule.created_at.desc()).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="No accepted schedule found for this project")
        
    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    cast = db.query(CastMember).filter(CastMember.project_id == project_id).all()
    
    # Query latest route plan and budget plan
    from db.models import PlannerRun
    route_run = db.query(PlannerRun).filter(PlannerRun.project_id == project_id, PlannerRun.plan_type == "route").order_by(PlannerRun.created_at.desc()).first()
    budget_run = db.query(PlannerRun).filter(PlannerRun.project_id == project_id, PlannerRun.plan_type == "budget").order_by(PlannerRun.created_at.desc()).first()
    
    route_plan = route_run.result_json if route_run else None
    budget_plan = budget_run.result_json if budget_run else None
    
    from pdf.production_book_generator import generate_production_book
    pdf_path = generate_production_book(p, schedule, scenes, cast, route_plan, budget_plan)
    
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=500, detail="Failed to generate Production Book PDF")
        
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
        
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=production_book_{project_id}.pdf"}
    )

