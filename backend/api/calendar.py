import json
import os
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from config import settings
from api.auth import get_current_user_id
from api.projects import _require_project
from db.models import Schedule, ScheduleEntry, Scene
from db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

SCOPES = ['https://www.googleapis.com/auth/calendar.events']
TOKEN_FILE = "/tmp/cinesched_calendar_tokens.json"

def get_flow():
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google Calendar API keys not configured.")
    
    # We create a client config dictionary on the fly
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "project_id": "cinesched",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=settings.GOOGLE_REDIRECT_URI
    )
    return flow

def load_token(user_id: str) -> dict:
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            tokens = json.load(f)
            return tokens.get(user_id)
    return None

def save_token(user_id: str, creds: dict):
    tokens = {}
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            tokens = json.load(f)
    tokens[user_id] = creds
    with open(TOKEN_FILE, "w") as f:
        json.dump(tokens, f)

@router.get("/auth")
def auth(user_id: str = Depends(get_current_user_id)):
    """Initiates the OAuth flow. Returns a URL for the frontend to redirect the user to."""
    flow = get_flow()
    auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline', state=user_id)
    return {"auth_url": auth_url}

@router.get("/callback")
def callback(state: str, code: str):
    """Handles the Google OAuth callback."""
    user_id = state
    flow = get_flow()
    flow.fetch_token(code=code)
    
    creds = flow.credentials
    creds_dict = {
        'token': creds.token,
        'refresh_token': creds.refresh_token,
        'token_uri': creds.token_uri,
        'client_id': creds.client_id,
        'client_secret': creds.client_secret,
        'scopes': creds.scopes
    }
    save_token(user_id, creds_dict)
    
    return RedirectResponse(url=f"{settings.FRONTEND_URL}?calendar_sync=success")

@router.post("/{project_id}/sync")
def sync_schedule(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Syncs the accepted schedule to the user's Google Calendar."""
    creds_dict = load_token(user_id)
    if not creds_dict:
        raise HTTPException(status_code=400, detail="Google Calendar not connected.")
    
    creds = Credentials.from_authorized_user_info(creds_dict)
    service = build('calendar', 'v3', credentials=creds)
    
    _require_project(project_id, user_id, db)
    
    schedule = db.query(Schedule).filter(Schedule.project_id == project_id, Schedule.is_accepted == True).order_by(Schedule.created_at.desc()).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="No accepted schedule found.")
        
    scenes = {str(s.id): s for s in db.query(Scene).filter(Scene.project_id == project_id).all()}
    
    # Simple sync: just create all day events for each shoot day
    # A robust sync would diff and update/delete existing events.
    day_events = {}
    for entry in schedule.entries:
        if entry.shoot_date:
            day_events.setdefault(entry.shoot_date, []).append(entry)
            
    if not day_events:
        raise HTTPException(status_code=400, detail="Schedule has no dates assigned (run pipeline with start_date).")
        
    events_created = 0
    for shoot_date, entries in day_events.items():
        summary = f"CineSched: Shoot Day {entries[0].shoot_day}"
        description = "Scenes: " + ", ".join([str(scenes[e.scene_id].scene_number) for e in entries if str(e.scene_id) in scenes])
        
        event = {
            'summary': summary,
            'description': description,
            'start': {
                'date': shoot_date.strftime("%Y-%m-%d"),
            },
            'end': {
                'date': shoot_date.strftime("%Y-%m-%d"),
            }
        }
        try:
            service.events().insert(calendarId='primary', body=event).execute()
            events_created += 1
        except Exception as e:
            logger.error(f"Calendar sync failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to sync with Google Calendar")
            
    return {"status": "ok", "events_created": events_created}
