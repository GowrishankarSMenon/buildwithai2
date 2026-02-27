"""
Agent Pipeline — Orchestrates the 4-agent chain
=================================================
AGENTIC REASONING: This is the orchestration layer that chains
all 4 agents in sequence: monitor → risk → plan → decision.

Each agent's output feeds into the next, creating an autonomous
reasoning pipeline that goes from raw shipment data to a final
actionable recommendation.
"""

import time
from agents.monitoring import run_monitoring_agent, MonitoringResult
from agents.risk import run_risk_agent, RiskResult
from agents.planner import run_planner_agent, PlannerResult
from agents.decision import run_decision_agent, DecisionResult

# ── ANSI Colors for console output ────────────────────────────────────
CYAN    = "\033[96m"
GREEN   = "\033[92m"
YELLOW  = "\033[93m"
RED     = "\033[91m"
MAGENTA = "\033[95m"
BOLD    = "\033[1m"
DIM     = "\033[2m"
RESET   = "\033[0m"
LINE    = f"{DIM}{'─' * 60}{RESET}"


def _log_header(emoji: str, title: str, color: str):
    print(f"\n{LINE}")
    print(f"{color}{BOLD}{emoji}  {title}{RESET}")
    print(LINE)


def _log_input(label: str, value):
    print(f"  {DIM}├─ INPUT  {RESET}{CYAN}{label}:{RESET} {value}")


def _log_output(label: str, value):
    print(f"  {DIM}├─ OUTPUT {RESET}{GREEN}{label}:{RESET} {value}")


def _log_done(agent: str, elapsed: float):
    print(f"  {DIM}└─ ✅ {agent} done in {elapsed:.2f}s{RESET}")


