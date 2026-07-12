import math
import logging
import requests
from typing import List, Optional, Tuple, Dict, Any
from db.models import Location
from models.schemas import RouteResult, RouteSegment

# OR-Tools
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

logger = logging.getLogger(__name__)

# Haversine distance for fallback
def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float]:
    """
    Calculate the great-circle distance between two points in km, 
    and estimate travel duration in minutes (assuming average speed 50 km/h).
    """
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    dist_km = R * c
    # 50 km/h average speed -> 1.2 min per km
    dur_min = dist_km * 1.2
    return dist_km, dur_min

def get_osrm_matrix(coords: List[Tuple[float, float]]) -> Tuple[List[List[float]], List[List[float]], bool]:
    """
    Queries OSRM table service for duration (seconds) and distance (meters) matrices.
    coords is a list of (lat, lon) tuples.
    Returns (duration_matrix_mins, distance_matrix_kms, success_flag).
    """
    n = len(coords)
    # Default fallback matrices using Haversine
    fallback_dur = [[0.0] * n for _ in range(n)]
    fallback_dist = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                dist, dur = haversine(coords[i][0], coords[i][1], coords[j][0], coords[j][1])
                fallback_dist[i][j] = dist
                fallback_dur[i][j] = dur

    if n <= 1:
        return fallback_dur, fallback_dist, True

    # Build OSRM query
    coord_strs = [f"{lon},{lat}" for lat, lon in coords]
    coords_query = ";".join(coord_strs)
    url = f"https://router.project-osrm.org/table/v1/driving/{coords_query}?annotations=duration,distance"
    
    try:
        response = requests.get(url, timeout=5, headers={"User-Agent": "CineSched/1.0"})
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == "Ok":
                # OSRM durations are in seconds, convert to minutes
                durations = [[val / 60.0 if val is not None else 0.0 for val in row] for row in data["durations"]]
                # OSRM distances are in meters, convert to kilometers
                distances = [[val / 1000.0 if val is not None else 0.0 for val in row] for row in data["distances"]]
                return durations, distances, True
    except Exception as e:
        logger.warning(f"OSRM table request failed, falling back to Haversine calculations: {e}")
        
    return fallback_dur, fallback_dist, False

def get_osrm_polyline(from_coord: Tuple[float, float], to_coord: Tuple[float, float]) -> List[List[float]]:
    """
    Fetches the geojson route polyline coordinates from OSRM route service.
    Returns a list of [lat, lon] coordinates.
    """
    lat1, lon1 = from_coord
    lat2, lon2 = to_coord
    url = f"https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson"
    try:
        response = requests.get(url, timeout=3, headers={"User-Agent": "CineSched/1.0"})
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == "Ok" and len(data.get("routes", [])) > 0:
                coords = data["routes"][0]["geometry"]["coordinates"]
                # OSRM returns coordinates as [lon, lat], map to [lat, lon] for Leaflet
                return [[c[1], c[0]] for c in coords]
    except Exception as e:
        logger.warning(f"OSRM polyline request failed: {e}")
    
    # Fallback: straight line from start to end
    return [[lat1, lon1], [[lat2, lon2]]]

