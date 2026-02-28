"""
Agentic Disruption Shield — FastAPI Backend
=============================================
AI Supply Chain Disruption Manager for SMEs

Endpoints:
  GET  /status       — Health check
  POST /run-agents   — Run full agent pipeline with route data
  POST /execute-plan — Mock execution of chosen recovery plan

This backend demonstrates autonomous agentic AI reasoning:
  monitoring → risk assessment → scenario planning → decision making
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agents.pipeline import run_agent_pipeline
from services.mock_data import LOCATIONS, LOCATION_NAMES, get_location_info

# ── FastAPI App ───────────────────────────────────────────────────────

app = FastAPI(
    title="Agentic Disruption Shield",
    description="AI Supply Chain Disruption Manager for SMEs",
    version="1.0.0",
)

# CORS — allow Next.js frontend on port 3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ─────────────────────────────────────────

class RouteStop(BaseModel):
    """An intermediate stop with ETA and delay."""
    stop_name: str
    eta_days: float
    delay_days: float


class RunAgentsRequest(BaseModel):
    """Input payload for the agent pipeline."""
    product_id: str
    origin: str
    destination: str
    stops: list[RouteStop]
    mode: str = "simulation"  # "simulation" or "realtime"


class ExecutePlanRequest(BaseModel):
    """Input payload for executing a chosen plan."""
    product_id: str
    chosen_option: str
    details: str = ""


# ── Endpoints ─────────────────────────────────────────────────────────

@app.get("/status")
def status():
    """Health check endpoint."""
    return {"status": "running", "service": "Agentic Disruption Shield"}


@app.get("/locations")
def get_locations(mode: str = "simulation"):
    """
    Return all available shipping locations with weather & disruption data.
    In realtime mode, we only return basic location info here — Tavily is called
    per-port during the agent pipeline (run-agents) to avoid unnecessary API calls.
    """
    if mode == "realtime":
        # Return locations with basic metadata only; Tavily is invoked
        # during the agent pipeline for the ports the user actually selects.
        return {
            "locations": [
                {
                    **loc,
                    "location": loc["name"],
                    "weather": {"risk": "unknown", "detail": "Run agent pipeline for live data", "condition": "Pending"},
                    "disruption": {"active": False, "type": "Pending", "detail": "Run agent pipeline for live data", "severity": "low", "extra_delay_days": 0.0},
                }
                for loc in LOCATIONS
            ],
            "mode": "realtime",
        }
    else:
        return {
            "locations": [
                {**loc, **get_location_info(loc["name"])}
                for loc in LOCATIONS
            ],
            "mode": "simulation",
        }


@app.post("/run-agents")
def run_agents(request: RunAgentsRequest):
    """
    Run the full 4-agent pipeline with shipment route data.

    Flow: monitor → risk → plan → decision
    Returns combined output from all agents.
    """
    try:
        result = run_agent_pipeline(
            product_id=request.product_id,
            origin=request.origin,
            destination=request.destination,
            stops=[s.model_dump() for s in request.stops],
            mode=request.mode,
        )
        return {"success": True, "data": result, "mode": request.mode}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/execute-plan")
def execute_plan(request: ExecutePlanRequest):
    """
    Mock execution of the chosen recovery plan.
    In production, this would trigger actual logistics APIs.
    Returns simulated confirmation.
    """
    # Mock execution responses based on the chosen option
    mock_responses = {
        "Wait for Shipment": {
            "action": "monitoring_continued",
            "message": f"Continued monitoring for product {request.product_id}. Alert thresholds updated.",
            "booking_ref": None,
            "supplier_contacted": False,
        },
        "Partial Air Shipment": {
            "action": "air_freight_booked",
            "message": f"✈️ Air freight booking confirmed for product {request.product_id}. Estimated arrival: 2 days.",
            "booking_ref": "AIR-2025-" + request.product_id,
            "supplier_contacted": False,
        },
        "Alternate Supplier": {
            "action": "supplier_engaged",
            "message": f"📦 Alternate supplier contacted for product {request.product_id}. PO issued, delivery in 3 days.",
            "booking_ref": "ALT-2025-" + request.product_id,
            "supplier_contacted": True,
        },
    }

    response = mock_responses.get(request.chosen_option, {
        "action": "unknown",
        "message": f"Plan '{request.chosen_option}' acknowledged. Manual follow-up required.",
        "booking_ref": None,
        "supplier_contacted": False,
    })

    return {
        "success": True,
        "execution": {
            "product_id": request.product_id,
            "chosen_option": request.chosen_option,
            **response,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
