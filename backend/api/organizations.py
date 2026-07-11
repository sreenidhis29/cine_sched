from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from api.auth import get_current_user_id
from db.models import Organization, OrgMember, User
from db.session import get_db
from models.schemas import OrganizationCreate, OrganizationResponse, OrganizationUpdate, OrgMemberResponse
from pydantic import BaseModel

router = APIRouter()

class InviteRequest(BaseModel):
    email: str
    role: str

@router.post("", response_model=OrganizationResponse, status_code=201)
def create_organization(body: OrganizationCreate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    org = Organization(id=str(uuid.uuid4()), name=body.name, owner_user_id=user_id)
    db.add(org)
    db.flush()
    
    # Add owner as an active member
    member = OrgMember(id=str(uuid.uuid4()), org_id=org.id, user_id=user_id, org_role="owner", status="active")
    db.add(member)
    db.commit()
    db.refresh(org)
    return org

@router.get("", response_model=List[OrganizationResponse])
def list_organizations(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    orgs = db.query(Organization).join(OrgMember, Organization.id == OrgMember.org_id).filter(OrgMember.user_id == user_id, OrgMember.status == "active").all()
    return orgs

@router.get("/{org_id}", response_model=OrganizationResponse)
def get_organization(org_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    member = db.query(OrgMember).filter(OrgMember.org_id == org_id, OrgMember.user_id == user_id, OrgMember.status == "active").first()
    if not member:
        raise HTTPException(status_code=403, detail="Not authorized to access this organization")
    return member.organization

@router.patch("/{org_id}", response_model=OrganizationResponse)
def update_organization(org_id: str, body: OrganizationUpdate, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    member = db.query(OrgMember).filter(OrgMember.org_id == org_id, OrgMember.user_id == user_id, OrgMember.status == "active").first()
    if not member or member.org_role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this organization")
    
    org = member.organization
    if body.name is not None:
        org.name = body.name
    db.commit()
    db.refresh(org)
    return org

@router.get("/{org_id}/members", response_model=List[OrgMemberResponse])
def list_org_members(org_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    member = db.query(OrgMember).filter(OrgMember.org_id == org_id, OrgMember.user_id == user_id, OrgMember.status == "active").first()
    if not member:
        raise HTTPException(status_code=403, detail="Not authorized to access this organization")
    
    members = db.query(OrgMember).filter(OrgMember.org_id == org_id).all()
    # Enrich with user data
    result = []
    for m in members:
        mr = OrgMemberResponse.model_validate(m)
        if m.user:
            mr.user_name = m.user.name
            mr.user_email = m.user.email
        elif m.invited_email:
            mr.user_email = m.invited_email
            mr.user_name = "Pending Invite"
        result.append(mr)
    return result

@router.post("/{org_id}/members/invite", response_model=OrgMemberResponse)
def invite_member(org_id: str, req: InviteRequest, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """
    Invite a new member to an organization by email.

    If no account exists for the email, a new User is created with:
    - A cryptographically random invite token (unique per call, never a shared password).
    - must_change_password=True — the user must set their own password on first login.
    The plaintext token is returned once in the response so the admin can share it.
    Phase 5 note: once email dispatch exists, this token will be sent via email automatically.
    """
    import secrets
    member = db.query(OrgMember).filter(OrgMember.org_id == org_id, OrgMember.user_id == user_id, OrgMember.status == "active").first()
    if not member or member.org_role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to invite members")

    # Check if user already exists in system
    existing_user = db.query(User).filter(User.email == req.email).first()

    invite_token = None
    if not existing_user:
        # Generate a unique, cryptographically random token (never a shared password).
        # Each invite generates a different token even for the same email called twice.
        invite_token = secrets.token_urlsafe(12)  # 16 URL-safe chars
        existing_user = User(
            email=req.email,
            name=req.email.split('@')[0].capitalize(),
            role=req.role,
            must_change_password=True,  # force password change on first login
        )
        existing_user.set_password(invite_token)
        db.add(existing_user)
        db.flush()

    # Check if they are already in the organization
    existing_member = db.query(OrgMember).filter(OrgMember.org_id == org_id, OrgMember.user_id == existing_user.id).first()
    if existing_member:
        # If they exist but were pending, activate them
        if existing_member.status == "pending":
            existing_member.status = "active"
            db.commit()
            db.refresh(existing_member)
            mr = OrgMemberResponse.model_validate(existing_member)
            mr.user_name = existing_user.name
            mr.user_email = existing_user.email
            return mr
        raise HTTPException(status_code=400, detail="User is already a member of this organization")

    new_member = OrgMember(
        id=str(uuid.uuid4()),
        org_id=org_id,
        user_id=existing_user.id,
        org_role=req.role,
        status="active"
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)

    mr = OrgMemberResponse.model_validate(new_member)
    mr.user_name = existing_user.name
    mr.user_email = existing_user.email
    # default_password field repurposed: now holds the one-time invite token (or None if existing account).
    mr.default_password = invite_token
    return mr

@router.delete("/{org_id}/members/{member_id}")
def remove_member(org_id: str, member_id: str, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    member = db.query(OrgMember).filter(OrgMember.org_id == org_id, OrgMember.user_id == user_id, OrgMember.status == "active").first()
    if not member or member.org_role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to remove members")
    
    target_member = db.query(OrgMember).filter(OrgMember.id == member_id, OrgMember.org_id == org_id).first()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    if target_member.org_role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner")
        
    db.delete(target_member)
    db.commit()
    return {"status": "success"}

@router.patch("/{org_id}/members/{member_id}")
def update_member_role(org_id: str, member_id: str, req: InviteRequest, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    member = db.query(OrgMember).filter(OrgMember.org_id == org_id, OrgMember.user_id == user_id, OrgMember.status == "active").first()
    if not member or member.org_role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit members")
        
    target_member = db.query(OrgMember).filter(OrgMember.id == member_id, OrgMember.org_id == org_id).first()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    if target_member.org_role == "owner" and req.role != "owner":
        raise HTTPException(status_code=400, detail="Cannot change owner role")
        
    target_member.org_role = req.role
    db.commit()
    return {"status": "success"}
