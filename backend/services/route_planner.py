"""
route_planner.py — Multi-Modal Route Planning Service
======================================================
Given a source city, destination city, and optional intermediate cities,
computes the optimal combination of sea routes + air routes that yields
the least total cost.  Also returns the 3 next-best alternatives.

Cost Model (simplified but realistic-feeling):
  • Sea freight: ~$0.05 per km  (cheap but slow: ~30 km/h effective)
  • Air freight: ~$0.50 per km  (expensive but fast: ~500 km/h effective)
  • Intermodal transfer (port<->airport same city): $2,000 flat + 0.5 day

The planner uses a graph-based approach:
  1. For each city, gather available ports + airports as nodes.
  2. Build edges: sea-sea, air-air, and intermodal (same-city port<->airport).
  3. Run modified Dijkstra for top-4 lowest-cost routes.
"""

from __future__ import annotations
import heapq
import math
from dataclasses import dataclass, field
from services.db_service import (
    get_all_nodes,
    find_nodes_in_city,
    find_nearest_nodes,
    haversine_km,
)


# ── Cost Constants ────────────────────────────────────────────────────

SEA_COST_PER_KM = 0.05        # USD
AIR_COST_PER_KM = 0.50        # USD
INTERMODAL_FLAT  = 2000.0     # USD per port<->airport transfer
SEA_SPEED_KMH   = 30.0
AIR_SPEED_KMH   = 500.0
INTERMODAL_HOURS = 12.0       # half-day transfer
PORT_HANDLING_HR = 6.0        # hours dwell at each sea port
AIRPORT_HANDLING_HR = 3.0     # hours dwell at each airport


@dataclass
class RouteNode:
    """A single node in a planned route."""
    node_id: str
    name: str
    city: str
    state: str
    lat: float
    lng: float
    node_type: str          # "port" | "airport"
    subtype: str            # "Major" / "International" / etc.
    code: str = ""

    def to_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "name": self.name,
            "city": self.city,
            "state": self.state,
            "lat": self.lat,
            "lng": self.lng,
            "node_type": self.node_type,
            "subtype": self.subtype,
            "code": self.code,
        }


@dataclass
class RouteSegment:
    """A segment between two consecutive route nodes."""
    from_node: RouteNode
    to_node: RouteNode
    transport_mode: str   # "sea" | "air" | "intermodal"
    distance_km: float
    cost_usd: float
    time_hours: float
    cumulative_cost: float
    cumulative_time_hours: float

    def to_dict(self) -> dict:
        return {
            "from": self.from_node.to_dict(),
            "to": self.to_node.to_dict(),
            "transport_mode": self.transport_mode,
            "distance_km": round(self.distance_km, 1),
            "cost_usd": round(self.cost_usd, 2),
            "time_hours": round(self.time_hours, 1),
            "cumulative_cost": round(self.cumulative_cost, 2),
            "cumulative_time_hours": round(self.cumulative_time_hours, 1),
        }


@dataclass
class PlannedRoute:
    """A complete planned route with segments, total cost, time."""
    route_id: int
    label: str
    segments: list[RouteSegment]
    total_cost: float
    total_time_hours: float
    total_distance_km: float
    transport_modes_used: list[str]  # e.g. ["sea", "air"]

    def to_dict(self) -> dict:
        return {
            "route_id": self.route_id,
            "label": self.label,
            "segments": [s.to_dict() for s in self.segments],
            "total_cost": round(self.total_cost, 2),
            "total_time_hours": round(self.total_time_hours, 1),
            "total_distance_km": round(self.total_distance_km, 1),
            "transport_modes_used": self.transport_modes_used,
            "node_count": len(self.segments) + 1,
        }


# ── Graph Building ────────────────────────────────────────────────────

def _segment_cost(n1: dict, n2: dict) -> tuple[str, float, float, float]:
    """
    Compute transport mode, cost, time, and distance between two nodes.
    Returns (mode, cost_usd, time_hours, distance_km).
    """
    dist = haversine_km(n1["lat"], n1["lng"], n2["lat"], n2["lng"])

    # Same-city intermodal transfer (port <-> airport)
    if n1["type"] != n2["type"] and dist < 100:
        return "intermodal", INTERMODAL_FLAT, INTERMODAL_HOURS, dist

    if n1["type"] == "airport" and n2["type"] == "airport":
        cost = dist * AIR_COST_PER_KM
        time_h = dist / AIR_SPEED_KMH + AIRPORT_HANDLING_HR
        return "air", cost, time_h, dist

    if n1["type"] == "port" and n2["type"] == "port":
        # Sea distance is roughly 1.4x great-circle for coastal routing
        sea_dist = dist * 1.4
        cost = sea_dist * SEA_COST_PER_KM
        time_h = sea_dist / SEA_SPEED_KMH + PORT_HANDLING_HR
        return "sea", cost, time_h, sea_dist

    # Mixed (port→airport or airport→port) over distance — air pricing
    cost = dist * AIR_COST_PER_KM + INTERMODAL_FLAT
    time_h = dist / AIR_SPEED_KMH + INTERMODAL_HOURS
    return "air", cost, time_h, dist


def _resolve_city_nodes(city_name: str, state: str | None = None) -> list[dict]:
    """Get all transport nodes in a city. Falls back to nearest nodes."""
    result = find_nodes_in_city(city_name, state)
    nodes = []
    for p in result["ports"]:
        nodes.append(p)
    for a in result["airports"]:
        nodes.append(a)

    if not nodes:
        # Fallback: search by partial match in all nodes
        all_nodes = get_all_nodes()
        q = city_name.lower()
        nodes = [n for n in all_nodes if q in n["city"].lower() or q in n["name"].lower() or q in n["state"].lower()]

    return nodes[:10]  # cap at 10 to keep graph manageable


