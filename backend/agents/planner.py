"""
PlannerAgent — Recovery Scenario Generator
============================================
AGENTIC REASONING: This agent acts as the "strategist." Given a risk
assessment, it autonomously generates multiple recovery scenarios,
each with estimated costs and projected losses, so the DecisionAgent
can pick the optimal path.

Three core strategies:
1. Wait for shipment (zero cost, but revenue loss from stockout)
2. Partial air shipment (high logistics cost, eliminates stockout)
3. Alternate supplier (moderate cost, 1-day residual loss)
"""

from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from services.groq_client import get_llm
from agents.risk import RiskResult


# ── Structured Output Models ──────────────────────────────────────────

class RecoveryOption(BaseModel):
    """A single recovery scenario."""
    option_name: str
    description: str
    cost: float
    projected_loss: float
    total_impact: float  # cost + projected_loss
    timeline_days: float


class PlannerResult(BaseModel):
    """Output from the PlannerAgent."""
    product_id: str
    options: list[RecoveryOption]
    llm_analysis: str


# ── Agent Entry Point ────────────────────────────────────────────────

def run_planner_agent(risk: RiskResult) -> PlannerResult:
    """
    Run the Planner Agent to generate recovery scenarios.

    Autonomously:
    1. Evaluates risk severity
    2. Generates 3 recovery options with realistic cost models
    3. Uses LLM to provide strategic context for each option

    Args:
        risk: Output from the RiskAgent

    Returns:
        PlannerResult with ranked recovery options
    """

    product_id = risk.product_id
    revenue_loss = risk.revenue_loss
    daily_demand = risk.daily_demand
    unit_price = risk.unit_price
    arrival_days = risk.shipment_arrival_days

    # ── Option 1: Wait for shipment (do nothing) ──
    wait_option = RecoveryOption(
        option_name="Wait for Shipment",
        description="Continue with current shipment. Accept potential stockout and revenue loss.",
        cost=0,
        projected_loss=revenue_loss,
        total_impact=revenue_loss,
        timeline_days=arrival_days,
    )

    # ── Option 2: Partial air shipment ──
    # Air shipping ~200 units at premium rate
    air_units = min(200, daily_demand * arrival_days)
    air_cost = air_units * 250  # $250/unit air freight premium
    air_option = RecoveryOption(
        option_name="Partial Air Shipment",
        description=f"Air-ship {air_units:.0f} units to cover immediate demand. Eliminates stockout.",
        cost=air_cost,
        projected_loss=0,
        total_impact=air_cost,
        timeline_days=2,  # Air freight typically 1-2 days
    )

    # ── Option 3: Alternate supplier ──
    # Local supplier with faster delivery but higher unit cost
    alt_cost = 30000  # Fixed engagement cost
    one_day_loss = daily_demand * unit_price  # 1-day residual loss during switch
    alt_option = RecoveryOption(
        option_name="Alternate Supplier",
        description="Engage backup supplier for emergency stock. 1-day transition gap expected.",
        cost=alt_cost,
        projected_loss=one_day_loss,
        total_impact=alt_cost + one_day_loss,
        timeline_days=3,
    )

    options = [wait_option, air_option, alt_option]

    # ── LLM strategic analysis ──
    options_text = "\n".join(
        f"  {i+1}. {o.option_name}: Cost=${o.cost:,.0f}, Loss=${o.projected_loss:,.0f}, Total=${o.total_impact:,.0f}, Timeline={o.timeline_days}d"
        for i, o in enumerate(options)
    )

    prompt = f"""You are a supply chain planning AI agent. Evaluate these recovery scenarios and provide strategic context.

Product: {product_id}
Current Risk Level: {risk.risk_level}
Revenue at Risk: ${revenue_loss:,.0f}
Stock Remaining: {risk.stock} units ({risk.stockout_days:.1f} days)
Shipment Arrives In: {arrival_days:.1f} days

Recovery Options:
{options_text}

Provide a brief 2-3 sentence strategic overview covering:
1. Which option offers the best risk-cost tradeoff
2. Key factors that should influence the final decision
3. Any time-sensitivity considerations

Be pragmatic and quantitative. This feeds into the final decision engine."""

    try:
        llm = get_llm()
        response = llm.invoke([HumanMessage(content=prompt)])
        llm_analysis = response.content
    except Exception as e:
        llm_analysis = f"[LLM unavailable — fallback] Generated {len(options)} recovery options. Minimum total impact: ${min(o.total_impact for o in options):,.0f}. Error: {str(e)}"

    return PlannerResult(
        product_id=product_id,
        options=options,
        llm_analysis=llm_analysis,
    )