def run_agent_pipeline(
    product_id: str,
    origin: str,
    destination: str,
    stops: list[dict],
) -> dict:
    """
    Run the full agent pipeline: monitor → risk → plan → decision.
    """

    print(f"\n{'═' * 60}")
    print(f"{BOLD}{MAGENTA}🛡️  AGENTIC DISRUPTION SHIELD — PIPELINE START{RESET}")
    print(f"{'═' * 60}")

    pipeline_start = time.time()

    # ══════════════════════════════════════════════════════════════
    # Stage 1: Monitoring Agent
    # ══════════════════════════════════════════════════════════════
    _log_header("📡", "STAGE 1: MonitoringAgent", CYAN)
    _log_input("product_id", product_id)
    _log_input("route", f"{origin} → {' → '.join(s['stop_name'] for s in stops)} → {destination}")
    for i, s in enumerate(stops):
        _log_input(f"stop[{i}]", f"{s['stop_name']} (ETA: {s['eta_days']}d, Delay: {s['delay_days']}d)")

    t = time.time()
    monitoring: MonitoringResult = run_monitoring_agent(
        product_id=product_id,
        origin=origin,
        destination=destination,
        stops=stops,
    )

    _log_output("total_eta", f"{monitoring.total_eta} days")
    _log_output("total_delay", f"{monitoring.total_delay} days")
    _log_output("total_transit", f"{monitoring.total_transit_days} days")
    _log_output("weather", monitoring.weather_summary)
    for seg in monitoring.segments:
        delay_str = f" ⚠️ +{seg.delay_days}d delay" if seg.delay_days > 0 else ""
        _log_output("segment", f"{seg.from_location} → {seg.to_location} | ETA {seg.eta_days}d{delay_str} | Weather: {seg.weather_risk}")
    _log_output("llm_analysis", monitoring.llm_analysis[:150] + "..." if len(monitoring.llm_analysis) > 150 else monitoring.llm_analysis)
    _log_done("MonitoringAgent", time.time() - t)

    # ══════════════════════════════════════════════════════════════
    # Stage 2: Risk Agent
    # ══════════════════════════════════════════════════════════════
    _log_header("⚠️", "STAGE 2: RiskAgent", YELLOW)
    _log_input("product_id", monitoring.product_id)
    _log_input("total_transit_days", monitoring.total_transit_days)

    t = time.time()
    risk: RiskResult = run_risk_agent(monitoring)

    _log_output("stock", f"{risk.stock} units")
    _log_output("daily_demand", f"{risk.daily_demand} units/day")
    _log_output("stockout_days", f"{risk.stockout_days} days")
    _log_output("shipment_arrival", f"{risk.shipment_arrival_days} days")
    _log_output("disruption_risk", f"{'🔴 YES' if risk.disruption_risk else '🟢 NO'}")
    _log_output("lost_units", f"{risk.lost_units}")
    _log_output("revenue_loss", f"${risk.revenue_loss:,.0f}")
    risk_color = RED if risk.risk_level in ("CRITICAL", "HIGH") else YELLOW if risk.risk_level == "MEDIUM" else GREEN
    _log_output("risk_level", f"{risk_color}{BOLD}{risk.risk_level}{RESET}")
    _log_output("llm_analysis", risk.llm_analysis[:150] + "..." if len(risk.llm_analysis) > 150 else risk.llm_analysis)
    _log_done("RiskAgent", time.time() - t)

    # ══════════════════════════════════════════════════════════════
    # Stage 3: Planner Agent
    # ══════════════════════════════════════════════════════════════
    _log_header("📋", "STAGE 3: PlannerAgent", MAGENTA)
    _log_input("risk_level", risk.risk_level)
    _log_input("revenue_loss", f"${risk.revenue_loss:,.0f}")

    t = time.time()
    planner: PlannerResult = run_planner_agent(risk)

    for opt in planner.options:
        _log_output("option", f"{opt.option_name} | Cost: ${opt.cost:,.0f} | Loss: ${opt.projected_loss:,.0f} | Total: ${opt.total_impact:,.0f} | {opt.timeline_days}d")
    _log_output("llm_analysis", planner.llm_analysis[:150] + "..." if len(planner.llm_analysis) > 150 else planner.llm_analysis)
    _log_done("PlannerAgent", time.time() - t)

    # ══════════════════════════════════════════════════════════════
    # Stage 4: Decision Agent
    # ══════════════════════════════════════════════════════════════
    _log_header("🎯", "STAGE 4: DecisionAgent", GREEN)
    _log_input("options_count", len(planner.options))
    for sim in planner.options:
        _log_input("scenario", f"{sim.option_name} → total_impact=${sim.total_impact:,.0f}")

    t = time.time()
    decision: DecisionResult = run_decision_agent(risk, planner)

    for sim in decision.simulations:
        marker = "✅" if sim.chosen else "  "
        _log_output("simulation", f"{marker} {sim.option_name}: Cost ${sim.cost:,.0f} + Loss ${sim.projected_loss:,.0f} = ${sim.total_impact:,.0f}")
    _log_output("CHOSEN", f"{GREEN}{BOLD}{decision.chosen_option.option_name}{RESET} (${decision.chosen_option.total_impact:,.0f})")
    _log_output("reasoning", decision.reasoning[:200] + "..." if len(decision.reasoning) > 200 else decision.reasoning)
    _log_done("DecisionAgent", time.time() - t)

    # ══════════════════════════════════════════════════════════════
    # Pipeline Complete
    # ══════════════════════════════════════════════════════════════
    total_time = time.time() - pipeline_start
    print(f"\n{'═' * 60}")
    print(f"{BOLD}{GREEN}✅ PIPELINE COMPLETE in {total_time:.2f}s{RESET}")
    print(f"{BOLD}   Recommendation: {decision.chosen_option.option_name}{RESET}")
    print(f"{'═' * 60}\n")

    # ── Combine all outputs into a single response ──
    return {
        "monitoring": monitoring.model_dump(),
        "risk": risk.model_dump(),
        "planner": planner.model_dump(),
        "decision": decision.model_dump(),
    }
