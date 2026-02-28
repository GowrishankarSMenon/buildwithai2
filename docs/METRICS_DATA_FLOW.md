# Metrics Data Flow — Agentic Disruption Shield

> How every numerical value on the UI is calculated, which file it comes from, and how data flows between agents.

---

## System Architecture

```
[inventory.csv] ── stock, daily_demand ──► [RiskAgent] ── revenue_loss, daily_demand, unit_price ──► [PlannerAgent]
                                               ▲                                                          │
[mock_data.py] ── extra_delay_days ──► [MonitoringAgent] ── total_transit_days ──┘                   options[]
                                               ▲                                                          │
[Frontend] ── eta_days(2.0), delay_days(0/3) ──┘                                                          ▼
                                                                                                   [DecisionAgent]
[risk.py] ── MOCK_UNIT_PRICE($100) ──► [RiskAgent]                                                        │
                                                                                                    chosen_option
                                                                                                          │
                                                                                                          ▼
                                                                                                      [UI Panel]
                                                                                              stockout_days, arrival,
                                                                                              revenue_loss, cost, loss,
                                                                                              timeline_days, risk_level
```

---

## Agent Pipeline (Sequential)

```
MonitoringAgent → RiskAgent → PlannerAgent → DecisionAgent
```

| Agent | Input | Output | Role |
|-------|-------|--------|------|
| **MonitoringAgent** | `product_id`, `origin`, `destination`, `stops[]`, `mode` | `MonitoringResult` | The "eyes" — fetches weather & disruption data per segment |
| **RiskAgent** | `MonitoringResult` + CSV data | `RiskResult` | The "brain" — computes stockout timeline & financial exposure |
| **PlannerAgent** | `RiskResult` | `PlannerResult` | The "strategist" — generates 3 recovery scenarios |
| **DecisionAgent** | `RiskResult` + `PlannerResult` | `DecisionResult` | The "decision-maker" — picks optimal option |

---

## 1. Risk Assessment Card (UI)

### Displayed Metrics

| UI Field | Display Format | Calculated In | Formula |
|----------|---------------|---------------|---------|
| **Stockout** | `{stockout_days}d` | `backend/agents/risk.py` | `stock / daily_demand` |
| **Arrival** | `{shipment_arrival_days}d` | `backend/agents/risk.py` | `= monitoring.total_transit_days` |
| **Loss** | `${revenue_loss}` | `backend/agents/risk.py` | `lost_units × MOCK_UNIT_PRICE ($100)` |
| **Risk Level** | Badge (LOW / MEDIUM / HIGH / CRITICAL) | `backend/agents/risk.py` | See classification below |

### Risk Level Classification

| Condition | Level |
|-----------|-------|
| No disruption risk (`arrival ≤ stockout`) | **LOW** |
| `revenue_loss ≤ $20,000` | **MEDIUM** |
| `revenue_loss ≤ $50,000` | **HIGH** |
| `revenue_loss > $50,000` | **CRITICAL** |

### Raw Data Sources

| Variable | Source File | Description |
|----------|-----------|-------------|
| `stock` | `backend/data/inventory.csv` | Current inventory units (e.g. P1 = 500) |
| `daily_demand` | `backend/data/inventory.csv` | Units consumed per day (e.g. P1 = 80) |
| `MOCK_UNIT_PRICE` | `backend/agents/risk.py` (hardcoded `$100`) | Revenue per unit |
| `total_transit_days` | Computed in `backend/agents/monitoring.py` | `total_eta + total_delay` |
| `total_eta` | `backend/agents/monitoring.py` | `sum(segment.eta_days)` — each segment's ETA comes from the frontend request (`stops[].eta_days`, hardcoded to `2.0` per stop) |
| `total_delay` | `backend/agents/monitoring.py` | `sum(segment.delay_days)` — each segment's delay = frontend `delay_days` (0 or 3) + `extra_delay_days` from `mock_data.py` |
| `lost_units` | `backend/agents/risk.py` | `(shipment_arrival_days - stockout_days) × daily_demand` — only when `arrival > stockout` |
| `pending_orders` | `backend/data/orders.csv` | Orders for context (e.g. P1: order O1, qty 200, deadline 4d) |

---

## 2. Recovery Options Card (UI)

### Displayed Metrics

| UI Field | Display Format | Calculated In |
|----------|---------------|---------------|
| **Cost** | `${cost}` | `backend/agents/planner.py` |
| **Loss** | `${projected_loss}` | `backend/agents/planner.py` |
| **Timeline** | `{timeline_days}d` | `backend/agents/planner.py` |

### Per-Option Breakdown

#### Option 1: Wait for Shipment
| Field | Formula | Source |
|-------|---------|--------|
| Cost | `$0` (hardcoded) | — |
| Projected Loss | `= risk.revenue_loss` | From Risk Agent output |
| Total Impact | `= revenue_loss` | `cost + projected_loss` |
| Timeline | `= risk.shipment_arrival_days` | From Risk Agent output |

#### Option 2: Partial Air Shipment
| Field | Formula | Source |
|-------|---------|--------|
| Cost | `air_units × $250` | `air_units = min(200, daily_demand × arrival_days)`; `$250/unit` hardcoded |
| Projected Loss | `$0` | Assumes stockout eliminated |
| Total Impact | `= air_cost` | `cost + 0` |
| Timeline | `2 days` (hardcoded) | — |

