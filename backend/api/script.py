from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import uuid4
import io

from api.auth import get_current_user_id
from db.session import get_db
from db.models import Scene, CastMember, Location, Project, scene_cast_table, Equipment, SceneEquipment
from models.schemas import ScriptExtractionResult, ScriptCommitRequest, ExtractedBudget
from llm.router import structured_call, LLMRouterError
from agents.location_suggestion_agent import suggest_locations_for_scenes

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

router = APIRouter()

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
    You are an expert script supervisor and production accountant.
    Read the following production document (which may be a screenplay, a production brief,
    or a combined document) and extract two types of information:

    --- PART 1: SCREENPLAY BREAKDOWN ---
    1. A list of all unique cast members and their roles.
    2. A list of all unique equipment packages or items mentioned or logically required
       (e.g. Steadicam, Drone, HMI Lighting Package, Camera Package) along with estimated
       quantity and cost_per_day (default cost_per_day to standard rates, e.g., camera: $800,
       lighting: $400, steadicam: $300, sound: $250, drone: $600).
    3. A list of all scenes. For each scene, provide:
       - scene_number (integer)
       - title (short description, e.g. "EXT. COFFEE SHOP")
       - setting (INT or EXT)
       - time_of_day (DAY or NIGHT)
       - location_name (e.g. "COFFEE SHOP")
       - duration_minutes (estimated duration to shoot, assume 1 page = 120 minutes of shooting
         as a baseline, or estimate reasonably)
       - cast_names (list of cast names present in the scene)
       - equipment_names (list of unique equipment names required for this scene, matching the
         unique equipment list above)
    4. A list of all unique shoot locations explicitly mentioned in the document (including
       those listed with addresses, notes, or coordinates in a Locations or Production Brief section).
       For each location, extract:
       - name: the name of the location (e.g., "Studio A (Main Stage)")
       - address: the street address if mentioned (e.g. "120 Stage Road, Toronto, ON")
       - latitude: the latitude coordinate if explicitly mentioned (e.g. 43.6532, as a float or null)
       - longitude: the longitude coordinate if explicitly mentioned (e.g. -79.3832, as a float or null)
       - cost_per_day: the rental cost per day if explicitly mentioned (as a float or 0.0)

    --- PART 2: BUDGET FIGURES ---
    Look for any Budget table or section in the document. Budget sections typically have
    category rows with dollar amounts, e.g.:
      - "Cast (day rates + principals)"  -> cast_cap
      - "Locations (rental + permits)"   -> location_cap
      - "Equipment (camera, lighting, sound)" -> equipment_cap
      - "Makeup / Prosthetics / Stunts"  -> makeup_cap
      - "Overtime / Contingency Buffer" or "Contingency" -> contingency_cap
      - "TOTAL PRODUCTION BUDGET" or "Total" -> total_limit
    Map only figures explicitly stated in the document to the correct fields.
    IMPORTANT: If no budget section is present, output extracted_budget as null.
    Do NOT invent or estimate budget figures — only extract what is explicitly written.

    Output JSON with keys: scenes, cast_members, equipment, locations, extracted_budget.
    extracted_budget should be null if not found, otherwise an object with fields:
    total_limit, cast_cap, location_cap, equipment_cap, makeup_cap, contingency_cap
    (omit or set to null any category not found in the document).

    Document text:
    {text[:40000]}
    """
    
    try:
        extraction = structured_call(
            messages=[{"role": "user", "content": prompt}],
            schema=ScriptExtractionResult,
            system_prompt=(
                "Extract structured scenes, cast, locations, and budget figures from the document. "
                "Output valid JSON. For extracted_budget: return null if no budget section exists — "
                "never guess or invent dollar amounts."
            ),
            max_tokens=4000
        )
    except LLMRouterError as e:
        raise HTTPException(status_code=500, detail=f"LLM extraction failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing response: {str(e)}")

    # Phase 4: Generate real-world location suggestions for scenes (review-gated, never auto-committed)
    # Use the first geocoded project location as the shoot base for proximity search.
    # If no geocoded locations exist, suggestions are skipped gracefully.
    try:
        existing_locs = db.query(Location).filter(Location.project_id == project_id).all()
        existing_names = [loc.name for loc in existing_locs]

        # Find first location with coordinates
        shoot_base_lat = None
        shoot_base_lon = None
        for loc in existing_locs:
            if loc.latitude is not None and loc.longitude is not None:
                shoot_base_lat = float(loc.latitude)
                shoot_base_lon = float(loc.longitude)
                break

        if shoot_base_lat is not None and shoot_base_lon is not None:
            location_suggestions = suggest_locations_for_scenes(
                scenes=extraction.scenes,
                shoot_base_lat=shoot_base_lat,
                shoot_base_lon=shoot_base_lon,
                existing_location_names=existing_names,
            )
            # Convert int keys to strings for JSON serialization
            extraction.location_suggestions = {
                str(k): v for k, v in location_suggestions.items()
            }
        else:
            print("DEBUG location_suggestion_agent: no geocoded locations found — skipping suggestions")
    except Exception as e:
        # Non-fatal: suggestions are advisory only
        print(f"DEBUG location_suggestion_agent: error (non-fatal): {e}")

    return extraction


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

    from api.projects import extract_coords_from_text

    # First, create explicit locations extracted from the document
    if hasattr(body, 'locations') and body.locations:
        for loc in body.locations:
            if loc.name not in location_map:
                loc_id = str(uuid4())
                
                # If latitude/longitude are not provided by LLM, try to extract them from address or name
                lat = loc.latitude
                lon = loc.longitude
                if lat is None or lon is None:
                    text_to_search = f"{loc.name} {loc.address or ''}"
                    extracted_lat, extracted_lon = extract_coords_from_text(text_to_search)
                    if extracted_lat is not None and extracted_lon is not None:
                        lat, lon = extracted_lat, extracted_lon

                new_loc = Location(
                    id=loc_id,
                    project_id=project_id,
                    name=loc.name,
                    address=loc.address or "TBD",
                    latitude=lat,
                    longitude=lon,
                    cost_per_day=loc.cost_per_day or 0.0
                )
                db.add(new_loc)
                location_map[loc.name] = loc_id

    # Then, fallback for any scenes that reference locations not explicitly extracted
    for scene in body.scenes:
        if scene.location_name not in location_map:
            loc_id = str(uuid4())
            lat, lon = extract_coords_from_text(scene.location_name)
            new_loc = Location(
                id=loc_id,
                project_id=project_id,
                name=scene.location_name,
                address="TBD",
                latitude=lat,
                longitude=lon
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

    # ── Budget creation from extracted figures ────────────────────────────────
    # Only runs if the user passed back extracted_budget figures AND no Budget
    # record exists yet. An existing Budget row is NEVER silently overwritten.
    budget_created = False
    if body.extracted_budget is not None:
        eb = body.extracted_budget
        # Check at least one figure is non-null and non-zero
        has_any_figure = any(
            v is not None and v > 0
            for v in [
                eb.total_limit, eb.cast_cap, eb.location_cap,
                eb.equipment_cap, eb.makeup_cap, eb.contingency_cap,
            ]
        )
        if has_any_figure:
            from db.models import Budget
            existing_budget = db.query(Budget).filter(Budget.project_id == project_id).first()
            if existing_budget is None:
                new_budget = Budget(
                    project_id=project_id,
                    total_limit=eb.total_limit or 0,
                    cast_cap=eb.cast_cap,
                    location_cap=eb.location_cap,
                    equipment_cap=eb.equipment_cap,
                    makeup_cap=eb.makeup_cap,
                    contingency_cap=eb.contingency_cap,
                )
                db.add(new_budget)
                db.commit()
                budget_created = True
            else:
                print(
                    f"Budget record already exists for project {project_id} — "
                    "extracted figures not auto-applied (use Budget Monitor to update manually)."
                )

    return {
        "message": (
            f"Committed {len(body.scenes)} scenes, {len(body.cast_members)} cast members, "
            f"{len(equip_map)} equipment items, and {len(location_map)} locations."
            + (" Budget record created from extracted figures." if budget_created else "")
        ),
        # cast_members returned so the frontend review step can offer per-person invite buttons.
        # No accounts exist yet — they are created only when admin clicks "Generate Invite".
        "cast_members": new_cast_records,
        "budget_created": budget_created,
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

