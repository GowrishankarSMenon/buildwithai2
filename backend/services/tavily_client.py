"""
tavily_client.py — Tavily Real-Time Disruption Data Service
=============================================================
Fetches real-time supply chain disruption data for locations using
the Tavily Search API. Searches for port strikes, wars, political
issues, weather disruptions, and other events affecting shipping.
"""

import os
import re
from dotenv import load_dotenv
from tavily import TavilyClient

# Load .env from backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_client = None


def _get_client() -> TavilyClient:
    """Lazy-init Tavily client."""
    global _client
    if _client is None:
        api_key = os.getenv("TAVILY_API_KEY", "")
        if not api_key:
            raise RuntimeError("TAVILY_API_KEY not set in environment / .env file")
        _client = TavilyClient(api_key=api_key)
    return _client


def _classify_severity(text: str) -> str:
    """Heuristic severity classifier based on content keywords."""
    text_lower = text.lower()
    high_keywords = ["war", "conflict", "military", "bombing", "attack", "blockade",
                     "closure", "shutdown", "strike", "halt", "suspend", "critical",
                     "severe", "catastroph", "crisis", "emergency", "evacuat"]
    medium_keywords = ["delay", "congestion", "tension", "protest", "sanction",
                       "restriction", "slow", "backlog", "dispute", "warning",
                       "instability", "unrest", "disruption"]

    if any(kw in text_lower for kw in high_keywords):
        return "high"
    if any(kw in text_lower for kw in medium_keywords):
        return "medium"
    return "low"


def _estimate_delay(severity: str) -> float:
    """Estimate extra delay days based on severity."""
    return {"high": 5.0, "medium": 2.5, "low": 0.0}.get(severity, 0.0)


def _classify_disruption_type(text: str) -> str:
    """Classify disruption type from text content."""
    text_lower = text.lower()
    if any(w in text_lower for w in ["strike", "labor", "union", "worker"]):
        return "Port Strike"
    if any(w in text_lower for w in ["war", "military", "conflict", "attack", "bombing"]):
        return "Armed Conflict"
    if any(w in text_lower for w in ["politic", "sanction", "election", "coup", "govern", "protest", "unrest"]):
        return "Political Instability"
    if any(w in text_lower for w in ["typhoon", "hurricane", "storm", "flood", "earthquake", "tsunami"]):
        return "Natural Disaster"
    if any(w in text_lower for w in ["congestion", "backlog", "queue", "capacity"]):
        return "Port Congestion"
    if any(w in text_lower for w in ["customs", "inspection", "regulation", "ban"]):
        return "Customs/Regulatory"
    if any(w in text_lower for w in ["piracy", "security", "threat"]):
        return "Security Threat"
    return "Supply Chain Disruption"


def fetch_realtime_disruptions(location: str, country: str = "") -> dict:
    """
    Fetch real-time disruption data for a shipping location using Tavily.

    Searches for: port strikes, wars, political issues, weather disruptions,
    and any other events that could affect shipping at this location.

    Returns dict matching the mock_data disruption format:
        {
            "active": bool,
            "type": str,
            "detail": str,
            "severity": str,  # "low", "medium", "high"
            "extra_delay_days": float,
            "source": "realtime",
            "sources": [list of source URLs]
        }
    """
    location_str = f"{location}, {country}" if country else location

    query = (
        f"port disruption OR strike OR political crisis OR war OR conflict "
        f"OR shipping delay OR supply chain disruption at {location_str} port "
        f"in the last 7 days 2026"
    )

    try:
        client = _get_client()
        response = client.search(
            query=query,
            search_depth="advanced",
            max_results=5,
            include_answer=True,
        )

        answer = response.get("answer", "")
        results = response.get("results", [])
        sources = [r.get("url", "") for r in results if r.get("url")]

        # Combine all content for analysis
        all_content = answer + " " + " ".join(
            r.get("content", "") for r in results
        )
        print(all_content)
        if not all_content.strip():
            return {
                "active": False,
                "type": "None",
                "detail": f"No real-time disruption data found for {location}",
                "severity": "low",
                "extra_delay_days": 0.0,
                "source": "realtime",
                "sources": [],
            }

        # Classify the disruption
        severity = _classify_severity(all_content)
        disruption_type = _classify_disruption_type(all_content)
        extra_delay = _estimate_delay(severity)
        is_active = severity in ("medium", "high")

        # Use Tavily's answer as the detail (truncated)
        detail = answer.strip() if answer.strip() else (
            results[0].get("content", "")[:300] if results else
            f"No specific disruption data for {location}"
        )
        # Clean up detail
        detail = detail[:500]

        return {
            "active": is_active,
            "type": disruption_type if is_active else "None",
            "detail": detail,
            "severity": severity,
            "extra_delay_days": extra_delay if is_active else 0.0,
            "source": "realtime",
            "sources": sources[:3],
        }

    except Exception as e:
        return {
            "active": False,
            "type": "Error",
            "detail": f"Failed to fetch real-time data for {location}: {str(e)}",
            "severity": "low",
            "extra_delay_days": 0.0,
            "source": "realtime",
            "sources": [],
        }


def fetch_realtime_weather(location: str, country: str = "") -> dict:
    """
    Fetch real-time weather data for a shipping location using Tavily.

    Returns dict matching the mock_data weather format:
        {
            "risk": str,  # "low", "medium", "high"
            "detail": str,
            "temp_c": int,
            "condition": str,
            "source": "realtime",
        }
    """
    location_str = f"{location}, {country}" if country else location

    query = (
        f"at {location_str}   port India disruption shipping delay"
    )

    try:
        client = _get_client()
        response = client.search(
            query=query,
            search_depth="basic",
            max_results=3,
            include_answer=True,
        )

        answer = response.get("answer", "")
        results = response.get("results", [])

        all_content = answer + " " + " ".join(
            r.get("content", "") for r in results
        )

        if not all_content.strip():
            return {
                "risk": "low",
                "detail": f"No real-time weather data for {location}",
                "temp_c": 20,
                "condition": "Unknown",
                "source": "realtime",
            }

        # Classify weather risk
        risk = _classify_severity(all_content)

        # Try to extract temperature
        temp_match = re.search(r'(\d{1,2})\s*°?\s*[Cc]', all_content)
        temp_c = int(temp_match.group(1)) if temp_match else 20

        # Extract condition
        weather_conditions = ["typhoon", "hurricane", "storm", "monsoon", "rain",
                              "fog", "clear", "sunny", "cloudy", "wind", "snow",
                              "haze", "thunderstorm", "flood"]
        condition = "Normal"
        for wc in weather_conditions:
            if wc in all_content.lower():
                condition = wc.capitalize()
                break

        detail = answer.strip() if answer.strip() else (
            results[0].get("content", "")[:300] if results else
            f"No weather details for {location}"
        )
        detail = detail[:500]

        return {
            "risk": risk,
            "detail": detail,
            "temp_c": temp_c,
            "condition": condition,
            "source": "realtime",
        }

    except Exception as e:
        return {
            "risk": "low",
            "detail": f"Failed to fetch weather for {location}: {str(e)}",
            "temp_c": 20,
            "condition": "Error",
            "source": "realtime",
        }
