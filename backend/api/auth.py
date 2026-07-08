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

logger = logging.getLogger(__name__)
router = APIRouter()

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
) -> str:
    """
    FastAPI dependency — validates the Supabase JWT and returns the user_id (sub claim).
    Raises 401 if the token is missing or invalid.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    token = credentials.credentials

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
async def get_me(user_id: str = Depends(get_current_user_id)):
    """Return the authenticated user's ID (smoke-test endpoint)."""
    return {"user_id": user_id}
