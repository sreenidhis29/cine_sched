"""
Open-Meteo weather forecast client for CineSched Phase 4.

API: https://api.open-meteo.com/v1/forecast
- Free, no API key required.
- Returns hourly/daily weather variables for a given lat/lon.
- We use WMO weather interpretation codes to classify high-risk days.

Rate limiting: Open-Meteo allows ~10,000 calls/day from a single IP.
We add a simple in-memory TTL cache (1 hour) to avoid repeated calls.

WMO Weather Code reference:
  0        Clear sky
  1,2,3    Mainly clear, partly cloudy, overcast
  45,48    Foggy
  51-57    Drizzle
  61-67    Rain (61/63/65 = slight/moderate/heavy; 66/67 = freezing)
  71-77    Snowfall
  80-82    Rain showers (slight/moderate/violent)
  85,86    Snow showers
  95       Thunderstorm
  96,99    Thunderstorm with hail
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# WMO codes considered high-risk for exterior filming
WMO_HIGH_RISK_CODES = {
    65, 67,        # Heavy / freezing rain
    71, 73, 75, 77,  # Snowfall
    82,            # Violent rain showers
    85, 86,        # Snow showers
    95, 96, 99,    # Thunderstorm / thunderstorm with hail
}

# Precipitation threshold for high-risk (mm/day)
PRECIP_HIGH_RISK_MM = 5.0

# Cache: (lat, lon, start_date_iso) -> (timestamp, result)
_forecast_cache: Dict[Tuple, Tuple[float, list]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour


@dataclass
class DayForecast:
    date: date
    weather_code: int
    precipitation_sum_mm: float
    wind_speed_max_kmh: float
    is_high_risk: bool


def get_forecast(
    lat: float,
    lon: float,
    start_date: date,
    days: int = 16,
) -> List[DayForecast]:
    """
    Fetch a daily forecast from Open-Meteo for the given coordinates.

    Args:
        lat: Latitude of the shoot location.
        lon: Longitude of the shoot location.
        start_date: First date of the forecast window.
        days: Number of days to forecast (max 16 for free tier).

    Returns:
        List of DayForecast objects, one per day.
        Returns an empty list if the API call fails (non-fatal).

    Note:
        Open-Meteo's free forecast window is 16 days ahead.
        Dates beyond that window will still be requested but may return
        climatological estimates rather than actual forecasts.
    """
    cache_key = (round(lat, 4), round(lon, 4), start_date.isoformat(), days)
    now = time.time()

    # Check cache
    if cache_key in _forecast_cache:
        cached_at, cached_result = _forecast_cache[cache_key]
        if now - cached_at < CACHE_TTL_SECONDS:
            logger.debug("weather_client: cache hit for %s", cache_key)
            return cached_result

    end_date = start_date + timedelta(days=days - 1)
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "weather_code,precipitation_sum,wind_speed_10m_max",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "timezone": "auto",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("weather_client: Open-Meteo API error: %s", e)
        return []

    daily = data.get("daily", {})
    dates = daily.get("time", [])
    codes = daily.get("weather_code", [])
    precip = daily.get("precipitation_sum", [])
    wind = daily.get("wind_speed_10m_max", [])

    results: List[DayForecast] = []
    for i, d_str in enumerate(dates):
        try:
            d = date.fromisoformat(d_str)
        except ValueError:
            continue
        code = int(codes[i]) if i < len(codes) and codes[i] is not None else 0
        p = float(precip[i]) if i < len(precip) and precip[i] is not None else 0.0
        w = float(wind[i]) if i < len(wind) and wind[i] is not None else 0.0
        high_risk = (code in WMO_HIGH_RISK_CODES) or (p >= PRECIP_HIGH_RISK_MM)
        results.append(DayForecast(
            date=d,
            weather_code=code,
            precipitation_sum_mm=p,
            wind_speed_max_kmh=w,
            is_high_risk=high_risk,
        ))

    _forecast_cache[cache_key] = (now, results)
    logger.info(
        "weather_client: fetched %d days forecast for (%.4f, %.4f) starting %s",
        len(results), lat, lon, start_date,
    )
    return results
