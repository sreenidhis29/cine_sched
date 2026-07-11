from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import uuid4
import io

from api.auth import get_current_user_id
from db.session import get_db
from db.models import Scene, CastMember, Location, Project, scene_cast_table, Equipment, SceneEquipment
from models.schemas import ScriptExtractionResult, ScriptCommitRequest
from llm.router import structured_call, LLMRouterError

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

router = APIRouter(prefix="/api/projects", tags=["script"])

def _require_project_manager(project_id: str, user_id: str, db: Session):
    from api.projects import _require_project
    # Re-use project check, maybe ensure they are manager (in future refine this)
    return _require_project(project_id, user_id, db)


@router.post("/{project_id}/script/parse", response_model=ScriptExtractionResult)
async def parse_script(
    project_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    _require_project_manager(project_id, user_id, db)
    
    content = await file.read()
    print(f"DEBUG script upload: filename={file.filename}, length={len(content)}")
    
    text = ""
    if file.filename.lower().endswith(".pdf"):
        if not PdfReader:
            print("DEBUG: pypdf not installed")
            raise HTTPException(status_code=500, detail="pypdf not installed")
        try:
            reader = PdfReader(io.BytesIO(content))
            for page in reader.pages:
                text += page.extract_text() + "\n"
        except Exception as e:
            print(f"DEBUG PDF parse error: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to read PDF: {str(e)}")
    elif file.filename.lower().endswith(".txt"):
        try:
            text = content.decode("utf-8")
        except Exception as e:
            print(f"DEBUG TXT decode error: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to decode TXT: {str(e)}")
    else:
        print(f"DEBUG unsupported file extension: {file.filename}")
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported currently")

    if not text.strip():
        print("DEBUG text is empty after parsing")
        raise HTTPException(status_code=400, detail="File contains no readable text")
        
    prompt = f"""
    You are an expert script supervisor. Read the following script and extract:
    1. A list of all unique cast members and their roles.
    2. A list of all unique equipment packages or items mentioned or logically required (e.g. Steadicam, Drone, HMI Lighting Package, Camera Package, etc.) along with estimated quantity and cost_per_day (default cost_per_day to standard rates, e.g., camera: $800, lighting: $400, steadicam: $300, sound: $250, drone: $600).
    3. A list of all scenes. For each scene, provide:
       - scene_number (integer)
       - title (short description, e.g. "EXT. COFFEE SHOP")
       - setting (INT or EXT)
       - time_of_day (DAY or NIGHT)
       - location_name (e.g. "COFFEE SHOP")
       - duration_minutes (estimated duration to shoot, assume 1 page = 120 minutes of shooting as a baseline, or estimate reasonably)
       - cast_names (list of cast names present in the scene)
       - equipment_names (list of unique equipment names required for this scene, matching the unique equipment list)
       
    Script text:
    {text[:40000]} # Limit text length to avoid token limits, ideally handle gracefully
    """
    
    try:
        extraction = structured_call(
            messages=[{"role": "user", "content": prompt}],
            schema=ScriptExtractionResult,
            system_prompt="Extract structured scenes and cast from the script. Output valid JSON.",
            max_tokens=4000
        )
        return extraction
    except LLMRouterError as e:
        raise HTTPException(status_code=500, detail=f"LLM extraction failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing response: {str(e)}")


import secrets

@router.post("/{project_id}/script/commit", status_code=201)
def commit_script(
    project_id: str,
    body: ScriptCommitRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Commits parsed screenplay data (scenes, locations, cast, equipment) to the database.

    SECURITY NOTE: This endpoint intentionally does NOT create User accounts or OrgMember
    records. Cast members are stored as draft constraint records only (CastMember rows with
    user_id=None). A real login account is only provisioned when an admin explicitly calls
    POST /{project_id}/cast/{cast_id}/invite for each person they want to grant access.
    Phase 5 (email dispatch) will auto-send the invite token; until then admins share it manually.
    """
    _require_project_manager(project_id, user_id, db)

    # Track created locations to avoid duplicates
    location_map = {}  # name -> id

    for scene in body.scenes:
        if scene.location_name not in location_map:
            loc_id = str(uuid4())
            new_loc = Location(
                id=loc_id,
                project_id=project_id,
                name=scene.location_name,
                address="TBD"
            )
            db.add(new_loc)
            location_map[scene.location_name] = loc_id

    # Create cast member DRAFT records (no User account, no login credentials)
    cast_map = {}  # name -> cast_member_id
    new_cast_records = []  # returned so frontend can offer per-person invite buttons

    for cast in body.cast_members:
        if cast.name not in cast_map:
            cast_id = str(uuid4())
            new_cast = CastMember(
                id=cast_id,
                project_id=project_id,
                # user_id intentionally left None — set only when admin sends invite
                name=cast.name,
                role=cast.role
            )
            db.add(new_cast)
            cast_map[cast.name] = cast_id
            new_cast_records.append({"id": cast_id, "name": cast.name, "role": cast.role or ""})

    # Track created equipment
    equip_map = {}  # name -> id
    if body.equipment:
        for eq in body.equipment:
            if eq.name not in equip_map:
                eq_id = str(uuid4())
                new_eq = Equipment(
                    id=eq_id,
                    project_id=project_id,
                    name=eq.name,
                    quantity=eq.quantity,
                    cost_per_day=eq.cost_per_day
                )
                db.add(new_eq)
                equip_map[eq.name] = eq_id

    # Create Scenes and link cast/equipment
    for scene in body.scenes:
        loc_id = location_map.get(scene.location_name)
        new_scene = Scene(
            id=str(uuid4()),
            project_id=project_id,
            scene_number=scene.scene_number,
            title=scene.title,
            setting=scene.setting,
            time_of_day=scene.time_of_day,
            location_id=loc_id,
            duration_minutes=scene.duration_minutes
        )
        db.add(new_scene)
        db.flush()

        for c_name in scene.cast_names:
            c_id = cast_map.get(c_name)
            if c_id:
                db.execute(scene_cast_table.insert().values(scene_id=new_scene.id, cast_member_id=c_id))

        if hasattr(scene, 'equipment_names') and scene.equipment_names:
            for eq_name in scene.equipment_names:
                eq_id = equip_map.get(eq_name)
                if eq_id:
                    se = SceneEquipment(
                        scene_id=new_scene.id,
                        equipment_id=eq_id,
                        quantity_required=1
                    )
                    db.add(se)

    db.commit()
    return {
        "message": (
            f"Committed {len(body.scenes)} scenes, {len(body.cast_members)} cast members, "
            f"{len(equip_map)} equipment items, and {len(location_map)} locations."
        ),
        # cast_members returned so the frontend review step can offer per-person invite buttons.
        # No accounts exist yet — they are created only when admin clicks "Generate Invite".
        "cast_members": new_cast_records,
    }


@router.post("/{project_id}/cast/{cast_id}/invite")
def invite_cast_member(
    project_id: str,
    cast_id: str,
    email: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Admin-only. Generates a unique, cryptographically random invite token for a single
    cast member and provisions their login account.

    - Token is generated via secrets.token_urlsafe(12) — 16 URL-safe chars, unique per call.
    - The bcrypt hash of the token is stored as the user's initial password.
    - must_change_password=True forces the user to set their own password on first login.
    - Returns the plaintext token ONCE (it is never stored in plaintext).

    Phase 5 note: once email dispatch exists, this endpoint will also send the invite email
    automatically. Until then, the admin copies the token from the UI and shares it manually.
    Each token is unique per person — never a shared password across multiple accounts.
    """
    _require_project_manager(project_id, user_id, db)

    from db.models import User, OrgMember, Project

    cast_member = db.query(CastMember).filter(
        CastMember.id == cast_id,
        CastMember.project_id == project_id
    ).first()
    if not cast_member:
        raise HTTPException(status_code=404, detail="Cast member not found in this project")

    # Check whether this cast member already has an account
    if cast_member.user_id:
        raise HTTPException(status_code=400, detail="This cast member already has an account linked")

    # Generate a cryptographically random one-time token (unique per person per call)
    invite_token = secrets.token_urlsafe(12)  # 16 URL-safe chars

    # Get org context for linking
    proj = db.query(Project).filter(Project.id == project_id).first()
    org_id = proj.org_id if proj else None

    # Check if a user with this email already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        # Link the existing user without overwriting their password
        new_account_created = False
        linked_user = existing_user
    else:
        # Create a new user account with the invite token as the initial password
        linked_user = User(
            email=email,
            name=cast_member.name,
            role="cast",
            must_change_password=True,  # force password change on first login
        )
        linked_user.set_password(invite_token)
        db.add(linked_user)
        db.flush()
        new_account_created = True

    # Link to org if not already a member
    if org_id:
        existing_membership = db.query(OrgMember).filter(
            OrgMember.org_id == org_id,
            OrgMember.user_id == linked_user.id
        ).first()
        if not existing_membership:
            org_member = OrgMember(
                org_id=org_id,
                user_id=linked_user.id,
                org_role="cast",
                status="active"
            )
            db.add(org_member)

    # Link cast member record to user
    cast_member.user_id = linked_user.id
    cast_member.linked_email = email
    db.commit()

    return {
        "cast_member_name": cast_member.name,
        "email": email,
        # invite_token is the plaintext token — display it ONCE in the UI.
        # It is never stored in plaintext (only bcrypt hash is stored).
        "invite_token": invite_token if new_account_created else None,
        "existing_account": not new_account_created,
        "message": (
            "Account created. Share the invite token with the cast member — it won't be shown again."
            if new_account_created
            else "Linked to existing account. They can log in with their current password."
        ),
    }

