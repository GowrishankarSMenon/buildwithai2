"use client";

/**
 * Agentic Disruption Shield — Main Input Page
 * =============================================
 * Single-page interface for the AI Supply Chain Disruption Manager.
 *
 * Features:
 * - Product ID, From/To location inputs
 * - Dynamic intermediate stop management (add/remove)
 * - ETA and delay per segment
 * - Submit to /run-agents endpoint
 * - Display: route timeline, risk status, recommended plan, reasoning
 * - Execute plan button for mock execution
 */

import { useState, useCallback } from "react";
import axios from "axios";

// ── Types ────────────────────────────────────────────────────────────

interface Stop {
  id: number;
  stop_name: string;
  eta_days: number;
  delay_days: number;
}

interface SegmentReport {
  from_location: string;
  to_location: string;
  eta_days: number;
  delay_days: number;
  weather_risk: string;
  weather_detail: string;
}

interface SimulationEntry {
  option_name: string;
  cost: number;
  projected_loss: number;
  total_impact: number;
  chosen: boolean;
}

interface AgentResult {
  monitoring: {
    product_id: string;
    origin: string;
    destination: string;
    segments: SegmentReport[];
    total_eta: number;
    total_delay: number;
    total_transit_days: number;
    weather_summary: string;
    llm_analysis: string;
  };
  risk: {
    product_id: string;
    stock: number;
    daily_demand: number;
    stockout_days: number;
    shipment_arrival_days: number;
    disruption_risk: boolean;
    lost_units: number;
    revenue_loss: number;
    risk_level: string;
    llm_analysis: string;
    pending_orders: Array<Record<string, unknown>>;
  };
  planner: {
    product_id: string;
    options: Array<{
      option_name: string;
      description: string;
      cost: number;
      projected_loss: number;
      total_impact: number;
      timeline_days: number;
    }>;
    llm_analysis: string;
  };
  decision: {
    product_id: string;
    simulations: SimulationEntry[];
    chosen_option: {
      option_name: string;
      description: string;
      cost: number;
      projected_loss: number;
      total_impact: number;
      timeline_days: number;
    };
    reasoning: string;
  };
}

// ── Backend URL ──────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Component ────────────────────────────────────────────────────────

