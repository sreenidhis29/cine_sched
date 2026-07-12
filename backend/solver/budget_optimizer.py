import logging
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from db.models import Location, CastMember, Scene, Budget
from models.schemas import BudgetResult, BudgetCategory
from solver.route_optimizer import haversine

logger = logging.getLogger(__name__)

# Configurable constants
OVERNIGHT_THRESHOLD_MIN = 90.0
OVERNIGHT_COST_PER_NIGHT = 150.0

def compute_budget(
    project_id: str,
    db: Session,
    route_plan: Optional[dict] = None,
    shoot_window_plan: Optional[dict] = None,
    crew_hourly_rate: float = 500.0
) -> BudgetResult:
    """
    Computes a full cost breakdown for the project budget, combining
    results of the Route Planner and Shoot-Window Planner (if available),
    with fallbacks to naive estimates.
    """
    # 1. Fetch project budget caps
    budget_db = db.query(Budget).filter(Budget.project_id == project_id).first()
    
    total_cap = float(budget_db.total_limit) if (budget_db and budget_db.total_limit) else 0.0
    cast_cap = float(budget_db.cast_cap) if (budget_db and budget_db.cast_cap is not None) else 0.0
    location_cap = float(budget_db.location_cap) if (budget_db and budget_db.location_cap is not None) else 0.0
    equipment_cap = float(budget_db.equipment_cap) if (budget_db and budget_db.equipment_cap is not None) else 0.0
    
    # Direct pass through for unmodeled caps (makeup and contingency)
    makeup_cap = float(getattr(budget_db, "makeup_cap", 0.0))
    contingency_cap = float(getattr(budget_db, "contingency_cap", 0.0))

    # Fetch project locations and cast members
    locations = db.query(Location).filter(Location.project_id == project_id).all()
    cast_members = db.query(CastMember).filter(CastMember.project_id == project_id).all()

    # ----------------------------------------------------
    # A. LOCATIONS COST
    # ----------------------------------------------------
    # Optimized/Planned Locations Cost
    opt_loc_days = {}
    is_loc_estimate = True
    loc_note = "Estimated (1 day per location)"

    if shoot_window_plan and "locations" in shoot_window_plan and len(shoot_window_plan["locations"]) > 0:
        is_loc_estimate = False
        loc_note = "Optimized based on Shoot-Window recommended dates"
        for l_result in shoot_window_plan["locations"]:
            loc_id = l_result.get("location_id")
            recs = l_result.get("recommended_dates", [])
            opt_loc_days[loc_id] = len(recs)

    # Calculate locations total costs
    opt_locations_cost = 0.0
    naive_locations_cost = 0.0

    for loc in locations:
        cost_per_day = float(loc.cost_per_day or 0.0)
        # Optimized
        days_used = opt_loc_days.get(str(loc.id), 1)
        opt_locations_cost += cost_per_day * days_used
        # Naive: baseline is always 1 day
        naive_locations_cost += cost_per_day * 1

    # ----------------------------------------------------
    # B. CAST COST
    # ----------------------------------------------------
    # Calculate estimated shoot days per cast member
    # If cast model has day_rate, we use that. Otherwise, we distribute cast cap.
    cast_cost = 0.0
    cast_note = ""
    is_cast_estimate = False

    # Check if day_rate exists on CastMember
    has_day_rate = hasattr(CastMember, "day_rate")
    
    # Calculate total shoot days (sum of days locations are used)
    total_shoot_days = sum(opt_loc_days.values()) if opt_loc_days else len(locations)
    if total_shoot_days == 0:
        total_shoot_days = 1

    if has_day_rate:
        # Sum day_rate * estimated shoot_days per cast member
        is_cast_estimate = False
        cast_note = "Calculated from cast day rates"
        for cm in cast_members:
            rate = float(getattr(cm, "day_rate", 0.0))
            # Assume they work on all shoot days for simplicity
            cast_cost += rate * total_shoot_days
    else:
        # Fallback: evenly divide budget cap
        is_cast_estimate = True
        cast_note = "Estimated (no per-cast rate data; cast cap allocated)"
        cast_cost = cast_cap

    # ----------------------------------------------------
    # C. TRAVEL COST
    # ----------------------------------------------------
    opt_travel_cost = 0.0
    naive_travel_cost = 0.0
    travel_note = ""

    if route_plan and "total_duration_min" in route_plan:
        opt_travel_duration = float(route_plan["total_duration_min"])
        naive_travel_duration = float(route_plan.get("naive_order_total_duration_min", opt_travel_duration))
        
        opt_travel_cost = (opt_travel_duration / 60.0) * crew_hourly_rate
        naive_travel_cost = (naive_travel_duration / 60.0) * crew_hourly_rate
        travel_note = f"Calculated using Route Plan travel duration (${crew_hourly_rate}/hr)"
    else:
        travel_note = "Run Route Planner for accurate travel cost (Naive baseline used)"
        # Default naive travel duration estimate using Haversine between locations sequence
        valid_locs = [l for l in locations if l.latitude is not None and l.longitude is not None]
        naive_duration = 0.0
        for i in range(len(valid_locs) - 1):
            _, dur = haversine(
                float(valid_locs[i].latitude), float(valid_locs[i].longitude),
                float(valid_locs[i+1].latitude), float(valid_locs[i+1].longitude)
            )
            naive_duration += dur
        
        opt_travel_cost = 0.0
        naive_travel_cost = (naive_duration / 60.0) * crew_hourly_rate

    # ----------------------------------------------------
    # D. OVERNIGHT ACCOMMODATION COST
    # ----------------------------------------------------
    opt_overnight_cost = 0.0
    naive_overnight_cost = 0.0
    overnight_note = ""

    if route_plan and "segments" in route_plan:
        triggered_segments = 0
        for seg in route_plan["segments"]:
            if float(seg.get("duration_min", 0.0)) > OVERNIGHT_THRESHOLD_MIN:
                triggered_segments += 1
        opt_overnight_cost = triggered_segments * OVERNIGHT_COST_PER_NIGHT
        overnight_note = f"Based on Route Plan segments exceeding {int(OVERNIGHT_THRESHOLD_MIN)} mins (${int(OVERNIGHT_COST_PER_NIGHT)}/night)"
    else:
        overnight_note = "Run Route Planner for overnight stays (Naive estimate used)"
        # Naive calculation: check sequence legs exceeding threshold
        valid_locs = [l for l in locations if l.latitude is not None and l.longitude is not None]
        triggered_naive = 0
        for i in range(len(valid_locs) - 1):
            _, dur = haversine(
                float(valid_locs[i].latitude), float(valid_locs[i].longitude),
                float(valid_locs[i+1].latitude), float(valid_locs[i+1].longitude)
            )
            if dur > OVERNIGHT_THRESHOLD_MIN:
                triggered_naive += 1
        naive_overnight_cost = triggered_naive * OVERNIGHT_COST_PER_NIGHT

    # ----------------------------------------------------
    # BUILD BREAKDOWN CATEGORIES
    # ----------------------------------------------------
    categories = [
        BudgetCategory(
            name="Locations",
            amount=round(opt_locations_cost, 2),
            is_estimate=is_loc_estimate,
            note=loc_note
        ),
        BudgetCategory(
            name="Cast",
            amount=round(cast_cost, 2),
            is_estimate=is_cast_estimate,
            note=cast_note
        ),
        BudgetCategory(
            name="Travel",
            amount=round(opt_travel_cost, 2),
            is_estimate=route_plan is None,
            note=travel_note
        ),
        BudgetCategory(
            name="Overnight Accommodation",
            amount=round(opt_overnight_cost, 2),
            is_estimate=route_plan is None,
            note=overnight_note
        ),
        BudgetCategory(
            name="Equipment",
            amount=round(equipment_cap, 2),
            is_estimate=False,
            note="Budget sub-cap limit"
        ),
        BudgetCategory(
            name="Makeup / Prosthetics / Stunts",
            amount=round(makeup_cap, 2),
            is_estimate=True,
            note="Budget sub-cap limit"
        ),
        BudgetCategory(
            name="Contingency",
            amount=round(contingency_cap, 2),
            is_estimate=True,
            note="Budget sub-cap limit"
        )
    ]

    # Calculate totals
    optimized_total = (
        opt_locations_cost + 
        cast_cost + 
        opt_travel_cost + 
        opt_overnight_cost + 
        equipment_cap + 
        makeup_cap + 
        contingency_cap
    )
    
    naive_total = (
        naive_locations_cost + 
        cast_cost + 
        naive_travel_cost + 
        naive_overnight_cost + 
        equipment_cap + 
        makeup_cap + 
        contingency_cap
    )

    savings = max(0.0, naive_total - optimized_total)

    # Over/under budget limit comparison
    over_under_amount = total_cap - optimized_total

    return BudgetResult(
        categories=categories,
        total=round(optimized_total, 2),
        budget_cap=round(total_cap, 2),
        over_under_amount=round(over_under_amount, 2),
        naive_total=round(naive_total, 2),
        optimized_total=round(optimized_total, 2),
        savings=round(savings, 2)
    )
