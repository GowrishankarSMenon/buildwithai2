"""
mock_data.py — Hardcoded Mock Data for Locations, Weather & Disruptions
========================================================================
Provides realistic fake data for 10 major shipping hub locations:
  weather conditions, port disruptions, and location metadata.
"""

# ── 10 Fixed Shipping Locations ──────────────────────────────────────

LOCATIONS = [
    {"name": "Shanghai",    "country": "China",       "type": "port",    "lat": 31.2304,  "lng": 121.4737},
    {"name": "Singapore",   "country": "Singapore",   "type": "port",    "lat": 1.2644,   "lng": 103.8222},
    {"name": "Mumbai",      "country": "India",       "type": "port",    "lat": 18.9500,  "lng": 72.9500},
    {"name": "Dubai",       "country": "UAE",         "type": "port",    "lat": 25.0143,  "lng": 55.0802},
    {"name": "Rotterdam",   "country": "Netherlands", "type": "port",    "lat": 51.9054,  "lng": 4.4666},
    {"name": "Los Angeles", "country": "USA",         "type": "port",    "lat": 33.7405,  "lng": -118.2723},
    {"name": "Colombo",     "country": "Sri Lanka",   "type": "port",    "lat": 6.9497,   "lng": 79.8428},
    {"name": "Tokyo",       "country": "Japan",       "type": "port",    "lat": 35.6762,  "lng": 139.6503},
    {"name": "Hamburg",     "country": "Germany",     "type": "port",    "lat": 53.5511,  "lng": 9.9937},
    {"name": "Sydney",      "country": "Australia",   "type": "port",    "lat": -33.8688, "lng": 151.2093},
]

LOCATION_NAMES = [loc["name"] for loc in LOCATIONS]


# ── Mock Weather Data (per location) ────────────────────────────────

WEATHER_DATA: dict[str, dict] = {
    "Shanghai": {
        "risk": "high",
        "detail": "Typhoon warning active in East China Sea — heavy rain, 60 km/h winds, port operations intermittent",
        "temp_c": 28,
        "condition": "Typhoon",
    },
    "Singapore": {
        "risk": "low",
        "detail": "Clear skies with light tropical showers — no impact on port operations",
        "temp_c": 32,
        "condition": "Partly Cloudy",
    },
    "Mumbai": {
        "risk": "high",
        "detail": "Monsoon season — continuous heavy rainfall causing waterlogging near port, reduced crane operations",
        "temp_c": 29,
        "condition": "Heavy Rain",
    },
    "Dubai": {
        "risk": "low",
        "detail": "Clear and dry conditions — optimal port operations, visibility excellent",
        "temp_c": 42,
        "condition": "Sunny",
    },
    "Rotterdam": {
        "risk": "medium",
        "detail": "Dense fog advisory along North Sea coast — vessel speed restrictions in channel approach",
        "temp_c": 8,
        "condition": "Fog",
    },
    "Los Angeles": {
        "risk": "medium",
        "detail": "Santa Ana winds gusting to 45 km/h — minor delays in container handling at Long Beach",
        "temp_c": 24,
        "condition": "Windy",
    },
    "Colombo": {
        "risk": "medium",
        "detail": "Southwest monsoon bringing moderate rainfall — slight delays in cargo loading/unloading",
        "temp_c": 30,
        "condition": "Moderate Rain",
    },
    "Tokyo": {
        "risk": "low",
        "detail": "Calm seas and clear weather — Yokohama port operating at full capacity",
        "temp_c": 18,
        "condition": "Clear",
    },
    "Hamburg": {
        "risk": "high",
        "detail": "North Sea storm surge warning — Elbe river traffic suspended, 3-day port closure expected",
        "temp_c": 4,
        "condition": "Storm",
    },
    "Sydney": {
        "risk": "low",
        "detail": "Mild autumn weather — all berths operational, no weather-related delays",
        "temp_c": 22,
        "condition": "Clear",
    },
}


# ── Mock Disruption Events (port strikes, congestion, etc.) ─────────

DISRUPTION_DATA: dict[str, dict] = {
    "Shanghai": {
        "active": True,
        "type": "Port Congestion",
        "detail": "Severe container backlog — 45+ vessels anchored waiting for berth, avg wait time 4 days",
        "severity": "high",
        "extra_delay_days": 4.0,
    },
    "Singapore": {
        "active": False,
        "type": "None",
        "detail": "No active disruptions — port operating normally at 92% capacity",
        "severity": "low",
        "extra_delay_days": 0.0,
    },
    "Mumbai": {
        "active": True,
        "type": "Customs Delay",
        "detail": "New customs inspection mandate — 100% container scanning causing 2-day processing backlog",
        "severity": "medium",
        "extra_delay_days": 2.0,
    },
    "Dubai": {
        "active": False,
        "type": "None",
        "detail": "No active disruptions — Jebel Ali port runs ahead of schedule",
        "severity": "low",
        "extra_delay_days": 0.0,
    },
    "Rotterdam": {
        "active": True,
        "type": "Port Strike",
        "detail": "Dockworkers' union strike over automation — terminal operations halted for estimated 5 days",
        "severity": "high",
        "extra_delay_days": 5.0,
    },
    "Los Angeles": {
        "active": True,
        "type": "Port Congestion",
        "detail": "Supply chain surge — 30+ container ships queued offshore, 3-day average berthing delay",
        "severity": "medium",
        "extra_delay_days": 3.0,
    },
    "Colombo": {
        "active": True,
        "type": "Equipment Shortage",
        "detail": "Crane maintenance backlog — only 60% gantry cranes operational, slower cargo handling",
        "severity": "medium",
        "extra_delay_days": 1.5,
    },
    "Tokyo": {
        "active": False,
        "type": "None",
        "detail": "No active disruptions — Yokohama and Tokyo Bay ports operating at full efficiency",
        "severity": "low",
        "extra_delay_days": 0.0,
    },
    "Hamburg": {
        "active": True,
        "type": "Port Strike",
        "detail": "Labor dispute at Eurogate terminal — partial shutdown, only 2 of 4 terminals accepting cargo",
        "severity": "high",
        "extra_delay_days": 3.5,
    },
    "Sydney": {
        "active": False,
        "type": "None",
        "detail": "No active disruptions — Port Botany operating smoothly",
        "severity": "low",
        "extra_delay_days": 0.0,
    },
}

# ── Default fallback for unknown locations ───────────────────────────

DEFAULT_WEATHER = {
    "risk": "low",
    "detail": "No weather data available for this location — assuming clear conditions",
    "temp_c": 20,
    "condition": "Unknown",
}

DEFAULT_DISRUPTION = {
    "active": False,
    "type": "None",
    "detail": "No disruption data available for this location",
    "severity": "low",
    "extra_delay_days": 0.0,
}


def get_weather(location: str) -> dict:
    """Get mock weather data for a location."""
    return WEATHER_DATA.get(location, DEFAULT_WEATHER)


def get_disruption(location: str) -> dict:
    """Get mock disruption event data for a location."""
    return DISRUPTION_DATA.get(location, DEFAULT_DISRUPTION)


def get_location_info(location: str) -> dict:
    """Get combined weather + disruption data for a location."""
    return {
        "location": location,
        "weather": get_weather(location),
        "disruption": get_disruption(location),
    }
