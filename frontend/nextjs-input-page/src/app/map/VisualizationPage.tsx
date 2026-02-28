"use client";

/**
 * VisualizationPage — Route Visualization with Map + Agent Pipeline
 * ==================================================================
 * Shows after form submission:
 * - Full-screen interactive map with route lines
 * - Disrupted node highlighted (red pulse)
 * - Alternative route overlay (blue dashed)
 * - Animated ship/plane icon at current position
 * - Side panel with route summary + disruption details
 * - Agent pipeline results (monitoring, risk, planner, decision)
 *
 * Modes:
 *   🌐 Live (realtime): Tavily web search for disruptions
 *   🔬 Simulation: Manual disruption injection
 */

import React, { useMemo, useState, useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
    ArrowLeft,
    Anchor,
    Plane,
    AlertTriangle,
    Ship,
    Route,
    Info,
    Navigation,
    Zap,
    GitBranch,
    Clock,
    MapPin,
    ChevronRight,
    Globe,
    FlaskConical,
    Loader2,
    Shield,
    TrendingDown,
    DollarSign,
    CheckCircle2,
    Brain,
} from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

import type { LocationNode, RouteSubmission, OperatingMode } from "./page";
import { LOCATIONS } from "./page";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Props ──
interface Props {
    data: RouteSubmission;
    onBack: () => void;
}

// ── Helpers ──
function curvedPath(start: [number, number], end: [number, number], n = 40): [number, number][] {
    const pts: [number, number][] = [];
    const dist = Math.sqrt((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2);
    const curve = Math.min(dist * 0.08, 5);
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const lat = start[0] + (end[0] - start[0]) * t;
        const lng = start[1] + (end[1] - start[1]) * t;
        const arc = Math.sin(t * Math.PI) * curve;
        pts.push([lat + arc, lng]);
    }
    return pts;
}

function createNodeIcon(type: string, isDisrupted: boolean, isCurrent: boolean): L.DivIcon {
    const iconSvg =
        type === "airport"
            ? renderToStaticMarkup(<Plane size={14} color="#fff" />)
            : renderToStaticMarkup(<Anchor size={14} color="#fff" />);

    const bg = isDisrupted ? "#dc2626" : isCurrent ? "#059669" : type === "airport" ? "#7c3aed" : "#2563eb";
    const pulse = isDisrupted ? "nd-pulse" : isCurrent ? "nd-current-pulse" : "";
    const badge = isDisrupted
        ? '<div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:#dc2626;border:2px solid #fff;"></div>'
        : "";

    return L.divIcon({
        className: "",
        html: `<div class="viz-node ${pulse}" style="background:${bg};">${iconSvg}${badge}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });
}

function createTransportIcon(mode: "sea" | "air"): L.DivIcon {
    const svg = mode === "air"
        ? renderToStaticMarkup(<Plane size={18} color="#fff" />)
        : renderToStaticMarkup(<Ship size={18} color="#fff" />);
    return L.divIcon({
        className: "",
        html: `<div class="viz-transport">${svg}</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
    });
}

// ── FitBounds ──
function FitBounds({ nodes }: { nodes: LocationNode[] }) {
    const map = useMap();
    useEffect(() => {
        if (nodes.length > 0) {
            const bounds = L.latLngBounds(nodes.map((n) => [n.lat, n.lng]));
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 6 });
        }
    }, [nodes, map]);
    return null;
}

