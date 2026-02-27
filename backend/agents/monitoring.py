"""
MonitoringAgent — Shipment Delay Detection & Weather Risk
=========================================================
AGENTIC REASONING: This agent acts as the "eyes" of the system.
It autonomously monitors each shipment segment, detects delays,
and adds environmental risk factors (mock weather data).

The agent processes raw route data and produces a structured
monitoring report that feeds into the risk assessment pipeline.
"""

import random
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from services.groq_client import get_llm


# ── Structured Output Models ──────────────────────────────────────────

class SegmentReport(BaseModel):
    """Report for a single route segment."""
    from_location: str
    to_location: str
    eta_days: float
    delay_days: float
    weather_risk: str  # "low", "medium", "high"
    weather_detail: str


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
    llm_analysis: str  # LLM-generated natural language analysis


# ── Mock Weather Risk Generator ──────────────────────────────────────

def _mock_weather_risk(location: str) -> tuple[str, str]:
    """Generate mock weather risk for a location."""
    risks = [
        ("low", f"Clear conditions expected near {location}"),
        ("medium", f"Moderate rain forecasted near {location}, possible minor delays"),
        ("high", f"Severe storm warning near {location}, significant delays likely"),
    ]
    return random.choice(risks)


# ── Agent Entry Point ────────────────────────────────────────────────

def run_monitoring_agent(
    product_id: str,
    origin: str,
    destination: str,
    stops: list[dict],
) -> MonitoringResult:
    """
    Run the Monitoring Agent on shipment route data.

    Args:
        product_id: The product being shipped (e.g. "P1")
        origin: Starting location
        destination: Final destination
        stops: List of dicts with keys: stop_name, eta_days, delay_days

    Returns:
        MonitoringResult with segment-level and aggregated data
    """

    # ── Step 1: Build segment reports with weather risk ──
    segments: list[SegmentReport] = []
    prev_location = origin

    for stop in stops:
        weather_risk, weather_detail = _mock_weather_risk(stop["stop_name"])
        segments.append(SegmentReport(
            from_location=prev_location,
            to_location=stop["stop_name"],
            eta_days=stop["eta_days"],
            delay_days=stop["delay_days"],
            weather_risk=weather_risk,
            weather_detail=weather_detail,
        ))
        prev_location = stop["stop_name"]

    # Final segment to destination
    if prev_location != destination:
        weather_risk, weather_detail = _mock_weather_risk(destination)
        segments.append(SegmentReport(
            from_location=prev_location,
            to_location=destination,
            eta_days=stops[-1]["eta_days"] if stops else 1,
            delay_days=0,
            weather_risk=weather_risk,
            weather_detail=weather_detail,
        ))

    # ── Step 2: Aggregate totals ──
    total_eta = sum(s.eta_days for s in segments)
    total_delay = sum(s.delay_days for s in segments)
    total_transit = total_eta + total_delay

    # ── Step 3: Use LLM to generate natural language analysis ──
    segment_text = "\n".join(
        f"  - {s.from_location} → {s.to_location}: ETA {s.eta_days}d, Delay {s.delay_days}d, Weather: {s.weather_risk} ({s.weather_detail})"
        for s in segments
    )

    prompt = f"""You are a supply chain monitoring AI agent. Analyze this shipment route and provide a concise monitoring summary.

Product: {product_id}
Route: {origin} → {destination}
Segments:
{segment_text}

Total ETA: {total_eta} days
Total Delays: {total_delay} days
Total Transit Time: {total_transit} days

Provide a brief 2-3 sentence analysis covering:
1. Overall shipment status and key delay points
2. Weather risk assessment across the route
3. Whether the shipment is on track or at risk

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

    return MonitoringResult(
        product_id=product_id,
        origin=origin,
        destination=destination,
        segments=segments,
        total_eta=total_eta,
        total_delay=total_delay,
        total_transit_days=total_transit,
        weather_summary=weather_summary,
        llm_analysis=llm_analysis,
    )
