"use client";

/**
 * VisualizationPage — Route Visualization with Map
 * ==================================================
 * Shows after form submission:
 * - Full-screen interactive map with route lines
 * - Disrupted node highlighted (red pulse)
 * - Alternative route overlay (blue dashed)
 * - Animated ship/plane icon at current position
 * - Side panel with route summary + disruption details
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
} from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

import type { LocationNode, RouteSubmission } from "./page";
import { LOCATIONS } from "./page";

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
    const { origin, destination, stops, currentPosition, disruption } = data;

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
        if (disIdx <= 0 || disIdx >= routeNodes.length - 1) return null; // can't bypass origin/dest

        const usedIds = new Set(routeNodes.map((n) => n.id));
        const candidates = LOCATIONS.filter((l) => !l.id || (!usedIds.has(l.id) && !routeNodes.some(rn => rn.id === l.id)));

        // Find nearest non-disrupted alternative
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

    return (
        <div className="viz">
            {/* Back button */}
            <button className="viz-back" onClick={onBack}>
                <ArrowLeft size={18} /> Back
            </button>

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
                            <div className="viz-details__row"><span>Status</span><span className={disruption ? "viz-details__val--red" : "viz-details__val--green"}>{disruption ? "Disrupted" : "On Track"}</span></div>
                            {currentPosition && <div className="viz-details__row"><span>Current</span><span>{currentPosition.name}</span></div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
