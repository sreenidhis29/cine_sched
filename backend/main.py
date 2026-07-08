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

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CineSched API",
    description="Agentic film production scheduling platform",
    version="0.1.0",
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
app.include_router(auth_router,     prefix="/api/auth",     tags=["auth"])
app.include_router(projects_router, prefix="/api/projects", tags=["projects"])
app.include_router(schedule_router, prefix="/api/projects", tags=["schedule"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
