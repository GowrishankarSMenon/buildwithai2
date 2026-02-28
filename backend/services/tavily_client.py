"""
tavily_client.py — Tavily Real-Time Disruption Data Service
=============================================================
Fetches real-time supply chain disruption data for locations using
the Tavily Search API. Searches for port strikes, wars, political
issues, and other events affecting shipping.

Note: Weather data is handled separately by weather_client.py
using the OpenWeatherMap API.
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
    location_str = f"{location} port India"

    query = (
        f"{location_str} port India disruption OR strike OR political crisis OR war "
        f"OR shipping delay OR supply chain issue OR congestion "
        f"latest news 2026"
        f"india weather port conditions wind rain storm forecast 2026"
    )

    try:
        client = _get_client()
        response = client.search(
            query=query,
            search_depth="advanced",
            max_results=5,
            include_answer=True,
            include_domains = [
    # Maritime & logistics (India)
    "maritimegateway.com",
    "indiashippingnews.com",
    "cargotalk.in",
    "logisticsinsider.in",
    "stattimes.com",
    "porttechnology.org",
    "seatrade-maritime.com",

    # Aviation / transport
    "aai.aero",
    "dgca.gov.in",

    # Business / economy
    "economictimes.indiatimes.com",
    "livemint.com",
    "business-standard.com",
    "financialexpress.com",
    "moneycontrol.com",

    # General news
    "thehindu.com",
    "indianexpress.com",
    "hindustantimes.com",
    "timesofindia.indiatimes.com",
    "ndtv.com",
    "reuters.com",

    # Weather / official
    "imd.gov.in",
    "accuweather.com",   # ✅ Added
],
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



