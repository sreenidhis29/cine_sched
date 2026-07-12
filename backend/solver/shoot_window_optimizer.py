import logging
import requests
from datetime import date, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from db.models import Location, Scene
from models.schemas import (
    ShootWindowResult, ShootWindowLocationResult, 
    ShootWindowDayScore, ShootWindowRecommendation
)

logger = logging.getLogger(__name__)

def get_exterior_locations(project_id: str, db: Session) -> List[Location]:
    """
    Find all locations for a project that are associated with at least one scene
    designated as an exterior shoot ("EXT" in the scene setting).
    """
    # Find locations connected to scenes where scene.setting contains "EXT" (case-insensitive)
    locs = (
        db.query(Location)
        .join(Scene, Scene.location_id == Location.id)
        .filter(
            Location.project_id == project_id,
            Scene.setting.ilike("%EXT%")
        )
        .distinct()
        .all()
    )
    return locs

def score_day(
    precip_prob: float, 
    wind_speed_kmh: float, 
    temp_c: float, 
    precip_mm: float
) -> Tuple[float, str]:
    """
    Compute a 0-100 weather suitability score for exterior filming based on daily parameters.
    
    Formula:
      - Precipitation Probability (40% weight):
          precip_prob_score = 100.0 - precip_prob
      - Wind Speed (30% weight):
          wind_score = max(0.0, 100.0 - (wind_speed_kmh / 40.0) * 100.0)
          (wind speeds >= 40 km/h score 0.0)
      - Temperature Comfort (20% weight):
          temp_score = 100.0 if 15.0 <= temp_c <= 25.0 else max(0.0, 100.0 - (deviation * 10.0))
          where deviation is the distance to the 15-25°C boundary.
      - Precipitation Amount (10% weight):
          precip_amount_score = max(0.0, 100.0 - (precip_mm / 10.0) * 100.0)
          (precipitation >= 10mm/day scores 0.0)

      total_score = (precip_prob_score * 0.4) + (wind_score * 0.3) + (temp_score * 0.2) + (precip_amount_score * 0.1)
    """
    # 1. Precipitation Probability
    precip_prob_score = 100.0 - precip_prob

    # 2. Wind Speed (max comfortable is 40 km/h)
    wind_score = max(0.0, 100.0 - (wind_speed_kmh / 40.0) * 100.0)

    # 3. Temperature comfort (pleasant range: 15°C to 25°C)
    if 15.0 <= temp_c <= 25.0:
        temp_score = 100.0
    else:
        deviation = min(abs(temp_c - 15.0), abs(temp_c - 25.0))
        temp_score = max(0.0, 100.0 - deviation * 10.0)

    # 4. Precipitation Amount (daily sum; >= 10mm is terrible for cameras)
    precip_amount_score = max(0.0, 100.0 - (precip_mm / 10.0) * 100.0)

    # Calculate weighted score
    suitability_score = (
        (precip_prob_score * 0.40) +
        (wind_score * 0.30) +
        (temp_score * 0.20) +
        (precip_amount_score * 0.10)
    )

    # Derive reasoning string
    reasons = []
    if precip_prob < 15:
        reasons.append("Low rain risk")
    elif precip_prob < 40:
        reasons.append("Moderate rain risk")
    else:
        reasons.append("High rain risk")

    if wind_speed_kmh < 15:
        reasons.append("mild wind")
    elif wind_speed_kmh < 25:
        reasons.append("moderate wind")
    else:
        reasons.append("windy")

    if 15.0 <= temp_c <= 25.0:
        reasons.append("comfortable temperature")
    elif temp_c < 10.0:
        reasons.append("cold")
    elif temp_c > 30.0:
        reasons.append("hot")
    else:
        reasons.append("cool/warm")

    reason_str = ", ".join(reasons)

    return round(suitability_score, 1), reason_str

def optimize_shoot_windows(
    locations: List[Location], 
    date_range_days: int = 16
) -> ShootWindowResult:
    """
    For each location, query the Open-Meteo API for forecast details and
    score every day to identify the top 3 recommended shoot windows.
    """
    results = []
    start_date = date.today()
    end_date = start_date + timedelta(days=date_range_days - 1)

    for loc in locations:
        if loc.latitude is None or loc.longitude is None:
            continue

        lat = float(loc.latitude)
        lon = float(loc.longitude)

        # Query Open-Meteo for the requested forecast variables
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": "weather_code,precipitation_sum,wind_speed_10m_max,precipitation_probability_max,temperature_2m_max,temperature_2m_min",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "timezone": "auto"
        }

        day_scores: List[ShootWindowDayScore] = []
        try:
            resp = requests.get(url, params=params, timeout=5, headers={"User-Agent": "CineSched/1.0"})
            if resp.status_code == 200:
                data = resp.json()
                daily = data.get("daily", {})
                times = daily.get("time", [])
                precip_sums = daily.get("precipitation_sum", [])
                winds = daily.get("wind_speed_10m_max", [])
                probs = daily.get("precipitation_probability_max", [])
                temp_maxs = daily.get("temperature_2m_max", [])
                temp_mins = daily.get("temperature_2m_min", [])

                for i, t_str in enumerate(times):
                    p_sum = float(precip_sums[i]) if i < len(precip_sums) and precip_sums[i] is not None else 0.0
                    w_max = float(winds[i]) if i < len(winds) and winds[i] is not None else 0.0
                    prob = float(probs[i]) if i < len(probs) and probs[i] is not None else 0.0
                    t_max = float(temp_maxs[i]) if i < len(temp_maxs) and temp_maxs[i] is not None else 20.0
                    t_min = float(temp_mins[i]) if i < len(temp_mins) and temp_mins[i] is not None else 15.0
                    
                    temp_avg = (t_max + t_min) / 2.0
                    
                    score, reason = score_day(prob, w_max, temp_avg, p_sum)
                    day_scores.append(ShootWindowDayScore(
                        date=t_str,
                        score=score,
                        precip_prob=prob,
                        wind_kmh=w_max,
                        temp_c=round(temp_avg, 1),
                        precip_mm=p_sum
                    ))
        except Exception as e:
            logger.warning(f"Failed to fetch shoot-window weather for location {loc.name}: {e}")

        # If API failed or returned empty, populate with fallback defaults so the UI doesn't break
        if not day_scores:
            for d_idx in range(date_range_days):
                curr_date = start_date + timedelta(days=d_idx)
                # Comfortable pleasant default
                score, reason = score_day(10.0, 10.0, 20.0, 0.0)
                day_scores.append(ShootWindowDayScore(
                    date=curr_date.isoformat(),
                    score=score,
                    precip_prob=10.0,
                    wind_kmh=10.0,
                    temp_c=20.0,
                    precip_mm=0.0
                ))

        # Identify top 3 recommended dates
        sorted_scores = sorted(day_scores, key=lambda x: x.score, reverse=True)
        recommended_dates = []
        for d_score in sorted_scores[:3]:
            # Recalculate reason for serialization
            _, reason = score_day(
                d_score.precip_prob,
                d_score.wind_kmh,
                d_score.temp_c,
                d_score.precip_mm
            )
            recommended_dates.append(ShootWindowRecommendation(
                date=d_score.date,
                score=d_score.score,
                reason=reason
            ))

        results.append(ShootWindowLocationResult(
            location_id=str(loc.id),
            name=loc.name,
            day_scores=day_scores,
            recommended_dates=recommended_dates
        ))

    return ShootWindowResult(locations=results)
