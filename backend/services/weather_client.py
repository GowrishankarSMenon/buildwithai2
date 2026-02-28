"""
weather_client.py — OpenWeatherMap Real-Time Weather Service
==============================================================
Fetches real-time weather data for shipping locations using the
OpenWeatherMap API. Uses lat/lng coordinates from the LOCATIONS
list for accurate port-level weather.

Requires OPENWEATHER_API_KEY in the .env file.
Sign up at https://openweathermap.org/api (free tier available).
"""

import os
import requests
from dotenv import load_dotenv
from services.mock_data import LOCATIONS

# Load .env from backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"


def _get_api_key() -> str:
    """Get the OpenWeatherMap API key from environment."""
    key = os.getenv("OPENWEATHER_API_KEY", "")
    if not key:
        raise RuntimeError("OPENWEATHER_API_KEY not set in environment / .env file")
    return key


def _get_coords_for_location(location: str) -> tuple[float, float] | None:
    """Look up lat/lng for a location from the LOCATIONS list."""
    for loc in LOCATIONS:
        if loc["name"].lower() == location.lower():
            return loc["lat"], loc["lng"]
    return None


def _classify_weather_risk(weather_id: int, wind_speed: float) -> str:
    """
    Classify shipping weather risk based on OpenWeatherMap weather condition
    codes and wind speed.

    Weather condition codes: https://openweathermap.org/weather-conditions
      2xx = Thunderstorm
      3xx = Drizzle
      5xx = Rain
      6xx = Snow
      7xx = Atmosphere (fog, haze, etc.)
      800 = Clear
      80x = Clouds

    Wind speed thresholds (m/s):
      > 20 m/s (~39 knots) = high risk for shipping
      > 10 m/s (~19 knots) = medium risk
    """
    # Severe weather conditions
    if weather_id < 300:  # Thunderstorm
        return "high"
    if weather_id in (502, 503, 504):  # Heavy / extreme rain
        return "high"
    if weather_id in (602, 622):  # Heavy snow / shower sleet
        return "high"
    if weather_id >= 700 and weather_id < 800 and weather_id in (762, 781):
        # Volcanic ash, tornado
        return "high"

    # High wind
    if wind_speed > 20:
        return "high"

    # Moderate conditions
    if weather_id in (500, 501):  # Moderate rain
        return "medium"
    if weather_id >= 300 and weather_id < 400:  # Drizzle
        return "medium"
    if weather_id >= 600 and weather_id < 700:  # Snow (other)
        return "medium"
    if weather_id >= 700 and weather_id < 800:  # Fog, haze, mist
        return "medium"
    if wind_speed > 10:
        return "medium"

    return "low"


def _build_weather_detail(data: dict, location: str) -> str:
    """Build a human-readable weather detail string from API response."""
    weather_desc = data["weather"][0]["description"].capitalize()
    temp = round(data["main"]["temp"])
    feels_like = round(data["main"]["feels_like"])
    humidity = data["main"]["humidity"]
    wind_speed = round(data["wind"]["speed"], 1)
    wind_knots = round(wind_speed * 1.944, 1)  # m/s to knots

    parts = [
        f"{weather_desc} at {location}",
        f"Temp: {temp}°C (feels like {feels_like}°C)",
        f"Humidity: {humidity}%",
        f"Wind: {wind_speed} m/s ({wind_knots} knots)",
    ]

    # Add visibility if available
    visibility = data.get("visibility")
    if visibility is not None:
        parts.append(f"Visibility: {visibility / 1000:.1f} km")

    # Add rain info if present
    rain = data.get("rain")
    if rain:
        rain_1h = rain.get("1h", 0)
        if rain_1h:
            parts.append(f"Rain (1h): {rain_1h} mm")

    return " | ".join(parts)


def fetch_realtime_weather(location: str, country: str = "") -> dict:
    """
    Fetch real-time weather data for a shipping location using
    the OpenWeatherMap API.

    Returns dict matching the mock_data weather format:
        {
            "risk": str,       # "low", "medium", "high"
            "detail": str,     # Human-readable weather description
            "temp_c": int,     # Temperature in Celsius
            "condition": str,  # Main weather condition
            "source": "openweathermap",
        }
    """
    try:
        api_key = _get_api_key()
    except RuntimeError as e:
        return {
            "risk": "low",
            "detail": str(e),
            "temp_c": 20,
            "condition": "Unknown",
            "source": "error",
        }

    # Try lat/lng first (more accurate for ports)
    coords = _get_coords_for_location(location)

    try:
        if coords:
            lat, lng = coords
            params = {
                "lat": lat,
                "lon": lng,
                "appid": api_key,
                "units": "metric",
            }
        else:
            # Fallback to city name search
            query = f"{location},{country}" if country else location
            params = {
                "q": query,
                "appid": api_key,
                "units": "metric",
            }

        response = requests.get(OPENWEATHER_BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        weather_id = data["weather"][0]["id"]
        wind_speed = data["wind"].get("speed", 0)
        temp_c = round(data["main"]["temp"])
        condition = data["weather"][0]["main"]  # e.g. "Rain", "Clear", "Clouds"

        risk = _classify_weather_risk(weather_id, wind_speed)
        detail = _build_weather_detail(data, location)

        result = {
            "risk": risk,
            "detail": detail,
            "temp_c": temp_c,
            "condition": condition,
            "source": "openweathermap",
        }
        print(f"\n[WeatherAPI] {location}: {condition}, {temp_c}°C, Wind: {wind_speed} m/s, Risk: {risk}")
        print(f"[WeatherAPI] Detail: {detail}")
        return result

    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response else "unknown"
        return {
            "risk": "low",
            "detail": f"Weather API HTTP error ({status}) for {location}: {str(e)}",
            "temp_c": 20,
            "condition": "Error",
            "source": "error",
        }
    except requests.exceptions.RequestException as e:
        return {
            "risk": "low",
            "detail": f"Weather API request failed for {location}: {str(e)}",
            "temp_c": 20,
            "condition": "Error",
            "source": "error",
        }
    except (KeyError, IndexError) as e:
        return {
            "risk": "low",
            "detail": f"Unexpected weather API response for {location}: {str(e)}",
            "temp_c": 20,
            "condition": "Error",
            "source": "error",
        }
