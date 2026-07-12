"""
OpenStreetMap Nominatim geocoding client for CineSched Phase 4.

API: https://nominatim.openstreetmap.org/search
- Free, no API key required.
- OSM Usage Policy: https://operations.osmfoundation.org/policies/nominatim/
  * MUST include a valid User-Agent identifying the application.
  * MUST NOT send more than 1 request per second.
  * MUST cache results — do not re-request the same query.
  * No bulk geocoding or systematic harvesting.

We implement all three requirements:
  1. User-Agent header: "CineSched/1.0 (contact@cinesched.dev)"
  2. Rate limiter: enforces ≥1 second between consecutive requests.
  3. In-memory dict cache keyed by (query, near_lat, near_lon).
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# Required by OSM usage policy
USER_AGENT = "CineSched/1.0 (contact@cinesched.dev)"

# Rate limiting state (module-level — shared across all calls in the process)
_last_nominatim_call: float = 0.0
NOMINATIM_MIN_INTERVAL = 1.1  # slightly above 1 s to be safe

# Cache: (query_lower, near_lat_3dp, near_lon_3dp) -> List[PlaceResult]
_nominatim_cache: Dict[Tuple, list] = {}


@dataclass
class PlaceResult:
    name: str
    address: str
    lat: float
    lon: float


def _rate_limit() -> None:
    """Enforce Nominatim's 1 req/sec policy."""
    global _last_nominatim_call
    now = time.time()
    gap = now - _last_nominatim_call
    if gap < NOMINATIM_MIN_INTERVAL:
        sleep_for = NOMINATIM_MIN_INTERVAL - gap
        logger.debug("geocoding_client: rate-limiting — sleeping %.2f s", sleep_for)
        time.sleep(sleep_for)
    _last_nominatim_call = time.time()


def search_places(
    query: str,
    near_lat: float,
    near_lon: float,
    limit: int = 3,
    radius_deg: float = 1.5,
) -> List[PlaceResult]:
    """
    Search for real-world places matching `query` near the given coordinates.

    Args:
        query: Free-text search string (e.g. "abandoned warehouse industrial area").
        near_lat / near_lon: Center of the search area (shoot base location).
        limit: Maximum number of results to return (default 3).
        radius_deg: Bounding box half-width in degrees (≈ 167 km at equator).

    Returns:
        List of PlaceResult (may be empty if no matches or API error).

    Nominatim usage policy compliance:
        - Proper User-Agent header is sent on every request.
        - Rate limiter enforces ≥1 second between calls.
        - Results are cached — repeated identical queries hit the cache, not the API.
    """
    cache_key = (query.lower().strip(), round(near_lat, 3), round(near_lon, 3))
    if cache_key in _nominatim_cache:
        logger.debug("geocoding_client: cache hit for '%s'", query)
        return _nominatim_cache[cache_key]

    _rate_limit()

    # Build a bounding box around the shoot base
    viewbox = (
        f"{near_lon - radius_deg},{near_lat - radius_deg},"
        f"{near_lon + radius_deg},{near_lat + radius_deg}"
    )
    params = {
        "q": query,
        "format": "json",
        "limit": limit,
        "viewbox": viewbox,
        "bounded": 0,           # 0 = allow results outside viewbox if nothing nearby
        "addressdetails": 1,
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(NOMINATIM_URL, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("geocoding_client: Nominatim API error: %s", e)
        return []

    results: List[PlaceResult] = []
    for item in data[:limit]:
        try:
            name = item.get("name") or item.get("display_name", "").split(",")[0]
            address = item.get("display_name", "")
            lat = float(item["lat"])
            lon = float(item["lon"])
            results.append(PlaceResult(name=name, address=address, lat=lat, lon=lon))
        except (KeyError, ValueError, TypeError) as e:
            logger.debug("geocoding_client: skipping malformed result: %s", e)

    _nominatim_cache[cache_key] = results
    logger.info(
        "geocoding_client: '%s' near (%.3f,%.3f) -> %d results",
        query, near_lat, near_lon, len(results),
    )
    return results


def geocode_query(
    query: str,
    near_lat: Optional[float] = None,
    near_lon: Optional[float] = None,
    limit: int = 5,
) -> List[PlaceResult]:
    """
    Search for places using OSM Nominatim, optionally biasing near a center.
    This respects rate-limiting and caching.
    """
    cache_key = (
        query.lower().strip(),
        round(near_lat, 3) if near_lat is not None else None,
        round(near_lon, 3) if near_lon is not None else None,
    )
    if cache_key in _nominatim_cache:
        logger.debug("geocoding_client: cache hit for '%s'", query)
        return _nominatim_cache[cache_key]

    _rate_limit()

    params = {
        "q": query,
        "format": "json",
        "limit": limit,
        "addressdetails": 1,
    }
    if near_lat is not None and near_lon is not None:
        radius_deg = 1.5
        params["viewbox"] = (
            f"{near_lon - radius_deg},{near_lat - radius_deg},"
            f"{near_lon + radius_deg},{near_lat + radius_deg}"
        )
        params["bounded"] = 0

    headers = {"User-Agent": USER_AGENT}

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(NOMINATIM_URL, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("geocoding_client: Nominatim API error: %s", e)
        return []

    results: List[PlaceResult] = []
    for item in data[:limit]:
        try:
            name = item.get("name") or item.get("display_name", "").split(",")[0]
            address = item.get("display_name", "")
            lat = float(item["lat"])
            lon = float(item["lon"])
            results.append(PlaceResult(name=name, address=address, lat=lat, lon=lon))
        except (KeyError, ValueError, TypeError) as e:
            logger.debug("geocoding_client: skipping malformed result: %s", e)

    _nominatim_cache[cache_key] = results
    return results

