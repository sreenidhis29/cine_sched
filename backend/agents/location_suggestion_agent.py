"""
Location suggestion agent — Phase 4 standalone function.

For each script-extracted scene that lacks a matched existing Location in the project,
this agent:
  1. Uses the LLM router to describe the ideal real-world location type from the scene content.
  2. Queries the Nominatim geocoder for 2-3 real candidate places near the project's shoot base.
  3. Returns suggestions keyed by scene_number.

IMPORTANT:
  - This is a standalone function, NOT a LangGraph node.
  - Suggestions are returned to the API layer and surfaced in the script review UI.
  - Suggestions are NEVER auto-committed as Location records.
  - The admin/producer must explicitly choose a suggestion, or enter manually.
"""
from __future__ import annotations

import logging
import time
from typing import Dict, List, Optional

from integrations.geocoding_client import PlaceResult, search_places
from llm.router import LLMRouterError, chat
from models.schemas import ExtractedScene

logger = logging.getLogger(__name__)

# Minimum interval between LLM calls within this agent (seconds)
# to avoid hammering the LLM router on large scripts.
_LLM_CALL_INTERVAL = 1.2


def _describe_location_type(scene: ExtractedScene) -> Optional[str]:
    """
    Ask the LLM to produce a brief, Nominatim-searchable description of the
    ideal real-world location type for this scene.

    Returns a short string like "abandoned warehouse industrial district" or None on error.
    """
    prompt = (
        f"You are a film location scout assistant.\n"
        f"Given the following scene from a screenplay, describe the ideal real-world location "
        f"type in 4-8 words suitable for a geocoding search.\n\n"
        f"Scene title: {scene.title}\n"
        f"Setting: {scene.setting}\n"
        f"Time of day: {scene.time_of_day}\n"
        f"Location name from script: {scene.location_name}\n\n"
        f"Respond with ONLY the search query (no quotes, no explanation). Examples:\n"
        f"  'abandoned warehouse industrial district'\n"
        f"  'underground subway station'\n"
        f"  'rooftop bar downtown'\n"
        f"  'quiet park with pond'\n"
    )

    try:
        result = chat(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are a concise location scout assistant.",
            temperature=0.3,
            max_tokens=50,
        )
        query = result.strip().strip('"').strip("'")
        return query if query else None
    except LLMRouterError as e:
        logger.warning("location_suggestion_agent: LLM failed for scene '%s': %s", scene.title, e)
        # Fallback: use the location_name directly from the script
        return scene.location_name if scene.location_name else None


def suggest_locations_for_scenes(
    scenes: List[ExtractedScene],
    shoot_base_lat: float,
    shoot_base_lon: float,
    existing_location_names: Optional[List[str]] = None,
    max_suggestions: int = 3,
) -> Dict[int, List[dict]]:
    """
    Generate real-world location suggestions for scenes lacking matched existing Locations.

    Args:
        scenes: Script-extracted scenes (from script parse result).
        shoot_base_lat / shoot_base_lon: Center of the search area.
        existing_location_names: Names of existing project Locations (lowercased).
            Scenes whose location_name matches an existing one are skipped.
        max_suggestions: Max Nominatim results per scene (default 3).

    Returns:
        Dict mapping scene_number (int) -> list of suggestion dicts:
            [{"name": str, "address": str, "lat": float, "lon": float}]

    Design notes:
        - NEVER creates Location records — caller is responsible for the review step.
        - LLM calls are rate-limited to avoid hammering the router.
        - Nominatim calls are already rate-limited inside geocoding_client.
        - Errors per scene are non-fatal — that scene just gets an empty list.
    """
    existing_lower = {name.lower() for name in (existing_location_names or [])}
    suggestions: Dict[int, List[dict]] = {}
    _last_llm_call = 0.0

    for scene in scenes:
        # Skip if scene already has a matched existing location
        if scene.location_name and scene.location_name.lower() in existing_lower:
            logger.debug(
                "location_suggestion_agent: scene %d '%s' — location '%s' already exists, skipping",
                scene.scene_number, scene.title, scene.location_name,
            )
            continue

        # Rate-limit LLM calls
        now = time.time()
        gap = now - _last_llm_call
        if gap < _LLM_CALL_INTERVAL:
            time.sleep(_LLM_CALL_INTERVAL - gap)

        _last_llm_call = time.time()

        # Step 1: Get geocoding search query from LLM
        search_query = _describe_location_type(scene)
        if not search_query:
            suggestions[scene.scene_number] = []
            continue

        logger.info(
            "location_suggestion_agent: scene %d '%s' — LLM query: '%s'",
            scene.scene_number, scene.title, search_query,
        )

        # Step 2: Query Nominatim (already rate-limited inside geocoding_client)
        places: List[PlaceResult] = search_places(
            query=search_query,
            near_lat=shoot_base_lat,
            near_lon=shoot_base_lon,
            limit=max_suggestions,
        )

        suggestions[scene.scene_number] = [
            {
                "name": p.name,
                "address": p.address,
                "lat": p.lat,
                "lon": p.lon,
            }
            for p in places
        ]

    logger.info(
        "location_suggestion_agent: generated suggestions for %d/%d scenes",
        sum(1 for v in suggestions.values() if v), len(scenes),
    )
    return suggestions
