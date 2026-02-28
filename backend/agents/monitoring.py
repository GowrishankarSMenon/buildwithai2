"""
MonitoringAgent — Shipment Delay Detection & Weather/Disruption Risk
=====================================================================
AGENTIC REASONING: This agent acts as the "eyes" of the system.
It autonomously monitors each shipment segment, detects delays,
and incorporates real weather and disruption data for each location.

Supports two modes:
  - "simulation" (default): Uses hardcoded mock data
  - "realtime": Uses Tavily API for live disruption/weather data

The agent processes raw route data and produces a structured
monitoring report that feeds into the risk assessment pipeline.
"""

from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from services.groq_client import get_llm
from services.mock_data import get_weather, get_disruption, LOCATIONS
from services.tavily_client import fetch_realtime_disruptions
from services.weather_client import fetch_realtime_weather


# ── Structured Output Models ──────────────────────────────────────────

class SegmentReport(BaseModel):
    """Report for a single route segment."""
    from_location: str
    to_location: str
    eta_days: float
    delay_days: float
    weather_risk: str  # "low", "medium", "high"
    weather_detail: str
    disruption_type: str
    disruption_detail: str
    disruption_active: bool


class MonitoringResult(BaseModel):
    """Complete monitoring output for the full route."""
    product_id: str
    origin: str
    destination: str
    segments: list[SegmentReport]
    total_eta: float
    total_delay: float
    total_transit_days: float
    weather_summary: str
    disruption_summary: str
    llm_analysis: str  # LLM-generated natural language analysis


# ── Weather & Disruption Data Lookup ─────────────────────────────────

def _get_country_for_location(location: str) -> str:
    """Get country name for a location from the LOCATIONS list."""
    for loc in LOCATIONS:
        if loc["name"].lower() == location.lower():
            return loc["country"]
    return ""


def _get_location_risks(location: str, mode: str = "simulation") -> tuple[str, str, str, str, bool, float]:
    """
    Get weather risk and disruption data for a location.
    Mode: "simulation" uses mock data, "realtime" uses Tavily API.
    Returns: (weather_risk, weather_detail, disruption_type, disruption_detail, disruption_active, extra_delay_days)

    Tavily is only invoked for ports the user has selected in their route.
    """
    if mode == "realtime":
        country = _get_country_for_location(location)
        weather = fetch_realtime_weather(location, country)
        disruption = fetch_realtime_disruptions(location, country)
    else:
        weather = get_weather(location)
        disruption = get_disruption(location)

    return (
        weather["risk"],
        weather["detail"],
        disruption["type"],
        disruption["detail"],
        disruption["active"],
        disruption.get("extra_delay_days", 0.0),
    )


# ── Agent Entry Point ────────────────────────────────────────────────

def run_monitoring_agent(
    product_id: str,
    origin: str,
    destination: str,
    stops: list[dict],
    mode: str = "simulation",
) -> MonitoringResult:
    """
    Run the Monitoring Agent on shipment route data.

    Args:
        product_id: The product being shipped (e.g. "P1")
        origin: Starting location
        destination: Final destination
        stops: List of dicts with keys: stop_name, eta_days, delay_days
        mode: "simulation" for mock data, "realtime" for Tavily live data

    Returns:
        MonitoringResult with segment-level and aggregated data
    """

    # ── Step 1: Build segment reports with weather & disruption data ──
    segments: list[SegmentReport] = []
    prev_location = origin

    for stop in stops:
        weather_risk, weather_detail, disrupt_type, disrupt_detail, disrupt_active, extra_delay = _get_location_risks(stop["stop_name"], mode)
        segments.append(SegmentReport(
            from_location=prev_location,
            to_location=stop["stop_name"],
            eta_days=stop["eta_days"],
            delay_days=stop["delay_days"] + extra_delay,
            weather_risk=weather_risk,
            weather_detail=weather_detail,
            disruption_type=disrupt_type,
            disruption_detail=disrupt_detail,
            disruption_active=disrupt_active,
        ))
        prev_location = stop["stop_name"]

    # Final segment to destination
    if prev_location != destination:
        weather_risk, weather_detail, disrupt_type, disrupt_detail, disrupt_active, extra_delay = _get_location_risks(destination, mode)
        segments.append(SegmentReport(
            from_location=prev_location,
            to_location=destination,
            eta_days=stops[-1]["eta_days"] if stops else 1,
            delay_days=0 + extra_delay,
            weather_risk=weather_risk,
            weather_detail=weather_detail,
            disruption_type=disrupt_type,
            disruption_detail=disrupt_detail,
            disruption_active=disrupt_active,
        ))

    # ── Step 2: Aggregate totals ──
    total_eta = sum(s.eta_days for s in segments)
    total_delay = sum(s.delay_days for s in segments)
    total_transit = total_eta + total_delay

    # ── Step 3: Use LLM to generate natural language analysis ──
    segment_text = "\n".join(
        f"  - {s.from_location} → {s.to_location}: ETA {s.eta_days}d, Delay {s.delay_days}d, Weather: {s.weather_risk} ({s.weather_detail}), Disruption: {s.disruption_type} ({s.disruption_detail})"
        for s in segments
    )

    disrupted_segments = [s for s in segments if s.disruption_active]
    disruption_text = ""
    if disrupted_segments:
        disruption_text = "\n\nActive Disruptions:\n" + "\n".join(
            f"  - {s.to_location}: {s.disruption_type} — {s.disruption_detail}"
            for s in disrupted_segments
        )

    prompt = f"""You are a supply chain monitoring AI agent. Analyze this shipment route and provide a concise monitoring summary.

Product: {product_id}
Route: {origin} → {destination}
Segments:
{segment_text}

Total ETA: {total_eta} days
Total Delays: {total_delay} days
Total Transit Time: {total_transit} days
{disruption_text}

Provide a brief 2-3 sentence analysis covering:
1. Overall shipment status and key delay points
2. Weather risk assessment across the route
3. Active disruptions (port strikes, congestion, customs delays) and their impact
4. Whether the shipment is on track or at risk

Be direct and actionable. This feeds into the risk assessment pipeline."""

    try:
        llm = get_llm()
        response = llm.invoke([HumanMessage(content=prompt)])
        llm_analysis = response.content
        print(llm_analysis)
    except Exception as e:
        llm_analysis = f"[LLM unavailable — fallback] Shipment has {total_delay}d total delay across {len(segments)} segments. Manual review recommended. Error: {str(e)}"

    # ── Step 4: Weather summary ──
    high_risk_segments = [s for s in segments if s.weather_risk == "high"]
    if high_risk_segments:
        weather_summary = f"⚠️ HIGH weather risk on {len(high_risk_segments)} segment(s)"
    elif any(s.weather_risk == "medium" for s in segments):
        weather_summary = "⚡ Moderate weather risk on route"
    else:
        weather_summary = "✅ Clear weather across all segments"

    # ── Step 5: Disruption summary ──
    active_disruptions = [s for s in segments if s.disruption_active]
    if active_disruptions:
        disruption_summary = f"🚨 {len(active_disruptions)} active disruption(s): " + ", ".join(
            f"{s.to_location} ({s.disruption_type})" for s in active_disruptions
        )
    else:
        disruption_summary = "✅ No active disruptions on route"

    return MonitoringResult(
        product_id=product_id,
        origin=origin,
        destination=destination,
        segments=segments,
        total_eta=total_eta,
        total_delay=total_delay,
        total_transit_days=total_transit,
        weather_summary=weather_summary,
        disruption_summary=disruption_summary,
        llm_analysis=llm_analysis,
    )