// ── Main Component ──
export default function VisualizationPage({ data, onBack }: Props) {
    const { origin, destination, stops, currentPosition, disruption, mode: operatingMode } = data;

    // Full route in order
    const routeNodes: LocationNode[] = useMemo(() => {
        return [origin, ...stops, destination];
    }, [origin, stops, destination]);

    // Determine transport mode based on any airport in route
    const mode: "sea" | "air" = useMemo(() => {
        return routeNodes.some((n) => n.type === "airport") ? "air" : "sea";
    }, [routeNodes]);

    // Current position index (for calculating position on route)
    const currentIdx = useMemo(() => {
        if (!currentPosition) return 0;
        return routeNodes.findIndex((n) => n.id === currentPosition.id);
    }, [routeNodes, currentPosition]);

    // Compute alternative route (bypass disrupted node)
    const altRoute: LocationNode[] | null = useMemo(() => {
        if (!disruption) return null;
        const disIdx = routeNodes.findIndex((n) => n.id === disruption.node.id);
        if (disIdx <= 0 || disIdx >= routeNodes.length - 1) return null;

        const usedIds = new Set(routeNodes.map((n) => n.id));
        const candidates = LOCATIONS.filter((l) => !l.id || (!usedIds.has(l.id) && !routeNodes.some(rn => rn.id === l.id)));

        const disNode = disruption.node;
        const sorted = [...candidates].sort((a, b) => {
            const dA = Math.sqrt((disNode.lat - a.lat) ** 2 + (disNode.lng - a.lng) ** 2);
            const dB = Math.sqrt((disNode.lat - b.lat) ** 2 + (disNode.lng - b.lng) ** 2);
            return dA - dB;
        });

        if (sorted.length === 0) return null;
        const alt = [...routeNodes];
        alt[disIdx] = sorted[0];
        return alt;
    }, [routeNodes, disruption]);

    // Detail panel state
    const [panelOpen, setPanelOpen] = useState(true);

    // ── Agent Pipeline State ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [agentResult, setAgentResult] = useState<any>(null);
    const [agentLoading, setAgentLoading] = useState(false);
    const [agentError, setAgentError] = useState<string | null>(null);
    const [executionResult, setExecutionResult] = useState<string | null>(null);

    // Call agent pipeline on mount
    useEffect(() => {
        const runPipeline = async () => {
            setAgentLoading(true);
            setAgentError(null);
            try {
                const payload = {
                    product_id: "P1",
                    origin: origin.name,
                    destination: destination.name,
                    stops: stops.map((s) => ({
                        stop_name: s.name,
                        eta_days: 2.0,
                        delay_days: disruption && s.id === disruption.node.id ? 3.0 : 0.0,
                    })),
                    mode: operatingMode,
                };
                const res = await fetch(`${API_BASE}/run-agents`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error(`Backend error: ${res.status}`);
                const json = await res.json();
                setAgentResult(json.data);
            } catch (err) {
                setAgentError(err instanceof Error ? err.message : "Pipeline failed");
            } finally {
                setAgentLoading(false);
            }
        };
        runPipeline();
    }, [origin, destination, stops, disruption, operatingMode]);

    // Execute chosen plan
    const handleExecutePlan = async (optionName: string) => {
        try {
            const res = await fetch(`${API_BASE}/execute-plan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_id: "P1",
                    chosen_option: optionName,
                    details: "User confirmed execution",
                }),
            });
            const json = await res.json();
            setExecutionResult(json.execution?.message || "Plan executed successfully");
        } catch {
            setExecutionResult("Failed to execute plan");
        }
    };

    return (
        <div className="viz">
            {/* Back button */}
            <button className="viz-back" onClick={onBack}>
                <ArrowLeft size={18} /> Back
            </button>

            {/* Mode indicator */}
            <div className={`viz-mode-indicator ${operatingMode === "realtime" ? "viz-mode-indicator--live" : "viz-mode-indicator--sim"}`}>
                {operatingMode === "realtime" ? <Globe size={14} /> : <FlaskConical size={14} />}
                {operatingMode === "realtime" ? "Live Mode" : "Simulation Mode"}
            </div>

            {/* Map */}
            <div className="viz-map-wrap">
                <MapContainer
                    center={[20, 40]}
                    zoom={3}
                    style={{ width: "100%", height: "100%" }}
                    zoomControl={true}
                    attributionControl={true}
                    minZoom={2}
                    maxZoom={18}
                    worldCopyJump={true}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        maxZoom={19}
                    />
                    <FitBounds nodes={routeNodes} />

                    {/* Main route segments */}
                    {routeNodes.map((node, i) => {
                        if (i >= routeNodes.length - 1) return null;
                        const from = routeNodes[i];
                        const to = routeNodes[i + 1];
                        const isToDisrupted = disruption && to.id === disruption.node.id;
                        const isFromDisrupted = disruption && from.id === disruption.node.id;
                        const segDisrupt = isToDisrupted || isFromDisrupted;
                        const pts = curvedPath([from.lat, from.lng], [to.lat, to.lng]);
                        const past = currentIdx > i; // segment already traversed
                        const color = segDisrupt ? "#dc2626" : past ? "#059669" : "#2563eb";
                        const dash = segDisrupt ? "8 6" : undefined;

                        return (
                            <React.Fragment key={`seg-${i}`}>
                                <Polyline
                                    positions={pts}
                                    pathOptions={{ color, weight: 4, opacity: 0.8, dashArray: dash }}
                                />
                                <Polyline
                                    positions={pts}
                                    pathOptions={{ color, weight: 10, opacity: 0.12 }}
                                    interactive={false}
                                />
                            </React.Fragment>
                        );
                    })}

                    {/* Alternative route (if disruption exists) */}
                    {altRoute && altRoute.length > 1 && altRoute.map((node, i) => {
                        if (i >= altRoute.length - 1) return null;
                        const from = altRoute[i];
                        const to = altRoute[i + 1];
                        const pts = curvedPath([from.lat, from.lng], [to.lat, to.lng], 30);
                        return (
                            <React.Fragment key={`alt-${i}`}>
                                <Polyline
                                    positions={pts}
                                    pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.6, dashArray: "6 8" }}
                                />
                                <Polyline
                                    positions={pts}
                                    pathOptions={{ color: "rgba(59,130,246,0.1)", weight: 12, opacity: 0.3 }}
                                    interactive={false}
                                />
                            </React.Fragment>
                        );
                    })}

                    {/* Alt route substitute nodes (nodes not in original route) */}
                    {altRoute && altRoute.filter((n) => !routeNodes.some((rn) => rn.id === n.id)).map((node) => (
                        <Marker
                            key={`alt-node-${node.id}`}
                            position={[node.lat, node.lng]}
                            icon={L.divIcon({
                                className: "",
                                html: `<div class="viz-node viz-node--alt">${renderToStaticMarkup(<Anchor size={12} color="#fff" />)}</div>`,
                                iconSize: [26, 26],
                                iconAnchor: [13, 13],
                            })}
                        >
                            <Tooltip direction="top" offset={[0, -16]} opacity={0.95}>
                                {node.name} — Alternative
                            </Tooltip>
                        </Marker>
                    ))}

                    {/* Node markers */}
                    {routeNodes.map((node, i) => {
                        const isDisrupted = disruption ? node.id === disruption.node.id : false;
                        const isCurrent = currentPosition ? node.id === currentPosition.id : false;
                        const icon = createNodeIcon(node.type, isDisrupted, isCurrent);
                        const isFirst = i === 0;
                        const isLast = i === routeNodes.length - 1;
                        const label = isFirst ? "Origin" : isLast ? "Destination" : `Stop ${i}`;

                        return (
                            <Marker key={node.id} position={[node.lat, node.lng]} icon={icon}>
                                <Tooltip direction="top" offset={[0, -18]} opacity={0.95}>
                                    <strong>{node.name}</strong> — {label}
                                    {isDisrupted && ` · ⚠ ${disruption!.type}`}
                                    {isCurrent && ` · 📍 Current`}
                                </Tooltip>
                            </Marker>
                        );
                    })}

                    {/* Animated transport icon at current position */}
                    {currentPosition && (
                        <Marker
                            position={[currentPosition.lat, currentPosition.lng]}
                            icon={createTransportIcon(mode)}
                            zIndexOffset={1000}
                        >
                            <Tooltip direction="top" offset={[0, -22]} opacity={0.95} permanent>
                                {mode === "sea" ? "🚢" : "✈️"} Shipment Here
                            </Tooltip>
                        </Marker>
                    )}
                </MapContainer>

                {/* Legend */}
                <div className="viz-legend">
                    <div className="viz-legend__title">Legend</div>
                    <div className="viz-legend__row"><span className="viz-legend__dot" style={{ background: "#2563eb" }} /> Port</div>
                    <div className="viz-legend__row"><span className="viz-legend__dot" style={{ background: "#7c3aed" }} /> Airport</div>
                    <div className="viz-legend__row"><span className="viz-legend__dot" style={{ background: "#059669" }} /> Current Position</div>
                    <div className="viz-legend__row"><span className="viz-legend__dot" style={{ background: "#dc2626" }} /> Disrupted</div>
                    <div className="viz-legend__divider" />
                    <div className="viz-legend__row"><span className="viz-legend__line" style={{ background: "#059669" }} /> Completed</div>
                    <div className="viz-legend__row"><span className="viz-legend__line" style={{ background: "#2563eb" }} /> Remaining</div>
                    <div className="viz-legend__row"><span className="viz-legend__line" style={{ background: "#dc2626" }} /> Disrupted</div>
                    <div className="viz-legend__row"><span className="viz-legend__line" style={{ background: "#3b82f6", backgroundImage: "repeating-linear-gradient(90deg,#3b82f6 0,#3b82f6 4px,transparent 4px,transparent 8px)" }} /> Alt Route</div>
                </div>
            </div>

            {/* Side Panel */}
            <div className={`viz-panel ${panelOpen ? "viz-panel--open" : ""}`}>
                <button className="viz-panel__toggle" onClick={() => setPanelOpen(!panelOpen)}>
                    <ChevronRight size={16} className={panelOpen ? "viz-panel__toggle-icon--open" : ""} />
                </button>

                <div className="viz-panel__content">
                    <h3 className="viz-panel__title">
                        <Route size={16} /> Route Summary
                    </h3>

                    {/* Route chain */}
                    <div className="viz-chain">
                        {routeNodes.map((node, i) => {
                            const isDisrupted = disruption ? node.id === disruption.node.id : false;
                            const isCurrent = currentPosition ? node.id === currentPosition.id : false;
                            const isPast = currentIdx > i || (currentIdx === i && i < routeNodes.length - 1);
                            const isFirst = i === 0;
                            const isLast = i === routeNodes.length - 1;

                            return (
                                <React.Fragment key={node.id}>
                                    <div className={`viz-chain__node ${isDisrupted ? "viz-chain__node--bad" : ""} ${isCurrent ? "viz-chain__node--current" : ""} ${isPast ? "viz-chain__node--past" : ""}`}>
                                        <div className={`viz-chain__dot ${isDisrupted ? "viz-chain__dot--bad" : isCurrent ? "viz-chain__dot--current" : isFirst ? "viz-chain__dot--green" : isLast ? "viz-chain__dot--red" : "viz-chain__dot--blue"}`} />
                                        <div className="viz-chain__info">
                                            <span className="viz-chain__name">{node.name}</span>
                                            <span className="viz-chain__meta">
                                                {node.country} · {node.type === "airport" ? "Airport" : "Port"}
                                                {isCurrent && <span className="viz-chain__badge viz-chain__badge--green">Current</span>}
                                                {isDisrupted && <span className="viz-chain__badge viz-chain__badge--red">{disruption!.type}</span>}
                                                {isFirst && <span className="viz-chain__badge viz-chain__badge--gray">Origin</span>}
                                                {isLast && <span className="viz-chain__badge viz-chain__badge--gray">Dest</span>}
                                            </span>
                                        </div>
                                        {isCurrent && (
                                            <div className="viz-chain__transport">
                                                {mode === "sea" ? <Ship size={16} /> : <Plane size={16} />}
                                            </div>
                                        )}
                                    </div>
                                    {i < routeNodes.length - 1 && (
                                        <div className={`viz-chain__conn ${isDisrupted || (disruption && routeNodes[i + 1].id === disruption.node.id) ? "viz-chain__conn--bad" : isPast ? "viz-chain__conn--past" : ""}`} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Disruption info */}
                    {disruption && (
                        <div className="viz-section">
                            <h4 className="viz-section__title"><AlertTriangle size={14} /> Disruption Details</h4>
                            <div className="viz-alert viz-alert--red">
                                <div className="viz-alert__title">{disruption.type}</div>
                                <div className="viz-alert__detail">At: <strong>{disruption.node.name}</strong></div>
                                <div className="viz-alert__detail">{disruption.description}</div>
                            </div>
                        </div>
                    )}

                    {/* Alternative route */}
                    {altRoute && (
                        <div className="viz-section">
                            <h4 className="viz-section__title"><GitBranch size={14} /> Alternative Route</h4>
                            <div className="viz-alert viz-alert--blue">
                                <div className="viz-alert__title">Suggested Bypass</div>
                                <div className="viz-alert__route">
                                    {altRoute.map((n) => n.name).join(" → ")}
                                </div>
                            </div>
                            <div className="viz-alert viz-alert--green">
                                <div className="viz-alert__title"><Zap size={13} /> Recommendation</div>
                                <div className="viz-alert__detail">
                                    Reroute shipment via {altRoute.filter((n) => !routeNodes.some((rn) => rn.id === n.id)).map((n) => n.name).join(", ")} to bypass the disruption at {disruption?.node.name}.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Shipment details */}
                    <div className="viz-section">
                        <h4 className="viz-section__title"><Info size={14} /> Details</h4>
                        <div className="viz-details">
                            <div className="viz-details__row"><span>Transport</span><span>{mode === "sea" ? "Sea Freight" : "Air Freight"}</span></div>
                            <div className="viz-details__row"><span>Stops</span><span>{routeNodes.length} nodes</span></div>
                            <div className="viz-details__row"><span>Mode</span><span className={operatingMode === "realtime" ? "viz-details__val--blue" : "viz-details__val--amber"}>{operatingMode === "realtime" ? "🌐 Live" : "🔬 Simulation"}</span></div>
                            <div className="viz-details__row"><span>Status</span><span className={disruption ? "viz-details__val--red" : "viz-details__val--green"}>{disruption ? "Disrupted" : "On Track"}</span></div>
                            {currentPosition && <div className="viz-details__row"><span>Current</span><span>{currentPosition.name}</span></div>}
                        </div>
                    </div>

                    {/* ── Agent Pipeline Results ── */}
                    <div className="viz-section">
                        <h4 className="viz-section__title"><Brain size={14} /> AI Agent Pipeline</h4>

                        {agentLoading && (
                            <div className="viz-agent-loading">
                                <Loader2 size={20} className="viz-spinner" />
                                <span>Running 4-agent pipeline{operatingMode === "realtime" ? " (searching web...)" : ""}...</span>
                            </div>
                        )}

                        {agentError && (
                            <div className="viz-alert viz-alert--red">
                                <div className="viz-alert__title">Pipeline Error</div>
                                <div className="viz-alert__detail">{agentError}</div>
                            </div>
                        )}

                        {agentResult && (
                            <>
                                {/* Risk Assessment */}
                                {agentResult.risk && (
                                    <div className="viz-agent-card">
                                        <div className="viz-agent-card__header">
                                            <Shield size={14} />
                                            <span>Risk Assessment</span>
                                            <span className={`viz-risk-badge viz-risk-badge--${agentResult.risk.risk_level?.toLowerCase()}`}>
                                                {agentResult.risk.risk_level}
                                            </span>
                                        </div>
                                        <div className="viz-agent-stats">
                                            <div className="viz-agent-stat">
                                                <TrendingDown size={13} />
                                                <span>Stockout: {agentResult.risk.stockout_days}d</span>
                                            </div>
                                            <div className="viz-agent-stat">
                                                <Clock size={13} />
                                                <span>Arrival: {agentResult.risk.shipment_arrival_days}d</span>
                                            </div>
                                            <div className="viz-agent-stat">
                                                <DollarSign size={13} />
                                                <span>Loss: ${agentResult.risk.revenue_loss?.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        {agentResult.risk.llm_analysis && (
                                            <div className="viz-agent-analysis">{agentResult.risk.llm_analysis}</div>
                                        )}
                                    </div>
                                )}

                                {/* Recovery Scenarios */}
                                {agentResult.planner?.options && (
                                    <div className="viz-agent-card">
                                        <div className="viz-agent-card__header">
                                            <Navigation size={14} />
                                            <span>Recovery Options</span>
                                        </div>
                                        {agentResult.planner.options.map((opt: { option_name: string; cost: number; projected_loss: number; total_impact: number; timeline_days: number }, i: number) => {
                                            const isChosen = agentResult.decision?.chosen_option?.option_name === opt.option_name;
                                            return (
                                                <div key={i} className={`viz-scenario ${isChosen ? "viz-scenario--chosen" : ""}`}>
                                                    <div className="viz-scenario__name">
                                                        {isChosen && <CheckCircle2 size={13} />}
                                                        {opt.option_name}
                                                    </div>
                                                    <div className="viz-scenario__meta">
                                                        Cost: ${opt.cost?.toLocaleString()} · Loss: ${opt.projected_loss?.toLocaleString()} · {opt.timeline_days}d
                                                    </div>
                                                    {isChosen && (
                                                        <button
                                                            className="viz-execute-btn"
                                                            onClick={() => handleExecutePlan(opt.option_name)}
                                                            type="button"
                                                        >
                                                            <Zap size={13} /> Execute Plan
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* AI Decision Reasoning */}
                                {agentResult.decision?.reasoning && (
                                    <div className="viz-agent-card viz-agent-card--reasoning">
                                        <div className="viz-agent-card__header">
                                            <Brain size={14} />
                                            <span>AI Reasoning</span>
                                        </div>
                                        <div className="viz-agent-analysis">{agentResult.decision.reasoning}</div>
                                    </div>
                                )}

                                {/* Execution Result */}
                                {executionResult && (
                                    <div className="viz-alert viz-alert--green">
                                        <div className="viz-alert__title"><CheckCircle2 size={13} /> Plan Executed</div>
                                        <div className="viz-alert__detail">{executionResult}</div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