export default function HomePage() {
  // Form state
  const [productId, setProductId] = useState("P1");
  const [origin, setOrigin] = useState("Shanghai");
  const [destination, setDestination] = useState("Mumbai");
  const [stops, setStops] = useState<Stop[]>([
    { id: 1, stop_name: "Singapore", eta_days: 3, delay_days: 1 },
    { id: 2, stop_name: "Colombo", eta_days: 2, delay_days: 2 },
  ]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<Record<string, unknown> | null>(null);

  let nextId = stops.length > 0 ? Math.max(...stops.map((s) => s.id)) + 1 : 1;

  // ── Stop Management ──────────────────────────────────────────────

  const addStop = useCallback(() => {
    setStops((prev) => [
      ...prev,
      { id: Date.now(), stop_name: "", eta_days: 1, delay_days: 0 },
    ]);
  }, []);

  const removeStop = useCallback((id: number) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateStop = useCallback(
    (id: number, field: keyof Stop, value: string | number) => {
      setStops((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
      );
    },
    []
  );

  // ── Submit Pipeline ──────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setExecutionResult(null);

    try {
      const payload = {
        product_id: productId,
        origin,
        destination,
        stops: stops.map(({ stop_name, eta_days, delay_days }) => ({
          stop_name,
          eta_days: Number(eta_days),
          delay_days: Number(delay_days),
        })),
      };

      const res = await axios.post(`${API_BASE}/run-agents`, payload);
      setResult(res.data.data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to run agent pipeline";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // ── Execute Plan ─────────────────────────────────────────────────

  const handleExecute = async () => {
    if (!result) return;
    setExecuting(true);

    try {
      const payload = {
        product_id: result.decision.product_id,
        chosen_option: result.decision.chosen_option.option_name,
        details: result.decision.reasoning,
      };
      const res = await axios.post(`${API_BASE}/execute-plan`, payload);
      setExecutionResult(res.data.execution);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Execution failed";
      setError(message);
    } finally {
      setExecuting(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────

  const formatCurrency = (val: number) =>
    `$${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const riskClass = (level: string) => level.toLowerCase();

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <h1>🛡️ Agentic Disruption Shield</h1>
        <p>AI-Powered Supply Chain Disruption Manager for SMEs</p>
      </header>

      {/* ── Input Form ──────────────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <div className="card">
          <h2>📦 Shipment Details</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Product ID</label>
              <input
                type="text"
                placeholder="e.g. P1"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
              />
            </div>
            <div className="form-group" />
            <div className="form-group">
              <label>From (Origin)</label>
              <input
                type="text"
                placeholder="e.g. Shanghai"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>To (Destination)</label>
              <input
                type="text"
                placeholder="e.g. Mumbai"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* ── Intermediate Stops ──────────────────────────────── */}
        <div className="card">
          <h2>🛤️ Route Segments</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
            Add intermediate stops with estimated transit time and known delays per segment.
          </p>

          {stops.map((stop, index) => (
            <div key={stop.id} className="stop-item">
              <div className="form-group">
                <label>Stop #{index + 1}</label>
                <input
                  type="text"
                  placeholder="City name"
                  value={stop.stop_name}
                  onChange={(e) =>
                    updateStop(stop.id, "stop_name", e.target.value)
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>ETA (days)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={stop.eta_days}
                  onChange={(e) =>
                    updateStop(stop.id, "eta_days", parseFloat(e.target.value) || 0)
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label>Delay (days)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={stop.delay_days}
                  onChange={(e) =>
                    updateStop(stop.id, "delay_days", parseFloat(e.target.value) || 0)
                  }
                  required
                />
              </div>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => removeStop(stop.id)}
                title="Remove stop"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={addStop}
            style={{ marginTop: "0.5rem" }}
          >
            + Add Stop
          </button>
        </div>

        {/* ── Submit ──────────────────────────────────────────── */}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: "100%", padding: "0.85rem", fontSize: "0.95rem" }}
        >
          {loading ? (
            <>
              <span className="spinner" /> Running Agent Pipeline...
            </>
          ) : (
            "🚀 Run Disruption Analysis"
          )}
        </button>
      </form>

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && (
        <div className="error-box" style={{ marginTop: "1.5rem" }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────── */}
      {result && (
        <div className="results-section" style={{ marginTop: "1.5rem" }}>
          {/* Route Timeline */}
          <div className="card">
            <h2>🗺️ Route Timeline</h2>
            <div className="timeline">
              {result.monitoring.segments.map((seg, i) => (
                <div
                  key={i}
                  className={`timeline-item ${seg.delay_days > 0 ? "delayed" : ""}`}
                >
                  <div className="timeline-label">
                    {seg.from_location} → {seg.to_location}
                  </div>
                  <div className="timeline-meta">
                    ETA: {seg.eta_days}d
                    {seg.delay_days > 0 && (
                      <span style={{ color: "var(--accent-red)", fontWeight: 600 }}>
                        {" "}
                        +{seg.delay_days}d delay
                      </span>
                    )}
                    {" · "}Weather: {seg.weather_risk}
                  </div>
                </div>
              ))}
            </div>

            {/* Transit Stats */}
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-value">{result.monitoring.total_eta}d</div>
                <div className="stat-label">Base ETA</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{result.monitoring.total_delay}d</div>
                <div className="stat-label">Total Delay</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{result.monitoring.total_transit_days}d</div>
                <div className="stat-label">Transit Time</div>
              </div>
            </div>
            <p style={{ marginTop: "0.75rem", fontSize: "0.82rem", color: "var(--text-muted)" }}>
              {result.monitoring.weather_summary}
            </p>
          </div>

          {/* Risk Assessment */}
          <div className="card">
            <h2>
              ⚠️ Risk Assessment{" "}
              <span className={`risk-badge ${riskClass(result.risk.risk_level)}`}>
                {result.risk.risk_level}
              </span>
            </h2>

            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-value">{result.risk.stock}</div>
                <div className="stat-label">Current Stock</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{result.risk.daily_demand}/d</div>
                <div className="stat-label">Daily Demand</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{result.risk.stockout_days}d</div>
                <div className="stat-label">Days to Stockout</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">
                  {formatCurrency(result.risk.revenue_loss)}
                </div>
                <div className="stat-label">Revenue at Risk</div>
              </div>
            </div>

            <div className="reasoning-box" style={{ marginTop: "1rem" }}>
              <strong>🤖 AI Risk Analysis:</strong>
              <br />
              {result.risk.llm_analysis}
            </div>
          </div>

          {/* Scenario Simulation */}
          <div className="card">
            <h2>📊 Scenario Simulation</h2>

            <table className="scenario-table">
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Cost</th>
                  <th>Projected Loss</th>
                  <th>Total Impact</th>
                </tr>
              </thead>
              <tbody>
                {result.decision.simulations.map((sim, i) => (
                  <tr key={i} className={sim.chosen ? "chosen" : ""}>
                    <td>
                      {sim.chosen && "✅ "}
                      {sim.option_name}
                    </td>
                    <td>{formatCurrency(sim.cost)}</td>
                    <td>{formatCurrency(sim.projected_loss)}</td>
                    <td style={{ fontWeight: 600 }}>
                      {formatCurrency(sim.total_impact)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Decision & Reasoning */}
          <div className="card">
            <h2>🎯 Recommended Action</h2>
            <div style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              {result.decision.chosen_option.option_name}
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {result.decision.chosen_option.description}
            </p>

            <div className="stats-grid" style={{ marginTop: "0.75rem" }}>
              <div className="stat-box">
                <div className="stat-value">
                  {formatCurrency(result.decision.chosen_option.cost)}
                </div>
                <div className="stat-label">Cost</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">
                  {formatCurrency(result.decision.chosen_option.projected_loss)}
                </div>
                <div className="stat-label">Projected Loss</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">
                  {result.decision.chosen_option.timeline_days}d
                </div>
                <div className="stat-label">Timeline</div>
              </div>
            </div>

            <div className="reasoning-box">
              <strong>🧠 AI Reasoning:</strong>
              <br />
              {result.decision.reasoning}
            </div>

            {/* Execute Button */}
            <button
              className="btn btn-execute"
              onClick={handleExecute}
              disabled={executing}
              style={{ width: "100%", marginTop: "1rem", padding: "0.75rem" }}
            >
              {executing ? (
                <>
                  <span className="spinner" /> Executing...
                </>
              ) : (
                "⚡ Execute Recovery Plan"
              )}
            </button>

            {/* Execution Result */}
            {executionResult && (
              <div className="execution-box">
                <strong>✅ Execution Confirmed</strong>
                <br />
                <span>{String((executionResult as Record<string, unknown>).message)}</span>
                {(executionResult as Record<string, unknown>).booking_ref ? (
                  <div style={{ marginTop: "0.3rem", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Ref: {String((executionResult as Record<string, unknown>).booking_ref)}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