# ── Route Computation  ────────────────────────────────────────────────

@dataclass(order=True)
class _State:
    cost: float
    node_id: str = field(compare=False)
    path: list = field(compare=False, default_factory=list)
    time_hrs: float = field(compare=False, default=0.0)
    distance_km: float = field(compare=False, default=0.0)


def compute_routes(
    source_city: str,
    dest_city: str,
    intermediate_cities: list[str] | None = None,
    source_state: str | None = None,
    dest_state: str | None = None,
    num_routes: int = 4,
) -> list[PlannedRoute]:
    """
    Compute the top N lowest-cost multi-modal routes between cities.

    The approach:
    - If intermediate stops are specified, plan segment-by-segment
      (source → stop1 → stop2 → ... → dest) and for each leg find the
      cheapest node-to-node path.
    - Returns up to `num_routes` route alternatives (1 best + 3 next-best).
    """
    intermediates = intermediate_cities or []
    city_sequence = [source_city] + intermediates + [dest_city]
    state_sequence = [source_state] + [None] * len(intermediates) + [dest_state]

    # Resolve nodes for each city
    city_nodes: list[list[dict]] = []
    for i, city in enumerate(city_sequence):
        nodes = _resolve_city_nodes(city, state_sequence[i] if i < len(state_sequence) else None)
        if not nodes:
            # Try nearest to approximate coordinates
            nodes = _resolve_city_nodes(city)
        city_nodes.append(nodes)

    # For each consecutive leg, compute all possible node-pair costs
    # Then enumerate combinations to find top-N total routes

    all_routes: list[PlannedRoute] = []

    # Strategy: generate candidate routes by trying different node choices
    # at each city, then pick the top-N by total cost.

    def _build_routes_recursive(
        leg_idx: int,
        current_node: dict | None,
        segments_so_far: list[RouteSegment],
        cum_cost: float,
        cum_time: float,
        cum_dist: float,
        visited_ids: set,
    ):
        if leg_idx >= len(city_sequence):
            modes = list(set(s.transport_mode for s in segments_so_far if s.transport_mode != "intermodal"))
            all_routes.append(PlannedRoute(
                route_id=len(all_routes) + 1,
                label="",
                segments=list(segments_so_far),
                total_cost=cum_cost,
                total_time_hours=cum_time,
                total_distance_km=cum_dist,
                transport_modes_used=modes or ["sea"],
            ))
            return

        target_nodes = city_nodes[leg_idx]

        if current_node is None:
            # First city — just pick starting nodes
            for node in target_nodes[:4]:  # limit branching
                rn = RouteNode(
                    node_id=node["id"], name=node["name"],
                    city=node.get("city", ""), state=node.get("state", ""),
                    lat=node["lat"], lng=node["lng"],
                    node_type=node["type"], subtype=node.get("subtype", ""),
                    code=node.get("code", ""),
                )
                _build_routes_recursive(
                    leg_idx + 1, node, segments_so_far, cum_cost, cum_time, cum_dist,
                    visited_ids | {node["id"]},
                )
            return

        # Subsequent city — compute segments from current_node to each target node
        candidates = []
        for tgt in target_nodes:
            if tgt["id"] in visited_ids:
                continue
            mode, cost, time_h, dist = _segment_cost(current_node, tgt)
            candidates.append((cost, tgt, mode, time_h, dist))

        candidates.sort(key=lambda x: x[0])

        for cost, tgt, mode, time_h, dist in candidates[:3]:  # limit branching
            from_rn = RouteNode(
                node_id=current_node["id"], name=current_node["name"],
                city=current_node.get("city", ""), state=current_node.get("state", ""),
                lat=current_node["lat"], lng=current_node["lng"],
                node_type=current_node["type"], subtype=current_node.get("subtype", ""),
                code=current_node.get("code", ""),
            )
            to_rn = RouteNode(
                node_id=tgt["id"], name=tgt["name"],
                city=tgt.get("city", ""), state=tgt.get("state", ""),
                lat=tgt["lat"], lng=tgt["lng"],
                node_type=tgt["type"], subtype=tgt.get("subtype", ""),
                code=tgt.get("code", ""),
            )
            new_cum_cost = cum_cost + cost
            new_cum_time = cum_time + time_h
            new_cum_dist = cum_dist + dist
            seg = RouteSegment(
                from_node=from_rn, to_node=to_rn,
                transport_mode=mode, distance_km=dist,
                cost_usd=cost, time_hours=time_h,
                cumulative_cost=new_cum_cost,
                cumulative_time_hours=new_cum_time,
            )
            _build_routes_recursive(
                leg_idx + 1, tgt, segments_so_far + [seg],
                new_cum_cost, new_cum_time, new_cum_dist,
                visited_ids | {tgt["id"]},
            )

    _build_routes_recursive(0, None, [], 0.0, 0.0, 0.0, set())

    # Sort by total cost and pick top N
    all_routes.sort(key=lambda r: r.total_cost)

    # Deduplicate routes that use exactly the same node sequence
    seen_sequences: set[str] = set()
    unique_routes: list[PlannedRoute] = []
    for r in all_routes:
        seq = "|".join(s.from_node.node_id for s in r.segments)
        if r.segments:
            seq += "|" + r.segments[-1].to_node.node_id
        if seq in seen_sequences:
            continue
        seen_sequences.add(seq)
        unique_routes.append(r)
        if len(unique_routes) >= num_routes:
            break

    # Label them
    labels = ["Best Route (Lowest Cost)", "Alternative 1", "Alternative 2", "Alternative 3"]
    for i, r in enumerate(unique_routes):
        r.route_id = i + 1
        r.label = labels[i] if i < len(labels) else f"Alternative {i}"

    return unique_routes
