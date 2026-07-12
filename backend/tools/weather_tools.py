"""
Weather tools for CineSched Phase 4.

Checks exterior scenes' scheduled dates against the Open-Meteo forecast.
Produces advisory (soft) violation strings — these never block scheduling.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Dict, List, Optional

from pydantic import BaseModel

from integrations.weather_client import DayForecast, get_forecast
from models.schemas import SolverEntryResult, SolverLocation, SolverScene

logger = logging.getLogger(__name__)

# WMO code → human-readable label for violation messages
_WMO_LABELS: Dict[int, str] = {
    65: "heavy rain", 67: "heavy freezing rain",
    71: "light snow", 73: "moderate snow", 75: "heavy snow", 77: "snow grains",
    82: "violent rain showers", 85: "heavy snow showers", 86: "heavy snow showers",
    95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with heavy hail",
}


class WeatherCheckInput(BaseModel):
    scenes: List[SolverScene]
    schedule_entries: List[SolverEntryResult]
    locations: List[SolverLocation]
    start_date: date
    shoot_base_lat: float
    shoot_base_lon: float


class WeatherCheckResult(BaseModel):
    violations: List[str]
    day_forecasts: Dict[str, dict]   # shoot_day (str) -> forecast dict for UI


def check_weather_risk(inp: WeatherCheckInput) -> WeatherCheckResult:
    """
    For each exterior scene in the schedule, check if its shoot date falls
    on a high-risk weather day within the Open-Meteo forecast window.

    Only exterior scenes (setting contains 'EXT') are checked.
    Interior scenes are unaffected by weather and are skipped.

    Returns advisory violation strings — never hard blocks.
    """
    if not inp.schedule_entries:
        return WeatherCheckResult(violations=[], day_forecasts={})

    # Determine the forecast window needed
    max_day = max(e.shoot_day for e in inp.schedule_entries)
    forecast_days = max_day + 1

    forecasts = get_forecast(
        lat=inp.shoot_base_lat,
        lon=inp.shoot_base_lon,
        start_date=inp.start_date,
        days=min(forecast_days, 16),  # Open-Meteo free tier max
    )

    # Build date -> forecast lookup
    forecast_by_date: Dict[date, DayForecast] = {f.date: f for f in forecasts}

    # Build scene lookup
    scene_by_id: Dict[str, SolverScene] = {s.id: s for s in inp.scenes}
    # Build location lookup (id -> location)
    location_by_id: Dict[str, SolverLocation] = {l.id: l for l in inp.locations}

    violations: List[str] = []
    day_forecasts: Dict[str, dict] = {}

    for entry in inp.schedule_entries:
        shoot_date = inp.start_date + timedelta(days=entry.shoot_day - 1)
        fc = forecast_by_date.get(shoot_date)

        if fc:
            day_forecasts[str(entry.shoot_day)] = {
                "date": shoot_date.isoformat(),
                "weather_code": fc.weather_code,
                "precipitation_sum_mm": fc.precipitation_sum_mm,
                "wind_speed_max_kmh": fc.wind_speed_max_kmh,
                "is_high_risk": fc.is_high_risk,
                "temperature_2m_max": fc.temperature_2m_max,
                "temperature_2m_min": fc.temperature_2m_min,
                "precipitation_probability_max": fc.precipitation_probability_max,
            }

        scene = scene_by_id.get(entry.scene_id)
        if not scene:
            continue

        # Only flag exterior scenes
        is_exterior = "EXT" in (scene.setting or "").upper()
        if not is_exterior:
            continue

        # Only flag if within forecast window and high-risk
        if fc and fc.is_high_risk:
            weather_label = _WMO_LABELS.get(fc.weather_code, f"bad weather (code {fc.weather_code})")
            precip_note = ""
            if fc.precipitation_sum_mm >= 5.0:
                precip_note = f", {fc.precipitation_sum_mm:.1f} mm rain"

            # Get location name for context
            loc = location_by_id.get(scene.location_id or "") if scene.location_id else None
            loc_note = f" at {loc.name}" if loc else ""

            violations.append(
                f"[WEATHER ADVISORY] Scene '{scene.title}' (EXT, Day {entry.shoot_day}{loc_note}) "
                f"on {shoot_date}: {weather_label}{precip_note}. "
                f"Consider rescheduling or preparing a weather backup plan."
            )

    logger.info("weather_tools: %d weather advisory violations", len(violations))
    return WeatherCheckResult(violations=violations, day_forecasts=day_forecasts)
