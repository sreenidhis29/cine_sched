"""
Continuity agent — Phase 4 advisory node in the LangGraph pipeline.

Groups scenes by shared continuity_tags and flags pairs that end up
more than CONTINUITY_MAX_DAY_GAP shoot days apart in the schedule.

Example: Scenes tagged "sarah-wet-coat" scheduled on Day 2 and Day 15
would get an advisory warning the crew about continuity risk.

Produces soft advisory violations only — never triggers replanning.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Dict, List, Set

from agents.state import GraphState
from agents.utils import write_trace, Timer
from models.schemas import SolverEntryResult, SolverScene

logger = logging.getLogger(__name__)

# Maximum acceptable gap (in shoot days) between scenes sharing a continuity tag.
# Beyond this, the continuity risk is flagged as an advisory.
CONTINUITY_MAX_DAY_GAP = 5


def continuity_agent(state: GraphState) -> GraphState:
    """
    Advisory node: flag scenes with shared continuity_tags that are scheduled
    more than CONTINUITY_MAX_DAY_GAP shoot days apart.

    Prerequisites:
        - state["scenes"]: SolverScene list (must have continuity_tags field)
        - state["current_schedule"]: feasible solver result with schedule entries

    Output:
        state["continuity_violations"]: list of advisory strings (may be empty)
    """
    schedule = state.get("current_schedule")
    if not schedule or not schedule.feasible:
        return {**state, "continuity_violations": []}

    scenes: List[SolverScene] = state.get("scenes", [])
    entries: List[SolverEntryResult] = schedule.schedule

    # Check if any scenes have continuity tags
    scenes_with_tags = [s for s in scenes if getattr(s, "continuity_tags", None)]
    if not scenes_with_tags:
        return {**state, "continuity_violations": []}

    with Timer() as t:
        # Build scene_id -> shoot_day mapping
        day_by_scene: Dict[str, int] = {e.scene_id: e.shoot_day for e in entries}
        scene_by_id: Dict[str, SolverScene] = {s.id: s for s in scenes}

        # Build tag -> list of (scene, shoot_day) mapping
        tag_to_scenes: Dict[str, List] = defaultdict(list)
        for scene in scenes:
            tags = getattr(scene, "continuity_tags", []) or []
            shoot_day = day_by_scene.get(scene.id)
            if shoot_day is not None:
                for tag in tags:
                    tag_to_scenes[tag].append((scene, shoot_day))

        violations: List[str] = []

        for tag, scene_days in tag_to_scenes.items():
            if len(scene_days) < 2:
                continue

            # Sort by shoot day
            scene_days.sort(key=lambda x: x[1])

            # Check all pairs for excessive gaps
            seen_pairs: Set[tuple] = set()
            for i in range(len(scene_days)):
                for j in range(i + 1, len(scene_days)):
                    scene_a, day_a = scene_days[i]
                    scene_b, day_b = scene_days[j]
                    gap = day_b - day_a
                    pair_key = (scene_a.id, scene_b.id, tag)

                    if gap > CONTINUITY_MAX_DAY_GAP and pair_key not in seen_pairs:
                        seen_pairs.add(pair_key)
                        violations.append(
                            f"[CONTINUITY ADVISORY] Scenes '{scene_a.title}' (Day {day_a}) "
                            f"and '{scene_b.title}' (Day {day_b}) share continuity tag "
                            f"'{tag}' but are {gap} shoot days apart "
                            f"(threshold: {CONTINUITY_MAX_DAY_GAP}). "
                            f"Review costume/set continuity requirements."
                        )

    logger.info("continuity_agent: %d continuity advisory violations", len(violations))

    if state.get("project_id") and state.get("run_id"):
        write_trace(
            project_id=state["project_id"],
            run_id=state["run_id"],
            agent_name="Continuity Agent",
            input_summary=(
                f"Checking continuity tags across {len(scenes)} scenes, "
                f"{len(tag_to_scenes)} unique tag(s)."
            ),
            output_summary=(
                f"{len(violations)} continuity advisories raised."
                if violations
                else "No continuity advisories — tagged scenes are within acceptable gap."
            ),
            tool_calls=[],
            duration_ms=t.duration_ms,
            confidence="high" if not violations else "medium",
        )

    return {**state, "continuity_violations": violations}
