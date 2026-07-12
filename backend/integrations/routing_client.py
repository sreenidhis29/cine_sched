"""
OSRM routing client for CineSched Phase 4.

API: http://router.project-osrm.org (public demo server)
- Free, no API key required.
- Uses the driving profile by default.
- Returns duration (seconds) and distance (meters) for the fastest route.

PRODUCTION UPGRADE PATH:
    The public OSRM demo server (router.project-osrm.org) is rate-limited
    and may be unavailable during high load. For production use, self-host
    OSRM with your regional map extract:
      1. Download OSM data for your region from https://download.geofabrik.de/
      2. Build OSRM: docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract ...
      3. Update OSRM_BASE_URL in config.py to point to your local instance.
    See: https://github.com/Project-OSRM/osrm-backend#quick-start

Cache: simple in-memory dict keyed by coordinate pair (rounded to 3 decimal places).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# Public OSRM demo server — swap for self-hosted in production (see module docstring)
OSRM_BASE_URL = "http://router.project-osrm.org"

# Cache: (lat1, lon1, lat2, lon2) -> TravelResult
_route_cache: Dict[Tuple, "TravelResult"] = {}


@dataclass
class TravelResult:
    duration_minutes: float
    distance_km: float
    ok: bool
    error: Optional[str] = None


def get_travel_duration(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
) -> TravelResult:
    """
    Get driving duration and distance between two coordinates via OSRM.

    Args:
        origin_lat / origin_lon: Start point.
        dest_lat / dest_lon: End point.

    Returns:
        TravelResult with duration_minutes and distance_km.
        On API failure, returns TravelResult(ok=False, error=...) so callers
        can skip gracefully without crashing.

    Note:
        Coordinates are rounded to 3 decimal places for cache keying.
        For production load, replace OSRM_BASE_URL with a self-hosted instance.
    """
    # Round for cache key (3 decimal places ≈ 111 m precision)
    cache_key = (
        round(origin_lat, 3), round(origin_lon, 3),
        round(dest_lat, 3), round(dest_lon, 3),
    )
    if cache_key in _route_cache:
        logger.debug("routing_client: cache hit for %s", cache_key)
        return _route_cache[cache_key]

    # OSRM format: /route/v1/{profile}/{lon1},{lat1};{lon2},{lat2}
    url = (
        f"{OSRM_BASE_URL}/route/v1/driving/"
        f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    )
    params = {"overview": "false", "steps": "false"}

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("routing_client: OSRM API error: %s", e)
        result = TravelResult(duration_minutes=0.0, distance_km=0.0, ok=False, error=str(e))
        return result

    if data.get("code") != "Ok" or not data.get("routes"):
        err = f"OSRM returned code={data.get('code')}"
        logger.warning("routing_client: %s", err)
        result = TravelResult(duration_minutes=0.0, distance_km=0.0, ok=False, error=err)
        return result

    route = data["routes"][0]
    duration_minutes = route["duration"] / 60.0   # OSRM returns seconds
    distance_km = route["distance"] / 1000.0       # OSRM returns meters

    result = TravelResult(duration_minutes=duration_minutes, distance_km=distance_km, ok=True)
    _route_cache[cache_key] = result
    logger.info(
        "routing_client: route (%.3f,%.3f) -> (%.3f,%.3f) = %.1f min / %.1f km",
        origin_lat, origin_lon, dest_lat, dest_lon, duration_minutes, distance_km,
    )
    return result
