"""
LangGraph StateGraph for CineSched Phase 4.

Graph topology:
  parser → scheduler → [availability, constraint, budget] → weather_eval
                                                            → travel_eval
                                                            → continuity_eval
                                                            → critic
                                                               ↓
                                           (accepted or cap) → explainer → END
                                                               ↓
                                        (replan, iter < 4) → scheduler (loop)

Validation agents run in a sequential chain.

Phase 4 additions:
  - weather_eval: checks exterior scenes against Open-Meteo forecast (advisory only)
  - travel_eval:  checks driving time between consecutive locations (advisory only)
  - continuity_eval: checks continuity-tagged scenes that end up far apart (advisory only)

Advisory nodes produce soft violations that inform the schedule explanation but do NOT
trigger the replan loop. The critic_agent now distinguishes hard vs soft violations.
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
from agents.weather_agent import weather_agent
from agents.travel_agent import travel_agent
from agents.continuity_agent import continuity_agent
from agents.critic_agent import critic_agent
from agents.explainer_agent import explainer_agent

logger = logging.getLogger(__name__)


def _critic_router(state: GraphState) -> str:
    """
    Conditional edge from critic_agent:
    - If accepted, pending_approval, or no more retries → go to explainer.
    - Otherwise → go back to scheduler for another attempt.
    """
    if state.get("accepted") or state.get("reject_reason") or state.get("pending_approval"):
        return "explainer"
    return "scheduler"


def build_graph() -> StateGraph:
    """Build and compile the CineSched scheduling LangGraph (Phase 4)."""
    builder = StateGraph(GraphState)

    # ── Register nodes ──────────────────────────────────────────────────────
    builder.add_node("parser",            parser_agent)
    builder.add_node("scheduler",         scheduler_agent)
    builder.add_node("availability_eval", availability_agent)
    builder.add_node("constraint_eval",   constraint_agent)
    builder.add_node("budget_eval",       budget_agent)
    # Phase 4: advisory validation nodes (soft violations only)
    builder.add_node("weather_eval",      weather_agent)
    builder.add_node("travel_eval",       travel_agent)
    builder.add_node("continuity_eval",   continuity_agent)
    builder.add_node("critic",            critic_agent)
    builder.add_node("explainer",         explainer_agent)

    # ── Define edges ────────────────────────────────────────────────────────
    builder.set_entry_point("parser")
    builder.add_edge("parser",            "scheduler")
    builder.add_edge("scheduler",         "availability_eval")
    builder.add_edge("availability_eval", "constraint_eval")
    builder.add_edge("constraint_eval",   "budget_eval")
    # Phase 4: advisory chain after budget eval
    builder.add_edge("budget_eval",       "weather_eval")
    builder.add_edge("weather_eval",      "travel_eval")
    builder.add_edge("travel_eval",       "continuity_eval")
    builder.add_edge("continuity_eval",   "critic")

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
