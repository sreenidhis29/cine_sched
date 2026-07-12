"""
Auth utilities for CineSched.
Validates Supabase JWT tokens on incoming requests.
"""
from __future__ import annotations

import logging
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings
from db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

bearer_scheme = HTTPBearer(auto_error=False)


from fastapi import Request

def get_current_user_id(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
) -> str:
    """
    FastAPI dependency — validates the Supabase JWT and returns the user_id (sub claim).
    Raises 401 if the token is missing or invalid.
    """
    token = None
    if credentials:
        token = credentials.credentials
    elif request.query_params.get("token"):
        token = request.query_params.get("token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    try:
        # Supabase JWTs are HS256-signed with the project JWT secret.
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},   # Supabase doesn't always set aud
        )
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing sub claim",
            )
        return user_id

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        )


@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user_id), project_id: Optional[str] = None, db = Depends(get_db)):
    """Return the authenticated user's profile and org memberships."""
    from db.models import User, OrgMember, ProjectMember
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    org_memberships = db.query(OrgMember).filter(OrgMember.user_id == user_id, OrgMember.status == "active").all()
    orgs = [{"org_id": str(m.org_id), "org_role": m.org_role, "org_name": m.organization.name} for m in org_memberships]
    
    # Project specific role overrides
    project_role = None
    if project_id:
        pm = db.query(ProjectMember).filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id).first()
        if pm and pm.project_role:
            project_role = pm.project_role
        else:
            # Fallback to org role
            for o in orgs:
                # Find if the project belongs to one of their orgs
                from db.models import Project
                proj = db.query(Project).filter(Project.id == project_id).first()
                if proj and str(proj.org_id) == o["org_id"]:
                    project_role = o["org_role"]
                    break
    
    return {
        "user_id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,  # Legacy global role (optional now)
        "organizations": orgs,
        "project_role": project_role
    }


from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

class LoginRequest(BaseModel):
    username: str
    password: str

class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = "Unknown"
    role: str = "Viewer"

@router.post("/signup")
def signup(
    signup_data: SignupRequest,
    db = Depends(get_db)
):
    from db.models import User
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == signup_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Create user
    user = User(email=signup_data.email, name=signup_data.name, role=signup_data.role)
    user.set_password(signup_data.password)
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    from db.models import Organization, OrgMember, Project, Budget
    
    # Check if there are any pending invites for this email
    pending_invites = db.query(OrgMember).filter(OrgMember.invited_email == signup_data.email, OrgMember.status == "pending").all()
    
    if pending_invites:
        for invite in pending_invites:
            invite.user_id = user.id
            invite.status = "active"
            invite.invited_email = None
        db.commit()
    else:
        # Create a personal organization for the new user
        import uuid
        org = Organization(id=str(uuid.uuid4()), name=f"{user.name}'s Productions", owner_user_id=user.id)
        db.add(org)
        db.flush()
        
        member = OrgMember(id=str(uuid.uuid4()), org_id=org.id, user_id=user.id, org_role="owner", status="active")
        db.add(member)
        db.commit()
        db.refresh(org)
        
        # Add a demo project inside their new organization
        demo_proj = Project(name="Demo Film Project", description="A sample project generated on signup.", org_id=org.id)
        db.add(demo_proj)
        db.flush()
        
        # Add demo budget
        b = Budget(project_id=demo_proj.id, total_limit=100000, cast_cap=40000, location_cap=30000, equipment_cap=20000)
        db.add(b)
        db.commit()

    # Also link any existing CastMember records that used this email
    from db.models import CastMember
    db.query(CastMember).filter(CastMember.linked_email == signup_data.email).update({"user_id": user.id})
    db.commit()

    # Generate token automatically so we can auto-login
    payload = {
        "sub": str(user.id),
        "aud": "authenticated",
        "role": "authenticated",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    
    token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
    
    return {"access_token": token, "token_type": "bearer", "user_id": str(user.id)}

@router.post("/token")
def login_for_access_token(
    login_data: LoginRequest,
    db = Depends(get_db)
):
    """
    Login endpoint that checks against the User table.
    Returns must_change_password=True when the account was provisioned via invite token,
    which signals the frontend to redirect to /change-password before proceeding.
    """
    try:
        from db.models import User
        user = db.query(User).filter(User.email == login_data.username).first()

        if not user or not user.check_password(login_data.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )

        payload = {
            "sub": str(user.id),
            "aud": "authenticated",
            "role": "authenticated",
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(days=7),
        }

        token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")

        return {
            "access_token": token,
            "token_type": "bearer",
            "must_change_password": bool(getattr(user, 'must_change_password', False)),
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    db = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Authenticated endpoint. Validates the current password (invite token) and replaces
    it with a new password chosen by the user. Clears must_change_password flag.
    """
    from db.models import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.check_password(body.current_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    user.set_password(body.new_password)
    user.must_change_password = False
    db.commit()
    return {"message": "Password changed successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/admin/summary")
def get_admin_summary(
    db = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    from db.models import User, Organization, OrgMember, Project
    # Verify current user is admin
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the App Super Admin can access this resource")
        
    orgs = db.query(Organization).all()
    users = db.query(User).all()
    
    org_list = []
    for o in orgs:
        projects = db.query(Project).filter(Project.org_id == o.id).all()
        members = db.query(OrgMember).filter(OrgMember.org_id == o.id).all()
        org_list.append({
            "id": str(o.id),
            "name": o.name,
            "owner": o.owner.email if o.owner else "N/A",
            "project_count": len(projects),
            "member_count": len(members)
        })
        
    user_list = []
    for u in users:
        memberships = db.query(OrgMember).filter(OrgMember.user_id == u.id).all()
        user_list.append({
            "id": str(u.id),
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "created_at": u.created_at,
            "organizations": [m.organization.name for m in memberships if m.organization]
        })
        
    return {
        "organizations": org_list,
        "users": user_list
    }

@router.delete("/admin/organizations/{org_id}")
def delete_organization_admin(
    org_id: str,
    db = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    from db.models import User, Organization
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the App Super Admin can perform this action")
        
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    db.delete(org)
    db.commit()
    return {"message": "Organization deleted successfully"}

@router.delete("/admin/users/{user_id}")
def delete_user_admin(
    user_id: str,
    db = Depends(get_db),
    user_id_operator: str = Depends(get_current_user_id)
):
    from db.models import User
    operator = db.query(User).filter(User.id == user_id_operator).first()
    if not operator or operator.role != "admin":
        raise HTTPException(status_code=403, detail="Only the App Super Admin can perform this action")
        
    if user_id == str(operator.id):
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(u)
    db.commit()
    return {"message": "User deleted successfully"}
