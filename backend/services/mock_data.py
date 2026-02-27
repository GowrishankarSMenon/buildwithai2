"""
mock_data.py — Hardcoded Mock Data for Locations, Weather & Disruptions
========================================================================
Provides realistic fake data for 10 major Indian shipping ports:
  weather conditions, port disruptions, and location metadata.
"""

# ── 10 Real Indian Ports ──────────────────────────────────────

LOCATIONS = [
    {"name": "Nhava Sheva (JNPT)", "country": "India", "type": "port", "lat": 18.9490,  "lng": 72.9510},
    {"name": "Chennai",            "country": "India", "type": "port", "lat": 13.0827,  "lng": 80.2707},
    {"name": "Kochi",              "country": "India", "type": "port", "lat": 9.9312,   "lng": 76.2673},
    {"name": "Visakhapatnam",      "country": "India", "type": "port", "lat": 17.6868,  "lng": 83.2185},
    {"name": "Mundra",             "country": "India", "type": "port", "lat": 22.8394,  "lng": 69.7250},
    {"name": "Kolkata (Haldia)",   "country": "India", "type": "port", "lat": 22.0257,  "lng": 88.0583},
    {"name": "Kandla",             "country": "India", "type": "port", "lat": 23.0333,  "lng": 70.2167},
    {"name": "Tuticorin",          "country": "India", "type": "port", "lat": 8.7642,   "lng": 78.1348},
    {"name": "New Mangalore",      "country": "India", "type": "port", "lat": 12.9141,  "lng": 74.8560},
    {"name": "Paradip",            "country": "India", "type": "port", "lat": 20.2644,  "lng": 86.6085},
]

LOCATION_NAMES = [loc["name"] for loc in LOCATIONS]


# ── Mock Weather Data (per location) ────────────────────────────────

WEATHER_DATA: dict[str, dict] = {
    "Nhava Sheva (JNPT)": {
        "risk": "high",
        "detail": "Monsoon season — continuous heavy rainfall causing waterlogging near port, reduced crane operations at JNPT",
        "temp_c": 29,
        "condition": "Heavy Rain",
    },
    "Chennai": {
        "risk": "medium",
        "detail": "Northeast monsoon bringing moderate to heavy rainfall — intermittent delays in cargo handling at Chennai port",
        "temp_c": 30,
        "condition": "Rain",
    },
    "Kochi": {
        "risk": "medium",
        "detail": "Southwest monsoon active — moderate rainfall affecting Cochin port operations, slight berthing delays",
        "temp_c": 28,
        "condition": "Moderate Rain",
    },
    "Visakhapatnam": {
        "risk": "high",
        "detail": "Cyclone warning in Bay of Bengal — Visakhapatnam port on high alert, vessel movements restricted",
        "temp_c": 31,
        "condition": "Cyclone Warning",
    },
    "Mundra": {
        "risk": "low",
        "detail": "Clear and dry conditions — Mundra port operating at full capacity, no weather-related disruptions",
        "temp_c": 35,
        "condition": "Sunny",
    },
    "Kolkata (Haldia)": {
        "risk": "high",
        "detail": "Heavy rainfall and river flooding — Hooghly river channel depth reduced, draft restrictions in effect at Haldia",
        "temp_c": 33,
        "condition": "Heavy Rain",
    },
    "Kandla": {
        "risk": "low",
        "detail": "Clear skies with moderate temperatures — Kandla port (Deendayal Port) operating normally",
        "temp_c": 36,
        "condition": "Clear",
    },
    "Tuticorin": {
        "risk": "low",
        "detail": "Warm and dry conditions — V.O. Chidambaranar Port operating at full capacity",
        "temp_c": 32,
        "condition": "Clear",
    },
    "New Mangalore": {
        "risk": "medium",
        "detail": "Monsoon showers along Karnataka coast — minor delays in bulk cargo handling at New Mangalore port",
        "temp_c": 27,
        "condition": "Light Rain",
    },
    "Paradip": {
        "risk": "medium",
        "detail": "Bay of Bengal low-pressure system — rough seas causing minor delays for vessel anchorage at Paradip port",
        "temp_c": 30,
        "condition": "Overcast",
    },
}


# ── Mock Disruption Events (port strikes, congestion, etc.) ─────────

DISRUPTION_DATA: dict[str, dict] = {
    "Nhava Sheva (JNPT)": {
        "active": True,
        "type": "Port Congestion",
        "detail": "Severe container backlog at JNPT — 30+ vessels anchored waiting for berth, avg wait time 3 days due to monsoon & volume surge",
        "severity": "high",
        "extra_delay_days": 3.0,
    },
    "Chennai": {
        "active": True,
        "type": "Customs Delay",
        "detail": "New customs inspection mandate at Chennai port — 100% container scanning causing 2-day processing backlog",
        "severity": "medium",
        "extra_delay_days": 2.0,
    },
    "Kochi": {
        "active": False,
        "type": "None",
        "detail": "No active disruptions — Cochin port operating at 85% capacity with normal turnaround times",
        "severity": "low",
        "extra_delay_days": 0.0,
    },
    "Visakhapatnam": {
        "active": True,
        "type": "Port Closure",
        "detail": "Cyclone-related port closure — all vessel movements suspended at Visakhapatnam, expected reopening in 2 days",
        "severity": "high",
        "extra_delay_days": 4.0,
    },
    "Mundra": {
        "active": False,
        "type": "None",
        "detail": "No active disruptions — Adani Mundra port running ahead of schedule with excellent throughput",
        "severity": "low",
        "extra_delay_days": 0.0,
    },
    "Kolkata (Haldia)": {
        "active": True,
        "type": "Draft Restriction",
        "detail": "Hooghly river silting — draft limited to 8m, larger vessels diverted, 1.5-day avg delay at Haldia dock",
        "severity": "medium",
        "extra_delay_days": 1.5,
    },
    "Kandla": {
        "active": True,
        "type": "Equipment Shortage",
        "detail": "Crane maintenance backlog at Deendayal Port — only 60% gantry cranes operational, slower cargo handling",
        "severity": "medium",
        "extra_delay_days": 1.5,
    },
    "Tuticorin": {
        "active": False,
        "type": "None",
        "detail": "No active disruptions — V.O. Chidambaranar Port operating smoothly with normal throughput",
        "severity": "low",
        "extra_delay_days": 0.0,
    },
    "New Mangalore": {
        "active": False,
        "type": "None",
        "detail": "No active disruptions — New Mangalore port operations normal, no congestion",
        "severity": "low",
        "extra_delay_days": 0.0,
    },
    "Paradip": {
        "active": True,
        "type": "Port Congestion",
        "detail": "Bulk cargo surge at Paradip port — coal and iron ore exports causing berthing delays of 2+ days",
        "severity": "medium",
        "extra_delay_days": 2.0,
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