#### Option 3: Alternate Supplier
| Field | Formula | Source |
|-------|---------|--------|
| Cost | `$30,000` (hardcoded) | Fixed supplier engagement cost |
| Projected Loss | `daily_demand × unit_price` | 1-day transition gap loss |
| Total Impact | `$30,000 + (daily_demand × unit_price)` | `cost + projected_loss` |
| Timeline | `3 days` (hardcoded) | — |

---

## 3. Decision Card (UI)

| UI Field | Display Format | Calculated In |
|----------|---------------|---------------|
| **Chosen Option** | Option name with ✅ | `backend/agents/decision.py` |
| **AI Reasoning** | LLM-generated text | `backend/agents/decision.py` via Groq LLM |

**Decision Rule:** Select the option with **minimum `total_impact`** (`cost + projected_loss`).

---

## 4. Hardcoded Constants

| Constant | Value | Location | Used For |
|----------|-------|----------|----------|
| `MOCK_UNIT_PRICE` | `$100` | `backend/agents/risk.py` | Revenue loss calculation |
| Air freight rate | `$250/unit` | `backend/agents/planner.py` | Air shipment cost |
| Air shipment max units | `200` | `backend/agents/planner.py` | Cap on air-shipped units |
| Alternate supplier cost | `$30,000` | `backend/agents/planner.py` | Fixed engagement cost |
| Air timeline | `2 days` | `backend/agents/planner.py` | Air freight delivery time |
| Alternate supplier timeline | `3 days` | `backend/agents/planner.py` | Supplier switch time |
| Default ETA per stop | `2.0 days` | `frontend/.../VisualizationPage.tsx` | Sent in API request |
| Disruption delay | `3.0 days` | `frontend/.../VisualizationPage.tsx` | Sent for disrupted stops |

---

## 5. Mock Data Sources

### `backend/data/inventory.csv`

| product_id | stock | daily_demand |
|-----------|-------|--------------|
| P1 | 500 | 80 |
| P2 | 300 | 50 |
| P3 | 1000 | 120 |

### `backend/data/orders.csv`

| order_id | product_id | quantity | deadline_days |
|----------|-----------|----------|---------------|
| O1 | P1 | 200 | 4 |
| O2 | P2 | 150 | 6 |
| O3 | P3 | 500 | 3 |

### `backend/services/mock_data.py` — Disruption Delays

| Port | Disruption Type | `extra_delay_days` |
|------|----------------|-------------------|
| Nhava Sheva (JNPT) | Port Congestion | 3.0 |
| Chennai | Customs Delay | 2.0 |
| Kochi | None | 0.0 |
| Visakhapatnam | Port Closure | 4.0 |
| Mundra | None | 0.0 |
| Kolkata (Haldia) | Draft Restriction | 1.5 |
| Kandla | Equipment Shortage | 1.5 |
| Tuticorin | None | 0.0 |
| New Mangalore | None | 0.0 |
| Paradip | Port Congestion | 2.0 |

---

## 6. Worked Example (Product P1)

Route: Origin → Stop1 (clear) → Stop2 (Nhava Sheva, disrupted) → Stop3 (clear) → Destination

```
── MonitoringAgent ──
  Segments:   4 segments, each with eta_days=2.0
  total_eta:  2+2+2+2 = 8 days
  Delays:     Stop2 has frontend delay (3.0) + mock extra_delay (3.0) = 6.0
  total_delay: 0+6+0+0 = 6 days
  total_transit_days: 8+6 = 14 days

── RiskAgent ──
  stock:               500 units         (from inventory.csv)
  daily_demand:        80 units/day      (from inventory.csv)
  stockout_days:       500/80 = 6.25 days
  shipment_arrival:    14 days           (from MonitoringAgent)
  disruption_risk:     14 > 6.25 → TRUE
  lost_units:          (14 - 6.25) × 80 = 620 units
  revenue_loss:        620 × $100 = $62,000
  risk_level:          CRITICAL (> $50,000)

── PlannerAgent ──
  Option 1 — Wait:
    cost = $0
    loss = $62,000 (= revenue_loss)
    total = $62,000
    timeline = 14 days

  Option 2 — Air Shipment:
    air_units = min(200, 80×14) = 200
    cost = 200 × $250 = $50,000
    loss = $0
    total = $50,000
    timeline = 2 days

  Option 3 — Alternate Supplier:
    cost = $30,000
    loss = 80 × $100 = $8,000 (1-day gap)
    total = $38,000
    timeline = 3 days

── DecisionAgent ──
  Comparison:
    Wait:     $62,000
    Air:      $50,000
    Alt Sup:  $38,000  ← minimum
  Chosen: Alternate Supplier ($38,000 total impact)
```

---

## 7. File Reference

| File | Purpose |
|------|---------|
| `backend/agents/pipeline.py` | Orchestrates the 4-agent chain sequentially |
| `backend/agents/monitoring.py` | Stage 1: Weather/disruption monitoring per segment |
| `backend/agents/risk.py` | Stage 2: Stockout & revenue loss calculation |
| `backend/agents/planner.py` | Stage 3: Generates 3 recovery options |
| `backend/agents/decision.py` | Stage 4: Picks optimal option by min total_impact |
| `backend/data/inventory.csv` | Product stock & daily demand data |
| `backend/data/orders.csv` | Pending order data |
| `backend/services/mock_data.py` | Hardcoded weather & disruption data for 10 ports |
| `backend/services/data_loader.py` | CSV loading helpers (pandas) |
| `backend/services/groq_client.py` | LLM client for natural language analysis |
| `backend/main.py` | FastAPI endpoints (`/run-agents`, `/execute-plan`) |
| `frontend/.../VisualizationPage.tsx` | UI rendering of all agent metrics |
