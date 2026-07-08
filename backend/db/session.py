"""
Database session management for CineSched backend.
Uses SQLAlchemy with a PostgreSQL connection (Supabase).
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,        # keeps connections alive through Supabase idle timeouts
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