def optimize_route(
    locations: List[Location], 
    trip_type: str, 
    start_location_id: Optional[str] = None
) -> RouteResult:
    """
    Optimize the travel route among locations using Google OR-Tools.
    trip_type can be "round_trip" or "one_way".
    """
    if not locations:
        return RouteResult(
            trip_type=trip_type,
            ordered_stops=[],
            segments=[],
            total_distance_km=0.0,
            total_duration_min=0.0,
            naive_order_total_duration_min=0.0
        )

    # Filter out locations without coordinates
    valid_locations = [loc for loc in locations if loc.latitude is not None and loc.longitude is not None]
    if not valid_locations:
        return RouteResult(
            trip_type=trip_type,
            ordered_stops=[],
            segments=[],
            total_distance_km=0.0,
            total_duration_min=0.0,
            naive_order_total_duration_min=0.0
        )

    # Determine start location index
    start_index = 0
    if start_location_id:
        for idx, loc in enumerate(valid_locations):
            if str(loc.id) == start_location_id:
                start_index = idx
                break
    else:
        # Default to first location in list
        start_index = 0

    n = len(valid_locations)
    coords = [(float(loc.latitude), float(loc.longitude)) for loc in valid_locations]

    # Fetch OSRM distance and duration matrices
    durations, distances, _ = get_osrm_matrix(coords)

    # Compute naive order duration for comparison (using the current list sequence)
    naive_duration = 0.0
    for i in range(n - 1):
        naive_duration += durations[i][i + 1]
    if trip_type == "round_trip" and n > 1:
        naive_duration += durations[n - 1][0]

    # If only 1 valid location, optimization is trivial
    if n == 1:
        loc = valid_locations[0]
        return RouteResult(
            trip_type=trip_type,
            ordered_stops=[str(loc.id)],
            segments=[],
            total_distance_km=0.0,
            total_duration_min=0.0,
            naive_order_total_duration_min=0.0
        )

    # Setup OR-Tools Routing Model
    if trip_type == "one_way":
        # One-way / open path TSP: We add a dummy end node (index N)
        # Distance to and from dummy node is 0 to allow the tour to end anywhere.
        num_nodes = n + 1
        dummy_index = n
        
        # Build expanded duration matrix
        expanded_durations = [[0.0] * num_nodes for _ in range(num_nodes)]
        for i in range(n):
            for j in range(n):
                expanded_durations[i][j] = durations[i][j]
        # Durations to/from dummy are already 0.0

        manager = pywrapcp.RoutingIndexManager(num_nodes, 1, [start_index], [dummy_index])
        routing = pywrapcp.RoutingModel(manager)

        def duration_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return int(expanded_durations[from_node][to_node] * 100) # scale to integer

    else:
        # Round trip / closed loop TSP: Standard closed tour
        num_nodes = n
        manager = pywrapcp.RoutingIndexManager(num_nodes, 1, start_index)
        routing = pywrapcp.RoutingModel(manager)

        def duration_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return int(durations[from_node][to_node] * 100)

    transit_callback_index = routing.RegisterTransitCallback(duration_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Solve Routing
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )

    solution = routing.SolveWithParameters(search_parameters)

    # Extract optimized order of indices
    optimized_indices = []
    if solution:
        index = routing.Start(0)
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if trip_type != "one_way" or node != dummy_index:
                optimized_indices.append(node)
            index = solution.Value(routing.NextVar(index))
        # Add start node to the end of round trip
        if trip_type == "round_trip":
            optimized_indices.append(start_index)
    else:
        # Fallback to naive sequence if OR-Tools fails to solve
        optimized_indices = list(range(n))
        if trip_type == "round_trip":
            optimized_indices.append(0)

    # Build final RouteResult stops and segments
    ordered_stops = [str(valid_locations[idx].id) for idx in optimized_indices]
    segments = []
    total_dist = 0.0
    total_dur = 0.0

    for i in range(len(optimized_indices) - 1):
        from_idx = optimized_indices[i]
        to_idx = optimized_indices[i + 1]
        
        from_loc = valid_locations[from_idx]
        to_loc = valid_locations[to_idx]
        
        dist_km = distances[from_idx][to_idx]
        dur_min = durations[from_idx][to_idx]
        
        # Get actual route polyline
        polyline = get_osrm_polyline(
            (float(from_loc.latitude), float(from_loc.longitude)),
            (float(to_loc.latitude), float(to_loc.longitude))
        )
        
        segments.append(RouteSegment(
            from_location_id=str(from_loc.id),
            from_location_name=from_loc.name,
            to_location_id=str(to_loc.id),
            to_location_name=to_loc.name,
            distance_km=round(dist_km, 2),
            duration_min=round(dur_min, 1),
            polyline=polyline
        ))
        
        total_dist += dist_km
        total_dur += dur_min

    # Adjust stops list for round trip representation in result
    # We want unique stops list in ordered_stops (except round trip representation in frontend)
    # The frontend knows if it's round_trip to connect the final dot. Let's keep unique stops list in ordered_stops.
    unique_ordered_stops = []
    seen = set()
    for s_id in ordered_stops:
        if s_id not in seen:
            unique_ordered_stops.append(s_id)
            seen.add(s_id)

    return RouteResult(
        trip_type=trip_type,
        ordered_stops=unique_ordered_stops,
        segments=segments,
        total_distance_km=round(total_dist, 2),
        total_duration_min=round(total_dur, 1),
        naive_order_total_duration_min=round(naive_duration, 1)
    )
