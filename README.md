<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" />
  <img src="https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white" />
  <img src="https://img.shields.io/badge/LLaMA_3.3_70B-Groq-FF6B35?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Pandas-150458?style=for-the-badge&logo=pandas&logoColor=white" />
</p>

<h1 align="center">🛡️ Agentic Disruption Shield</h1>
<h3 align="center"><em>AI-Powered Supply Chain Disruption Manager for SMEs</em></h3>

<p align="center">
  Autonomous multi-agent system powered by <strong>LLaMA 3.3 70B</strong> (via Groq) with an<br/>
  <strong>interactive global map interface</strong> — monitor shipments, simulate disruptions,<br/>
  compute alternative routes, and get AI-powered recovery recommendations in real time.
</p>

---

## 📌 Table of Contents

- [Problem Overview](#-problem-overview)
- [Solution Overview](#-solution-overview)
- [Architecture Diagram](#-architecture-diagram)
- [Interactive Map Dashboard](#-interactive-map-dashboard)
- [Agent Workflow](#-agent-workflow)
- [Risk Calculation Logic](#-risk-calculation-logic)
- [Scenario Simulation Logic](#-scenario-simulation-logic)
- [Supported Locations](#-supported-locations)
- [Pre-configured Shipments](#-pre-configured-shipments)
- [API Endpoints](#-api-endpoints)
- [Project Structure](#-project-structure)
- [Setup Instructions](#-setup-instructions)
- [Sample API Calls](#-sample-api-calls)
- [Why This Matters for SMEs](#-why-this-matters-for-smes)
- [Future Improvements](#-future-improvements)
- [Hackathon Pitch Summary](#-hackathon-pitch-summary)

---

## 🔴 Problem Overview

Small and medium enterprises (SMEs) are the backbone of global commerce — yet they are the **most vulnerable** to supply chain disruptions.

| Disruption Type | Impact |
|---|---|
| 🚢 Port congestion & strikes | Shipments stuck at congested ports for days |
| 🌪️ Typhoons, monsoons & storms | Routes blocked, perishable goods at risk |
| 🪧 Labor strikes & customs delays | Warehouse & logistics standstills |
| 📦 Multi-leg route failures | One delayed segment cascades across the chain |

**The reality for most SMEs today:**

- Manual tracking through spreadsheets, phone calls, and emails
- Problems detected **only after** they cause damage
- No ability to evaluate recovery options quantitatively
- Even a **2-day delay** at a single port can cascade into stockouts, cancelled orders, and revenue loss

> 💡 **A single undetected shipment delay can cost an SME up to 15–30% of the affected order's revenue** — yet most SMEs have zero automated detection systems in place.

---

## 💡 Solution Overview

**Agentic Disruption Shield** is an autonomous AI system powered by **LLaMA 3.3 70B** (via Groq) that acts as a **24/7 supply chain intelligence layer** for SMEs.

The system features an **interactive global map** built with Leaflet where users can:

- 🗺️ **Visualize** shipment routes across 10 global ports in real time
- ⚡ **Simulate** disruptions at any node (port strikes, weather events, customs delays)
- 🔀 **Compute** alternative routes that automatically bypass disrupted ports
- 🧠 **Run** the 4-agent AI pipeline for risk assessment and recovery recommendations

### Core Capabilities

| Capability | Description |
|---|---|
| 🗺️ **Interactive Map** | Leaflet-based world map with port markers, route lines, and disruption overlays |
| 📡 **Route Monitoring** | Scans each segment for weather hazards, port disruptions, and delay signals |
| ⚠️ **Risk Reasoning** | Predicts stockout timelines, estimates revenue at risk with LLM analysis |
| 📊 **Scenario Planning** | Simulates 3 recovery options with cost/loss/timeline tradeoffs |
| 🧠 **Decision Making** | Selects the optimal action using min(cost + loss) with LLM justification |
| 🔀 **Alt Route Engine** | Auto-computes bypass routes through non-disrupted ports |
| ⚡ **Disruption Simulation** | Click any node to inject disruptions and see cascading effects |

Each agent uses **LangChain + Groq LLaMA 3.3 70B** to generate natural language analysis, making every decision transparent and explainable.

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                NEXT.JS FRONTEND (TypeScript + Leaflet)              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              🗺️ INTERACTIVE MAP (OpenStreetMap)              │   │
│  │                                                              │   │
│  │  • Port/Airport/Hub markers with disruption badges           │   │
│  │  • Curved route polylines (teal = clear, red = disrupted)    │   │
│  │  • Blue dashed lines for alternative routes                  │   │
│  │  • Click-to-disrupt: simulate events at any node             │   │
│  │  • Fly-to animation on shipment/search selection             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐  │
│  │ 🔍 Search   │  │ 📦 Shipment  │  │ 🚨 Status│  │ 📋 Detail  │  │
│  │ Sidebar     │  │   Cards      │  │  Filters │  │   Panel    │  │
│  └─────────────┘  └──────────────┘  └──────────┘  └────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │  HTTP (REST) — Port 3000 → 8000
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     FASTAPI BACKEND (Python)                        │
│                                                                     │
│  GET /status   GET /locations   POST /run-agents   POST /execute   │
│                (+ lat/lng)                                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│               AGENTIC PIPELINE (Sequential Chain)                   │
│                                                                     │
│  📡 Monitoring ──▶ ⚠️ Risk ──▶ 📋 Planner ──▶ 🎯 Decision         │
│     Agent            Agent        Agent           Agent             │
│   (+ LLM)          (+ LLM)     (+ LLM)         (+ LLM)            │
│                                                                     │
│  LLM Engine: LLaMA 3.3 70B via Groq (LangChain ChatOpenAI)        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │ 📦 Inventory│ │ 🌦️ Weather │ │ 🚨 Disrupt │
       │   CSV Data  │ │  + lat/lng │ │  Mock Data │
       └────────────┘ └────────────┘ └────────────┘
```

---

## 🗺️ Interactive Map Dashboard

The centerpiece of the UI is a **full-screen interactive map** powered by Leaflet + OpenStreetMap.

### Map Features

| Feature | Description |
|---|---|
| 🔵 **Node Markers** | Color-coded icons for ports (⚓), airports (✈️), and hubs (🏭) |
| 🔴 **Disruption Badges** | Red dot overlay on nodes with active disruptions |
| 🟩 **Clear Routes** | Solid teal curved polylines for healthy shipment segments |
| 🟥 **Disrupted Routes** | Red dashed polylines for segments hitting disrupted nodes |
| 🔵 **Alt Routes** | Blue dashed polylines showing computed bypass routes |
| 🔍 **Port Search** | Search sidebar to find ports/airports by name or country |
| 🎯 **Fly-To** | Smooth animated pan & zoom when selecting a shipment or search result |
| 📋 **Detail Panel** | Slide-out panel with shipment info, route chain, and disruption alerts |
| 📊 **Status Filters** | Filter shipments by All / On Time / At Risk / Disrupted |

### Disruption Simulation

Click **any node** on the map to open the disruption modal:

```
┌────────────────────────────────────────┐
│  ⚠️ Simulate Disruption — Shanghai     │
├────────────────────────────────────────┤
│  Type:     [ Port Strike        ▾ ]   │
│  Severity: [ medium             ▾ ]   │
│  Delay:    [ 12 ] hours               │
│  Details:  [ _____________________ ]  │
│                                        │
│  [ Clear Disruption ]  [ ✓ Confirm ]  │
└────────────────────────────────────────┘
```

Supported disruption types:
- Port Strike
- Port Congestion
- Customs Delay
- Weather Closure
- Equipment Failure
- Security Alert

### Alternative Route Computation

When a **middle node** in a shipment's route is disrupted, the system automatically computes an alternative route:

```
Original:  Shanghai ──▶ Singapore ──▶ Colombo ──▶ Dubai ──▶ Rotterdam
                              ❌ (disrupted)
Alt Route: Shanghai ──▶ Singapore ──▶ Mumbai   ──▶ Dubai ──▶ Rotterdam
                              ✅ (nearest non-disrupted port)
```

The algorithm selects the **geographically nearest non-disrupted port** as a bypass, displayed as a blue dashed line on the map.

---

## 🤖 Agent Workflow

The system employs a **sequential 4-agent pipeline** where each agent receives structured Pydantic output from its predecessor. **Every agent uses LLM reasoning** for natural language analysis.

```
Route Input ──▶ MonitoringAgent ──▶ RiskAgent ──▶ PlannerAgent ──▶ DecisionAgent ──▶ Recommendation
                   (LLM ✓)          (LLM ✓)       (LLM ✓)          (LLM ✓)
```

### Agent Descriptions

#### 1. 📡 MonitoringAgent (`agents/monitoring.py`)
> *"What is happening across the route right now?"*

- Breaks the route into **segments** (origin → stop₁ → stop₂ → ... → destination)
- For each segment, looks up **weather risk** (low/medium/high) and **active disruptions** (port strikes, congestion, customs delays)
- Aggregates total ETA, total delay, and total transit time
- Calls **LLaMA 3.3 70B** to generate a natural language monitoring summary

**Output:** `MonitoringResult` — segment reports, weather summary, disruption summary, LLM analysis

#### 2. ⚠️ RiskAgent (`agents/risk.py`)
> *"How bad could this get?"*

- Reads inventory data (stock, daily demand) from CSV
- Calculates **days-to-stockout** and compares against shipment arrival time
- Estimates **revenue at risk** in dollars
- Assigns a **risk level**: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`
- Calls **LLaMA 3.3 70B** for risk analysis narrative

**Output:** `RiskResult` — stockout days, lost units, revenue loss, risk level, LLM analysis

#### 3. 📋 PlannerAgent (`agents/planner.py`)
> *"What are my options?"*

- Generates **3 recovery scenarios**:
  - **Wait for Shipment** — $0 cost, full revenue loss
  - **Partial Air Shipment** — $250/unit air freight, eliminates stockout (2-day delivery)
  - **Alternate Supplier** — $30,000 fixed cost, 1-day transition gap (3-day delivery)
- Calls **LLaMA 3.3 70B** for strategic planning context

**Output:** `PlannerResult` — ranked recovery options with cost/loss/timeline, LLM strategic analysis

#### 4. 🎯 DecisionAgent (`agents/decision.py`)
> *"What should I do?"*

- Simulates all scenarios side-by-side
- Applies **minimum total impact** decision rule: `argmin(cost + projected_loss)`
- Calls **LLaMA 3.3 70B** to generate VP-level justification

**Output:** `DecisionResult` — simulation table, chosen option, LLM reasoning

```python
# Agentic Reasoning: Each agent operates autonomously — consuming structured
# input, applying domain logic, augmenting with LLM analysis, and producing
# structured output. This chain demonstrates the full agentic paradigm:
# perception → reasoning → planning → decision.
```

---

## 📐 Risk Calculation Logic

### Stockout Prediction

```
days_to_stockout = current_stock / daily_demand
```

A product is **at risk** if:

```
days_to_stockout < total_transit_days  (ETA + all delays across segments)
```

### Revenue Loss Estimation

```
lost_days    = total_transit_days − days_to_stockout
lost_units   = lost_days × daily_demand
revenue_loss = lost_units × unit_price   (default: $100/unit)
```

### Risk Level Classification

| Risk Level | Condition |
|---|---|
| 🔴 `CRITICAL` | Stockout imminent (< 3 days) AND disruption active |
| 🟠 `HIGH` | Stockout before shipment arrives |
| 🟡 `MEDIUM` | Tight timeline, disruption risk present |
| 🟢 `LOW` | Stock sufficient, shipment on track |

> 📌 **Example:** A product with 100 units in stock, 20 units/day demand, and a route with 7 total transit days will stockout in 5 days — leaving 2 days of unmet demand = **40 units × $100 = $4,000 at risk**.

---

## 🎯 Scenario Simulation Logic

For each at-risk product, the **PlannerAgent** generates three recovery scenarios:

| Scenario | Cost Formula | Timeline |
|---|---|---|
| 🕐 **Wait for Shipment** | `$0 + full_revenue_loss` | Shipment arrival |
| ✈️ **Partial Air Shipment** | `min(200, demand × days) × $250/unit + $0 loss` | 2 days |
| 🏭 **Alternate Supplier** | `$30,000 fixed + 1_day_demand × unit_price` | 3 days |

### Decision Rule

```
optimal_action = argmin(cost + projected_loss)
```

> The DecisionAgent selects the scenario that **minimizes total financial impact**, then uses LLaMA 3.3 to explain the decision as if presenting to a VP of Supply Chain.

---

## 🌍 Supported Locations

The system includes **10 global shipping ports** with GPS coordinates, weather, and disruption data:

| Location | Country | Coordinates | Weather Risk | Active Disruptions |
|---|---|---|---|---|
| 🇨🇳 Shanghai | China | 31.23°N, 121.47°E | 🔴 High — Typhoon | Congestion (+2d) |
| 🇸🇬 Singapore | Singapore | 1.26°N, 103.82°E | 🟢 Low — Clear | None |
| 🇮🇳 Mumbai | India | 18.95°N, 72.95°E | 🔴 High — Monsoon | Customs (+1.5d) |
| 🇦🇪 Dubai | UAE | 25.01°N, 55.08°E | 🟢 Low — Sunny | None |
| 🇳🇱 Rotterdam | Netherlands | 51.91°N, 4.47°E | 🟡 Medium — Fog | None |
| 🇺🇸 Los Angeles | USA | 33.74°N, 118.27°W | 🟡 Medium — Windy | Labor (+1d) |
| 🇱🇰 Colombo | Sri Lanka | 6.95°N, 79.84°E | 🟡 Medium — Monsoon | None |
| 🇯🇵 Tokyo | Japan | 35.68°N, 139.65°E | 🟢 Low — Clear | None |
| 🇩🇪 Hamburg | Germany | 53.55°N, 9.99°E | 🔴 High — Storm | Port closure (+3d) |
| 🇦🇺 Sydney | Australia | 33.87°S, 151.21°E | 🟢 Low — Clear | None |

---

## 📦 Pre-configured Shipments

The dashboard comes with **4 demo shipments** to showcase the system:

| ID | Carrier | Cargo | Weight | Mode | Route |
|---|---|---|---|---|---|
| SHP-4821 | Maersk Line | Electronics — 3 containers | 12,400 kg | 🚢 Sea | Shanghai → Singapore → Colombo → Dubai → Rotterdam |
| SHP-4835 | COSCO Shipping | Auto Parts — 5 containers | 24,000 kg | 🚢 Sea | Shanghai → Tokyo → Los Angeles |
| SHP-4847 | Emirates SkyCargo | Medical Supplies — 150 cartons | 900 kg | ✈️ Air | Dubai → Mumbai |
| SHP-4852 | Hapag-Lloyd | Machinery Parts — 12 pallets | 3,800 kg | 🚢 Sea | Hamburg → Rotterdam |

> 💡 Click any shipment card in the sidebar to highlight its route on the map and view detailed tracking info.

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/status` | Health check — returns service status |
| `GET` | `/locations` | Returns all 10 ports with weather, disruption data, and GPS coordinates |
| `POST` | `/run-agents` | Runs the full 4-agent pipeline on a shipment route |
| `POST` | `/execute-plan` | Simulates executing a chosen recovery action |

### Request Schema — `POST /run-agents`

```json
{
  "product_id": "P1",
  "origin": "Shanghai",
  "destination": "Mumbai",
  "stops": [
    { "stop_name": "Singapore", "eta_days": 3, "delay_days": 0 },
    { "stop_name": "Colombo", "eta_days": 2, "delay_days": 1 }
  ]
}
```

### Response Schema — `POST /run-agents`

```json
{
  "success": true,
  "data": {
    "monitoring": {
      "product_id": "P1",
      "origin": "Shanghai",
      "destination": "Mumbai",
      "segments": [
        {
          "from_location": "Shanghai",
          "to_location": "Singapore",
          "eta_days": 3,
          "delay_days": 0,
          "weather_risk": "low",
          "disruption_active": false
        }
      ],
      "total_eta": 8,
      "total_delay": 2.5,
      "total_transit_days": 10.5,
      "weather_summary": "⚠️ HIGH weather risk on 1 segment(s)",
      "disruption_summary": "🚨 Active disruptions on route",
      "llm_analysis": "LLM-generated natural language analysis..."
    },
    "risk": {
      "stock": 500,
      "daily_demand": 80,
      "stockout_days": 6.25,
      "revenue_loss": 34000,
      "risk_level": "HIGH",
      "llm_analysis": "..."
    },
    "planner": {
      "options": [
        { "option_name": "Wait for Shipment", "cost": 0, "projected_loss": 34000, "total_impact": 34000, "timeline_days": 10.5 },
        { "option_name": "Partial Air Shipment", "cost": 50000, "projected_loss": 0, "total_impact": 50000, "timeline_days": 2 },
        { "option_name": "Alternate Supplier", "cost": 30000, "projected_loss": 8000, "total_impact": 38000, "timeline_days": 3 }
      ],
      "llm_analysis": "..."
    },
    "decision": {
      "chosen_option": { "option_name": "Wait for Shipment", "total_impact": 34000 },
      "reasoning": "LLM-generated VP-level justification..."
    }
  }
}
```

---

## 📁 Project Structure

```
buildwithai2/
│
├── 📄 requirements.txt                           # Python dependencies
├── 📄 .gitignore
│
├── 📂 backend/
│   ├── 📄 main.py                                # FastAPI app — 4 endpoints
│   │
│   ├── 📂 agents/
│   │   ├── 📄 __init__.py                        # Package init
│   │   ├── 📄 monitoring.py                      # MonitoringAgent — route scan + LLM
│   │   ├── 📄 risk.py                            # RiskAgent — stockout prediction + LLM
│   │   ├── 📄 planner.py                         # PlannerAgent — 3 scenarios + LLM
│   │   ├── 📄 decision.py                        # DecisionAgent — optimal pick + LLM
│   │   └── 📄 pipeline.py                        # Sequential orchestrator with logging
│   │
│   ├── 📂 services/
│   │   ├── 📄 __init__.py
│   │   ├── 📄 data_loader.py                     # CSV ingestion (inventory, orders)
│   │   ├── 📄 groq_client.py                     # Groq LLaMA 3.3 70B via LangChain
│   │   └── 📄 mock_data.py                       # 10 locations + weather + disruptions + GPS
│   │
│   └── 📂 data/
│       ├── 📄 inventory.csv                      # Product stock & demand data
│       └── 📄 orders.csv                         # Customer order data
│
└── 📂 frontend/
    └── 📂 nextjs-input-page/                     # Next.js 16 TypeScript frontend
        ├── 📄 package.json                       # Deps: leaflet, react-leaflet, lucide-react, axios
        ├── 📄 tsconfig.json
        ├── 📄 next.config.ts
        └── 📂 src/
            └── 📂 app/
                ├── 📄 page.tsx                   # Auto-redirect to /map
                ├── 📄 layout.tsx                 # Root layout
                ├── 📄 globals.css                # Global styles
                └── 📂 map/                       # 🗺️ Map Dashboard (main UI)
                    ├── 📄 page.tsx               # Map page — shipments, search, disruption modal
                    ├── 📄 MapView.tsx            # Leaflet map component (markers, routes, alt paths)
                    └── 📄 map.css                # Map-specific styles (dark theme)
```

---

## ⚙️ Setup Instructions

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- **Groq API Key** — Get one free at [console.groq.com](https://console.groq.com)

### 1. Clone the Repository

```bash
git clone https://github.com/GowrishankarSMenon/buildwithai2.git
cd buildwithai2
git checkout ui
```

### 2. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Create .env file with your Groq API key
echo "GROQ_API_KEY=your_groq_api_key_here" > backend/.env

# Start the FastAPI backend
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup

```bash
# In a new terminal
cd frontend/nextjs-input-page

# Install dependencies
npm install

# Start the Next.js dev server
npm run dev
```

### Access Points

| Service | URL |
|---|---|
| 🗺️ Map Dashboard | [http://localhost:3000/map](http://localhost:3000/map) |
| 📡 API Docs (Swagger) | [http://localhost:8000/docs](http://localhost:8000/docs) |
| 🔗 API Base | [http://localhost:8000](http://localhost:8000) |

> 💡 The homepage (`/`) automatically redirects to `/map`.

---

## 🧪 Sample API Calls

### Health Check

```bash
curl http://localhost:8000/status
```

```json
{ "status": "running", "service": "Agentic Disruption Shield" }
```

### Get All Locations (with GPS)

```bash
curl http://localhost:8000/locations
```

```json
{
  "locations": [
    {
      "name": "Shanghai",
      "country": "China",
      "type": "port",
      "lat": 31.2304,
      "lng": 121.4737,
      "weather": { "risk": "high", "detail": "Typhoon warning..." },
      "disruption": { "active": true, "type": "Congestion", "extra_delay_days": 2 }
    }
  ]
}
```

### Run the Agent Pipeline

```bash
curl -X POST http://localhost:8000/run-agents \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "P1",
    "origin": "Shanghai",
    "destination": "Mumbai",
    "stops": [
      { "stop_name": "Singapore", "eta_days": 3, "delay_days": 0 },
      { "stop_name": "Colombo", "eta_days": 2, "delay_days": 1 }
    ]
  }'
```

### Execute a Recovery Plan

```bash
curl -X POST http://localhost:8000/execute-plan \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "P1",
    "chosen_option": "Partial Air Shipment",
    "details": "Emergency air freight for critical stock"
  }'
```

```json
{
  "success": true,
  "execution": {
    "product_id": "P1",
    "chosen_option": "Partial Air Shipment",
    "action": "air_freight_booked",
    "message": "✈️ Air freight booking confirmed for product P1. Estimated arrival: 2 days.",
    "booking_ref": "AIR-2025-P1"
  }
}
```

---

## 🏢 Why This Matters for SMEs

| Challenge | Without Shield | With Shield |
|---|---|---|
| **Delay Detection** | Manual — discovered hours/days late | Real-time map with disruption badges |
| **Route Visibility** | Black box after dispatch | Interactive map with segment-by-segment status |
| **Disruption Response** | React after damage | Simulate disruptions and see impact before they happen |
| **Route Alternatives** | Manually call brokers | Auto-computed bypass routes through safe ports |
| **Risk Assessment** | Gut feeling | Quantified: stockout days, $ at risk, risk level |
| **Recovery Planning** | Ad-hoc phone calls | 3 simulated scenarios with LLM-powered analysis |
| **Decision Making** | Owner's intuition | Data-driven + LLM-justified recommendation |

> 🏭 **For a $2M/year SME**, a single prevented disruption cycle can save **$20,000–$60,000** annually. Agentic Disruption Shield makes this intelligence accessible to businesses that can't afford enterprise supply chain platforms.

---

## 🚀 Future Improvements

| Priority | Enhancement | Description |
|---|---|---|
| 🔴 High | **Live Carrier APIs** | Connect to FedEx, DHL, Maersk for real-time tracking |
| 🔴 High | **Real Weather API** | Replace mock data with OpenWeatherMap / AccuWeather |
| 🔴 High | **Live Map Tracking** | Animate vessel positions along routes in real time |
| 🟡 Medium | **Multi-Product Pipeline** | Handle entire catalog risk assessment in parallel |
| 🟡 Medium | **Docker Compose** | Full-stack deployment (FastAPI + Next.js + Redis) |
| 🟡 Medium | **Historical Analytics** | Track past disruptions and build predictive models |
| 🟡 Medium | **Custom Node Types** | Add warehouses, distribution centers, and inland hubs |
| 🟢 Low | **Notification System** | Email/SMS/Slack alerts for critical risk events |
| 🟢 Low | **Role-Based Access** | Different views for operations, finance, and management |
| 🟢 Low | **Supplier Scoring** | Rank suppliers by reliability based on historical data |

---

## 🎤 Hackathon Pitch Summary

> **One-liner:** *"We built an AI agent that watches your supply chain — on a live map — so you don't have to."*

**Agentic Disruption Shield** transforms how small businesses handle supply chain crises. Using **LLaMA 3.3 70B** via Groq and an **interactive global map**:

1. 🗺️ **Visualizes** every shipment route across 10 global ports on an interactive Leaflet map
2. ⚡ **Simulates** disruptions at any node — see cascading effects in real time
3. 🔀 **Computes** alternative routes through safe ports automatically
4. 📡 **Monitors** every segment for weather hazards and port disruptions
5. ⚠️ **Predicts** the exact stockout date and dollar amount at risk
6. 📋 **Simulates** three recovery strategies with full cost/timeline breakdowns
7. 🧠 **Recommends** the optimal action with LLM-generated VP-level justification
8. ⚡ **Executes** the recovery plan with a single click

This isn't a dashboard that shows you data. This is an **autonomous agent system** with a **live map interface** that thinks, plans, and explains — powered by real LLM reasoning at every stage.

> 🛡️ *Agentic Disruption Shield — Because SMEs deserve enterprise-grade resilience.*

---

## 👥 Contributors

<a href="https://github.com/GowrishankarSMenon/buildwithai2/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=GowrishankarSMenon/buildwithai2" />
</a>

---

<p align="center">
  Built with ❤️ for the future of autonomous supply chain intelligence
</p>

<p align="center">
  <strong>⭐ Star this repo if you believe AI agents should work for small businesses too.</strong>
</p>
