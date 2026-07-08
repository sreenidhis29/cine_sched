"""
LangGraph StateGraph for CineSched Phase 1.

Graph topology:
  parser → scheduler → [availability, constraint, budget] → critic
                                                              ↓
                                              (accepted or cap) → explainer → END
                                                              ↓
                                           (replan, iter < 4) → scheduler (loop)

Validation agents run in a sequential chain (LangGraph doesn't have native
parallel fan-out in LCEL-style graphs without extra orchestration, so we
chain them sequentially — each is fast and purely computational).
"""
from __future__ import annotations

import logging

from langgraph.graph import END, StateGraph

from agents.state import GraphState
from agents.parser_agent import parser_agent
from agents.scheduler_agent import scheduler_agent
from agents.availability_agent import availability_agent
from agents.constraint_agent import constraint_agent
from agents.budget_agent import budget_agent
from agents.critic_agent import critic_agent
from agents.explainer_agent import explainer_agent

logger = logging.getLogger(__name__)


def _critic_router(state: GraphState) -> str:
    """
    Conditional edge from critic_agent:
    - If accepted or no more retries → go to explainer.
    - Otherwise → go back to scheduler for another attempt.
    """
    if state.get("accepted") or state.get("reject_reason"):
        return "explainer"
    return "scheduler"


def build_graph() -> StateGraph:
    """Build and compile the CineSched scheduling LangGraph."""
    builder = StateGraph(GraphState)

    # ── Register nodes ──────────────────────────────────────────────────────
    builder.add_node("parser",       parser_agent)
    builder.add_node("scheduler",    scheduler_agent)
    builder.add_node("availability", availability_agent)
    builder.add_node("constraint",   constraint_agent)
    builder.add_node("budget",       budget_agent)
    builder.add_node("critic",       critic_agent)
    builder.add_node("explainer",    explainer_agent)

    # ── Define edges ────────────────────────────────────────────────────────
    builder.set_entry_point("parser")
    builder.add_edge("parser",       "scheduler")
    builder.add_edge("scheduler",    "availability")
    builder.add_edge("availability", "constraint")
    builder.add_edge("constraint",   "budget")
    builder.add_edge("budget",       "critic")

    # Conditional: critic → scheduler (replan) OR critic → explainer (done)
    builder.add_conditional_edges(
        "critic",
        _critic_router,
        {
            "scheduler": "scheduler",
            "explainer": "explainer",
        }
    )
    builder.add_edge("explainer", END)

    return builder.compile()


# Module-level compiled graph (imported by API endpoints)
scheduling_graph = build_graph()


def run_scheduling_pipeline(initial_state: GraphState) -> GraphState:
    """
    Run the full scheduling pipeline on the given initial state.
    Returns the final GraphState after all agents have run.
    """
    logger.info("Starting scheduling pipeline for project '%s'", initial_state.get("project_id"))
    final_state = scheduling_graph.invoke(initial_state)
    logger.info(
        "Pipeline complete: accepted=%s, explanation_len=%d",
        final_state.get("accepted"),
        len(final_state.get("final_explanation") or "")
    )
    return final_state
