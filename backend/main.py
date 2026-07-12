"""
FastAPI application entry point for CineSched.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from api.auth import router as auth_router
from api.projects import router as projects_router
from api.schedule import router as schedule_router
from api.organizations import router as organizations_router
from api.callsheet import router as callsheet_router
from api.calendar import router as calendar_router
from api.script import router as script_router

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ─────────────────────────────────────────────────────────────────────
from contextlib import asynccontextmanager
from db.session import engine
from db.models import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables if they don't exist
    Base.metadata.create_all(bind=engine)

    # Safe DDL migration: add must_change_password if the column doesn't exist yet.
    # This handles existing databases that were created before this column was added.
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
                "must_change_password BOOLEAN NOT NULL DEFAULT FALSE"
            ))
            conn.commit()
        except Exception:
            pass  # Column already exists or DB doesn't support IF NOT EXISTS — safe to ignore

        # Phase 4: Add continuity_tags to scenes if not present
        try:
            conn.execute(text(
                "ALTER TABLE scenes ADD COLUMN IF NOT EXISTS "
                "continuity_tags JSON NOT NULL DEFAULT '[]'"
            ))
            conn.commit()
        except Exception:
            pass  # Already exists — safe to ignore

        # Phase 4: Add latitude and longitude to locations if not present
        try:
            conn.execute(text(
                "ALTER TABLE locations ADD COLUMN IF NOT EXISTS "
                "latitude DOUBLE PRECISION"
            ))
            conn.execute(text(
                "ALTER TABLE locations ADD COLUMN IF NOT EXISTS "
                "longitude DOUBLE PRECISION"
            ))
            conn.commit()
        except Exception:
            pass  # Already exists — safe to ignore

        # Phase 4: Add extra_context to schedules if not present
        try:
            conn.execute(text(
                "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS "
                "extra_context JSON NOT NULL DEFAULT '{}'"
            ))
            conn.commit()
        except Exception:
            pass  # Already exists — safe to ignore



    # Database seeding & clean-up
    from db.session import SessionLocal
    from db.models import User, Organization, OrgMember
    db = SessionLocal()
    try:
        # 1. Ensure Super Admin account exists (fixed credentials, never invite-provisioned)
        admin_email = "admin@cinesched.com"
        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            admin = User(
                email=admin_email,
                name="App Super Admin",
                role="admin",
                must_change_password=False,
            )
            admin.set_password("AdminPassword123")
            db.add(admin)
            db.commit()
            print("INFO: Super Admin user created (admin@cinesched.com / AdminPassword123)")

        # 2. Remove KVN placeholder data (legacy seed cleanup)
        kvn_user = db.query(User).filter(User.email == "kvn@prod.com").first()
        if kvn_user:
            db.delete(kvn_user)
            db.commit()
            print("INFO: Purged KVN user and all cascaded data")

        kvn_org = db.query(Organization).filter(Organization.name == "KVN's Productions").first()
        if kvn_org:
            db.delete(kvn_org)
            db.commit()
            print("INFO: Purged KVN's Productions organization")

        # NOTE: The previous retrofit that auto-created User accounts with "Password123"
        # for pending invites and cast members has been intentionally removed.
        # Per Phase 3 security policy, accounts are only provisioned when an admin
        # explicitly generates a per-person invite token (unique, cryptographically random).
        # Phase 5 will add email dispatch for invite tokens.

    except Exception as e:
        db.rollback()
        print(f"ERROR in lifespan DB setup: {e}")
    finally:
        db.close()

    yield

app = FastAPI(
    title="CineSched API",
    description="Agentic film production scheduling platform",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────────
# Allow localhost:3000 for local dev + a placeholder Vercel domain for later.
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    settings.FRONTEND_URL,
    "https://cinesched.vercel.app",          # placeholder — update in Phase 5
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(organizations_router, prefix="/api/organizations", tags=["Organizations"])
app.include_router(projects_router, prefix="/api/projects", tags=["Projects"])
app.include_router(schedule_router, prefix="/api/projects", tags=["Schedule"])
app.include_router(callsheet_router, prefix="/api/projects", tags=["Call Sheet"])
app.include_router(calendar_router, prefix="/api/calendar", tags=["Calendar"])
app.include_router(script_router, prefix="/api/projects", tags=["Script"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
