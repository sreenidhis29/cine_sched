import logging
import time
from typing import Dict, Any, List, Optional
from db.session import SessionLocal
from db.models import ReasoningTrace, AgentMemory

logger = logging.getLogger(__name__)

def write_trace(
    project_id: str,
    run_id: str,
    agent_name: str,
    input_summary: str,
    output_summary: str,
    tool_calls: List[Dict[str, Any]],
    duration_ms: int,
    confidence: str = "medium"
):
    """Utility to write a trace entry for an agent."""
    db = SessionLocal()
    try:
        trace = ReasoningTrace(
            project_id=project_id,
            run_id=run_id,
            agent_name=agent_name,
            input_summary=input_summary,
            output_summary=output_summary,
            tool_calls=tool_calls,
            duration_ms=duration_ms,
            confidence=confidence
        )
        db.add(trace)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to write trace for {agent_name}: {e}")
    finally:
        db.close()


def read_agent_memory(project_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Utility to read the agent memory for a project."""
    db = SessionLocal()
    try:
        memories = db.query(AgentMemory).filter_by(project_id=project_id).order_by(AgentMemory.created_at.desc()).limit(limit).all()
        return [{"decision_type": m.decision_type, "context": m.context, "outcome": m.outcome, "created_at": m.created_at.isoformat()} for m in memories]
    except Exception as e:
        logger.error(f"Failed to read agent memory for project {project_id}: {e}")
        return []
    finally:
        db.close()


def write_agent_memory(
    project_id: str,
    decision_type: str,
    context: Dict[str, Any],
    outcome: str
):
    """Utility to write an agent memory entry."""
    db = SessionLocal()
    try:
        memory = AgentMemory(
            project_id=project_id,
            decision_type=decision_type,
            context=context,
            outcome=outcome
        )
        db.add(memory)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to write agent memory for project {project_id}: {e}")
    finally:
        db.close()

class Timer:
    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, *args):
        self.end = time.perf_counter()
        self.duration_ms = int((self.end - self.start) * 1000)
