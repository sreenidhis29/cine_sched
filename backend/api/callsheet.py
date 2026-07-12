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
