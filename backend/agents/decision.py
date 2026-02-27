"""
DecisionAgent — Optimal Scenario Selection & Reasoning
========================================================
AGENTIC REASONING: This is the "decision-maker." It simulates all
scenarios from the PlannerAgent, selects the option with minimum
(cost + loss), and uses the LLM to generate human-readable reasoning
explaining WHY this option was chosen — critical for hackathon judges.

Decision rule: Select option with minimum total_impact (cost + projected_loss)
"""

from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from services.groq_client import get_llm
from agents.risk import RiskResult
from agents.planner import PlannerResult, RecoveryOption


# ── Structured Output Models ──────────────────────────────────────────

class SimulationEntry(BaseModel):
    """Simulation result for one scenario."""
    option_name: str
    cost: float
    projected_loss: float
    total_impact: float
    chosen: bool


class DecisionResult(BaseModel):
    """Final decision output with reasoning."""
    product_id: str
    simulations: list[SimulationEntry]
    chosen_option: RecoveryOption
    reasoning: str  # LLM-generated explanation


# ── Agent Entry Point ────────────────────────────────────────────────

def run_decision_agent(
    risk: RiskResult,
    planner: PlannerResult,
) -> DecisionResult:
    """
    Run the Decision Agent to select the optimal recovery plan.

    Autonomously:
    1. Simulates all recovery scenarios side-by-side
    2. Applies decision rule: minimize (cost + loss)
    3. Uses LLM to generate detailed reasoning for the choice

    Args:
        risk: Output from the RiskAgent
        planner: Output from the PlannerAgent

    Returns:
        DecisionResult with chosen plan and reasoning
    """

    product_id = planner.product_id
    options = planner.options

    # ── Step 1: Simulate all scenarios ──
    simulations: list[SimulationEntry] = []
    best_option: RecoveryOption = options[0]
    best_impact = options[0].total_impact

    for option in options:
        is_best = option.total_impact <= best_impact
        if option.total_impact < best_impact:
            best_impact = option.total_impact
            best_option = option

        simulations.append(SimulationEntry(
            option_name=option.option_name,
            cost=option.cost,
            projected_loss=option.projected_loss,
            total_impact=option.total_impact,
            chosen=False,  # Will be updated after loop
        ))

    # Re-select best after full scan
    best_option = min(options, key=lambda o: o.total_impact)
    for sim in simulations:
        sim.chosen = (sim.option_name == best_option.option_name)

    # ── Step 2: LLM reasoning ──
    sim_table = "\n".join(
        f"  {'→' if s.chosen else ' '} {s.option_name}: Cost=${s.cost:,.0f} + Loss=${s.projected_loss:,.0f} = Total=${s.total_impact:,.0f}"
        for s in simulations
    )

    prompt = f"""You are a supply chain decision-making AI agent. Explain why you chose this recovery plan.

Product: {product_id}
Risk Level: {risk.risk_level}
Revenue at Risk: ${risk.revenue_loss:,.0f}
Days Until Stockout: {risk.stockout_days:.1f}
Shipment Arrival: {risk.shipment_arrival_days:.1f} days

Scenario Simulation Results:
{sim_table}

Selected Option: {best_option.option_name}
- Cost: ${best_option.cost:,.0f}
- Projected Loss: ${best_option.projected_loss:,.0f}
- Total Impact: ${best_option.total_impact:,.0f}
- Timeline: {best_option.timeline_days} days

Provide a clear 3-4 sentence justification covering:
1. Why this option was selected over the alternatives
2. The cost-benefit tradeoff that makes this optimal
3. Expected outcome and timeline for resolution
4. Any caveats or conditions for this recommendation

Write as if presenting to a VP of Supply Chain. Be confident and data-driven."""

    try:
        llm = get_llm()
        response = llm.invoke([HumanMessage(content=prompt)])
        reasoning = response.content
    except Exception as e:
        reasoning = (
            f"[LLM unavailable — fallback] Selected '{best_option.option_name}' "
            f"with minimum total impact of ${best_option.total_impact:,.0f}. "
            f"Cost: ${best_option.cost:,.0f}, Projected Loss: ${best_option.projected_loss:,.0f}. "
            f"Error: {str(e)}"
        )

    return DecisionResult(
        product_id=product_id,
        simulations=simulations,
        chosen_option=best_option,
        reasoning=reasoning,
    )
