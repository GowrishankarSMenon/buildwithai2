"""
db_service.py — SQLite Database Service for Indian Ports & Airports
====================================================================
Queries the indian_ports.db for port and airport data.
Provides city-based search, coordinate lookup, and distance calculations.
"""

import sqlite3
import os
import math
from functools import lru_cache

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "indian_ports.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ── Fetch All ─────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_all_ports() -> list[dict]:
    """Return all sea ports with coordinates."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, name, city, state, port_type, coast, latitude, longitude, "
        "cargo_types, annual_capacity_mt, natural_depth_m, un_locode FROM ports "
        "WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@lru_cache(maxsize=1)
def get_all_airports() -> list[dict]:
    """Return all airports with coordinates."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, name, city, state, airport_type, iata_code, icao_code, "
        "latitude, longitude, elevation_m, terminals FROM airports "
        "WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_nodes() -> list[dict]:
    """Return all ports and airports as unified transport nodes."""
    nodes = []
    for p in get_all_ports():
        nodes.append({
            "id": f"port_{p['id']}",
            "name": p["name"],
            "city": p["city"] or "",
            "state": p["state"],
            "lat": p["latitude"],
            "lng": p["longitude"],
            "type": "port",
            "subtype": p["port_type"],
            "coast": p.get("coast", ""),
            "code": p.get("un_locode", ""),
        })
    for a in get_all_airports():
        nodes.append({
            "id": f"airport_{a['id']}",
            "name": a["name"],
            "city": a["city"] or "",
            "state": a["state"],
            "lat": a["latitude"],
            "lng": a["longitude"],
            "type": "airport",
            "subtype": a["airport_type"],
            "coast": "",
            "code": a.get("iata_code", ""),
        })
    return nodes


# ── City / Location Search ────────────────────────────────────────────

def get_unique_cities() -> list[dict]:
    """
    Return unique cities that have at least one port or airport.
    Each entry includes the city name, state, and what's available there.
    """
    cities: dict[str, dict] = {}

    for p in get_all_ports():
        city = (p["city"] or p["name"]).strip()
        key = f"{city}|{p['state']}"
        if key not in cities:
            cities[key] = {
                "city": city,
                "state": p["state"],
                "lat": p["latitude"],
                "lng": p["longitude"],
                "has_port": True,
                "has_airport": False,
                "port_count": 0,
                "airport_count": 0,
            }
        cities[key]["has_port"] = True
        cities[key]["port_count"] = cities[key].get("port_count", 0) + 1

    for a in get_all_airports():
        city = (a["city"] or "").strip()
        if not city:
            continue
        key = f"{city}|{a['state']}"
        if key not in cities:
            cities[key] = {
                "city": city,
                "state": a["state"],
                "lat": a["latitude"],
                "lng": a["longitude"],
                "has_port": False,
                "has_airport": False,
                "port_count": 0,
                "airport_count": 0,
            }
        cities[key]["has_airport"] = True
        cities[key]["airport_count"] = cities[key].get("airport_count", 0) + 1

    return sorted(cities.values(), key=lambda c: c["city"])


def search_cities(query: str) -> list[dict]:
    """Search cities by name (case-insensitive substring match)."""
    q = query.lower().strip()
    if not q:
        return get_unique_cities()
    return [c for c in get_unique_cities() if q in c["city"].lower() or q in c["state"].lower()]


# ── Distance Utilities ────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lng points in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_nearest_nodes(lat: float, lng: float, node_type: str | None = None, limit: int = 5) -> list[dict]:
    """Find the nearest transport nodes to a given coordinate."""
    nodes = get_all_nodes()
    if node_type:
        nodes = [n for n in nodes if n["type"] == node_type]

    for n in nodes:
        n["distance_km"] = haversine_km(lat, lng, n["lat"], n["lng"])

    nodes.sort(key=lambda n: n["distance_km"])
    return nodes[:limit]


def find_nodes_in_city(city_name: str, state: str | None = None) -> dict:
    """Find all ports and airports in/near a city."""
    ports = []
    airports = []

    for p in get_all_ports():
        p_city = (p["city"] or "").lower()
        p_name = p["name"].lower()
        if city_name.lower() in p_city or city_name.lower() in p_name:
            if state and state.lower() != p["state"].lower():
                continue
            ports.append({
                "id": f"port_{p['id']}",
                "name": p["name"],
                "city": p["city"],
                "state": p["state"],
                "lat": p["latitude"],
                "lng": p["longitude"],
                "type": "port",
                "subtype": p["port_type"],
                "coast": p.get("coast", ""),
            })

    for a in get_all_airports():
        a_city = (a["city"] or "").lower()
        a_name = a["name"].lower()
        if city_name.lower() in a_city or city_name.lower() in a_name:
            if state and state.lower() != a["state"].lower():
                continue
            airports.append({
                "id": f"airport_{a['id']}",
                "name": a["name"],
                "city": a["city"],
                "state": a["state"],
                "lat": a["latitude"],
                "lng": a["longitude"],
                "type": "airport",
                "subtype": a["airport_type"],
                "code": a.get("iata_code", ""),
            })

    return {"ports": ports, "airports": airports}
