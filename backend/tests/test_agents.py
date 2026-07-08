import pytest
from agents.parser_agent import parser_agent
from agents.state import GraphState
from models.schemas import SolverBudget, SolverScene


def test_parser_agent():
    # Empty state should be initialized properly
    state: GraphState = {}
    new_state = parser_agent(state)
    
    assert new_state["scenes"] == []
    assert new_state["cast"] == []
    assert new_state["locations"] == []
    assert new_state["equipment"] == []
    assert new_state["budget"].total_limit == 0
    assert new_state["relaxed_constraints"] == []
    assert new_state["violations"] == []
    assert new_state["iteration_count"] == 0
    assert new_state["accepted"] is False


def test_parser_agent_with_data():
    state: GraphState = {
        "scenes": [SolverScene(id="s1", scene_number=1, title="Scene 1", duration_minutes=60)],
        "budget": SolverBudget(total_limit=1000),
        "iteration_count": 2
    }
    new_state = parser_agent(state)
    
    assert len(new_state["scenes"]) == 1
    assert new_state["budget"].total_limit == 1000
    assert new_state["iteration_count"] == 2
    assert new_state["violations"] == []
