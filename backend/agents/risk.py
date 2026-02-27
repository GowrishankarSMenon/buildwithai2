"""
RiskAgent — Stockout & Revenue Loss Assessment
================================================
AGENTIC REASONING: This agent acts as the "brain" for risk evaluation.
It takes monitoring data + inventory data and autonomously determines
whether a disruption will cause stockouts, and estimates financial impact.

Core formula:
    stockout_days = stock / daily_demand
    shipment_arrival_days = total_eta + total_delay
    if shipment_arrival_days > stockout_days → risk = True
    lost_units = (shipment_arrival_days - stockout_days) * daily_demand
    revenue_loss = lost_units * unit_price
"""

from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from services.groq_client import get_llm
from services.data_loader import get_inventory, get_orders
from agents.monitoring import MonitoringResult


# ── Structured Output Models ──────────────────────────────────────────

class RiskResult(BaseModel):
    """Complete risk assessment output."""
    product_id: str
    stock: float
    daily_demand: float
    stockout_days: float
    shipment_arrival_days: float
    disruption_risk: bool
    lost_units: float
    revenue_loss: float
    unit_price: float
    pending_orders: list[dict]
    risk_level: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    llm_analysis: str


# ── Constants ─────────────────────────────────────────────────────────

MOCK_UNIT_PRICE = 100  # Mock price per unit for revenue loss calculation


# ── Agent Entry Point ────────────────────────────────────────────────

def run_risk_agent(monitoring: MonitoringResult) -> RiskResult:
    """
    Run the Risk Agent using monitoring output + inventory data.

    Autonomously:
    1. Looks up inventory for the product
    2. Computes stockout timeline
    3. Compares against shipment arrival
    4. Calculates financial exposure
    5. Uses LLM to generate risk narrative

    Args:
        monitoring: Output from the MonitoringAgent

    Returns:
        RiskResult with full risk assessment
    """

    product_id = monitoring.product_id

    # ── Step 1: Fetch inventory data ──
    inventory = get_inventory(product_id)
    if inventory is None:
        # Fallback for unknown products
        inventory = {"product_id": product_id, "stock": 0, "daily_demand": 1}

    stock = float(inventory["stock"])
    daily_demand = float(inventory["daily_demand"])

    # ── Step 2: Compute stockout days ──
    stockout_days = stock / daily_demand if daily_demand > 0 else 999

    # ── Step 3: Shipment arrival from monitoring ──
    shipment_arrival_days = monitoring.total_transit_days

    # ── Step 4: Determine risk and financial impact ──
    disruption_risk = shipment_arrival_days > stockout_days

    if disruption_risk:
        lost_units = (shipment_arrival_days - stockout_days) * daily_demand
        revenue_loss = lost_units * MOCK_UNIT_PRICE
    else:
        lost_units = 0
        revenue_loss = 0

    # ── Step 5: Risk level classification ──
    if not disruption_risk:
        risk_level = "LOW"
    elif revenue_loss > 50000:
        risk_level = "CRITICAL"
    elif revenue_loss > 20000:
        risk_level = "HIGH"
    else:
        risk_level = "MEDIUM"

    # ── Step 6: Fetch pending orders for context ──
    pending_orders = get_orders(product_id)

    # ── Step 7: LLM risk analysis ──
    prompt = f"""You are a supply chain risk assessment AI agent. Evaluate this disruption risk and provide a concise executive summary.

Product: {product_id}
Current Stock: {stock} units
Daily Demand: {daily_demand} units/day
Days of Stock Remaining: {stockout_days:.1f} days
Shipment Arrival In: {shipment_arrival_days:.1f} days
Disruption Risk: {"YES" if disruption_risk else "NO"}
Potential Lost Units: {lost_units:.0f}
Estimated Revenue Loss: ${revenue_loss:,.0f}
Risk Level: {risk_level}
Pending Orders: {len(pending_orders)}

Monitoring Summary: {monitoring.llm_analysis}
Weather: {monitoring.weather_summary}
Disruptions: {monitoring.disruption_summary}

Provide a 2-3 sentence risk assessment covering:
1. Whether current stock will last until shipment arrives
2. Financial impact severity and urgency level
3. Immediate recommendation (hold, escalate, or act now)

Be direct and quantitative. This feeds into the scenario planning pipeline."""

    try:
        llm = get_llm()
        response = llm.invoke([HumanMessage(content=prompt)])
        llm_analysis = response.content
    except Exception as e:
        llm_analysis = f"[LLM unavailable — fallback] Risk level: {risk_level}. Revenue exposure: ${revenue_loss:,.0f}. {'Immediate action required.' if disruption_risk else 'Shipment on track.'} Error: {str(e)}"

    return RiskResult(
        product_id=product_id,
        stock=stock,
        daily_demand=daily_demand,
        stockout_days=round(stockout_days, 2),
        shipment_arrival_days=round(shipment_arrival_days, 2),
        disruption_risk=disruption_risk,
        lost_units=round(lost_units, 2),
        revenue_loss=round(revenue_loss, 2),
        unit_price=MOCK_UNIT_PRICE,
        pending_orders=pending_orders,
        risk_level=risk_level,
        llm_analysis=llm_analysis,
    )
