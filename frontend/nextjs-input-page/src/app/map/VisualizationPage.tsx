"use client";

/**
 * VisualizationPage — Route Visualization with Map + Blueprint Graph
 * ====================================================================
 * Shows after form submission:
 * - Full-screen interactive map with optimized route lines
 * - Blueprint-style route graph (right panel) with expand to full-page
 * - Agent pipeline results (monitoring, risk, planner, decision)
 * - Multi-modal route visualization (sea/air segments)
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
    Navigation,
    Zap,
    Clock,
    MapPin,
    ChevronLeft,
    ChevronRight,
    Globe,
    FlaskConical,
    Loader2,
    Shield,
    TrendingDown,
    DollarSign,
    CheckCircle2,
    Brain,
    X,
    Maximize2,
    Radar,
} from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

import type { LocationNode, RouteSubmission, OperatingMode } from "./page";
import { LOCATIONS } from "./page";
import BlueprintRouteViewer, {
    RouteData,
    RouteNodeData,
    SegmentData,
    TransportNode
} from "./BlueprintRouteViewer";

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

    // ── Route Planning State ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [plannedRoutes, setPlannedRoutes] = useState<any[]>([]);
    const [routesLoading, setRoutesLoading] = useState(true);
    const [routesError, setRoutesError] = useState<string | null>(null);

    // ── Transport Nodes & Route Selection State ──
    const [availableNodes, setAvailableNodes] = useState<TransportNode[]>([]);
    const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);

    // Fetch available transport nodes on mount
    useEffect(() => {
        const fetchNodes = async () => {
            try {
                const res = await fetch(`${API_BASE}/transport-nodes`);
                if (res.ok) {
                    const json = await res.json();
                    // Transform to TransportNode format - API returns { nodes: [...] }
                    const nodes: TransportNode[] = (json.nodes || []).map((n: any) => ({
                        id: n.id,
                        name: n.name,
                        city: n.city,
                        state: n.state,
                        lat: n.lat,
                        lng: n.lng,
                        node_type: n.type as "port" | "airport",
                        subtype: n.subtype || "",
                        code: n.code || "",
                    }));
                    setAvailableNodes(nodes);
                    console.log("Loaded transport nodes:", nodes.length);
                }
            } catch (err) {
                console.warn("Failed to fetch transport nodes:", err);
            }
        };
        fetchNodes();
    }, []);

    // Fetch planned routes on mount
    useEffect(() => {
        const fetchRoutes = async () => {
            setRoutesLoading(true);
            setRoutesError(null);
            try {
                const payload = {
                    source_city: (data as any).sourceCity || origin.name,
                    destination_city: (data as any).destCity || destination.name,
                    intermediate_cities: (data as any).intermediateCities || stops.map((s: LocationNode) => s.name),
                    num_routes: 4,
                };
                const res = await fetch(`${API_BASE}/plan-routes`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error(`Route planning failed: ${res.status}`);
                const json = await res.json();
                setPlannedRoutes(json.routes || []);
            } catch (err) {
                setRoutesError(err instanceof Error ? err.message : "Route planning failed");
            } finally {
                setRoutesLoading(false);
            }
        };
        fetchRoutes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Build route nodes from selected route (or best route) for the map
    const routeNodes: LocationNode[] = useMemo(() => {
        // Use selected route if available, otherwise use best route
        const routeToUse = selectedRoute || (plannedRoutes.length > 0 ? plannedRoutes[0] : null);

        if (routeToUse && routeToUse.segments?.length > 0) {
            const nodes: LocationNode[] = [];
            nodes.push({
                id: routeToUse.segments[0].from.node_id,
                name: routeToUse.segments[0].from.name,
                country: "India",
                type: routeToUse.segments[0].from.node_type === "airport" ? "airport" : "port",
                lat: routeToUse.segments[0].from.lat,
                lng: routeToUse.segments[0].from.lng,
            });
            for (const seg of routeToUse.segments) {
                nodes.push({
                    id: seg.to.node_id,
                    name: seg.to.name,
                    country: "India",
                    type: seg.to.node_type === "airport" ? "airport" : "port",
                    lat: seg.to.lat,
                    lng: seg.to.lng,
                });
            }
            return nodes.length > 0 ? nodes : [origin, ...stops, destination];
        }
        return [origin, ...stops, destination];
    }, [plannedRoutes, selectedRoute, origin, stops, destination]);

    // Segment transport modes from selected/best route
    const segmentModes: string[] = useMemo(() => {
        const routeToUse = selectedRoute || (plannedRoutes.length > 0 ? plannedRoutes[0] : null);
        if (routeToUse && routeToUse.segments) {
            return routeToUse.segments.map((s: any) => s.transport_mode);
        }
        return [];
    }, [plannedRoutes, selectedRoute]);

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

    // ── Route Selection & Custom Route Handlers ──
    const handleRouteSelect = (route: RouteData) => {
        setSelectedRoute(route);
    };

    const handleCustomRouteRequest = async (
        fromNode: RouteNodeData,
        selectedStop: TransportNode,
        toNode: RouteNodeData
    ) => {
        // INSERT the selected stop between fromNode and toNode in the first (best) route
        // This modifies the existing route rather than creating a new one
        try {
            setRoutesLoading(true);

            // Find the first route (best route) and the segment to split
            const bestRoute = plannedRoutes[0];
            if (!bestRoute || !bestRoute.segments) {
                throw new Error("No route available to modify");
            }

            // Find the index of the segment that goes from fromNode to toNode
            const segmentIndex = bestRoute.segments.findIndex(
                (seg: SegmentData) =>
                    seg.from.node_id === fromNode.node_id &&
                    seg.to.node_id === toNode.node_id
            );

            if (segmentIndex === -1) {
                throw new Error("Could not find segment to split");
            }

            const originalSegment = bestRoute.segments[segmentIndex];

            // Create the new intermediate node data
            const newNode: RouteNodeData = {
                node_id: selectedStop.id,
                name: selectedStop.name,
                city: selectedStop.city,
                state: selectedStop.state,
                lat: selectedStop.lat,
                lng: selectedStop.lng,
                node_type: selectedStop.node_type,
                subtype: selectedStop.subtype,
                code: selectedStop.code,
            };

            // Calculate distances for proportional cost/time split
            const calcDistance = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
                const R = 6371; // km
                const dLat = (b.lat - a.lat) * Math.PI / 180;
                const dLng = (b.lng - a.lng) * Math.PI / 180;
                const lat1 = a.lat * Math.PI / 180;
                const lat2 = b.lat * Math.PI / 180;
                const aa = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
                return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
            };

            const dist1 = calcDistance(fromNode, newNode);
            const dist2 = calcDistance(newNode, toNode);
            const totalNewDist = dist1 + dist2;
            const ratio1 = totalNewDist > 0 ? dist1 / totalNewDist : 0.5;
            const ratio2 = 1 - ratio1;

            // Create two new segments that replace the original
            const segment1: SegmentData = {
                from: originalSegment.from,
                to: newNode,
                transport_mode: originalSegment.transport_mode,
                distance_km: dist1,
                cost_usd: originalSegment.cost_usd * ratio1,
                time_hours: originalSegment.time_hours * ratio1,
                cumulative_cost: segmentIndex === 0
                    ? originalSegment.cost_usd * ratio1
                    : bestRoute.segments[segmentIndex - 1].cumulative_cost + originalSegment.cost_usd * ratio1,
                cumulative_time_hours: segmentIndex === 0
                    ? originalSegment.time_hours * ratio1
                    : bestRoute.segments[segmentIndex - 1].cumulative_time_hours + originalSegment.time_hours * ratio1,
            };

            const segment2: SegmentData = {
                from: newNode,
                to: originalSegment.to,
                transport_mode: originalSegment.transport_mode,
                distance_km: dist2,
                cost_usd: originalSegment.cost_usd * ratio2,
                time_hours: originalSegment.time_hours * ratio2,
                cumulative_cost: segment1.cumulative_cost + originalSegment.cost_usd * ratio2,
                cumulative_time_hours: segment1.cumulative_time_hours + originalSegment.time_hours * ratio2,
            };

            // Build the new segments array with the insertion
            const newSegments: SegmentData[] = [
                ...bestRoute.segments.slice(0, segmentIndex),
                segment1,
                segment2,
                ...bestRoute.segments.slice(segmentIndex + 1).map((seg: SegmentData, i: number) => ({
                    ...seg,
                    // Adjust cumulative values for segments after insertion
                    cumulative_cost: segment2.cumulative_cost + (
                        i === 0 ? seg.cost_usd : bestRoute.segments[segmentIndex + 1 + i - 1].cost_usd + seg.cost_usd
                    ),
                    cumulative_time_hours: segment2.cumulative_time_hours + (
                        i === 0 ? seg.time_hours : bestRoute.segments[segmentIndex + 1 + i - 1].time_hours + seg.time_hours
                    ),
                })),
            ];

            // Recalculate cumulative values for all segments after insertion
            let cumulativeCost = 0;
            let cumulativeTime = 0;
            for (const seg of newSegments) {
                cumulativeCost += seg.cost_usd;
                cumulativeTime += seg.time_hours;
                seg.cumulative_cost = cumulativeCost;
                seg.cumulative_time_hours = cumulativeTime;
            }

            // Create updated route with new segments
            const updatedRoute = {
                ...bestRoute,
                segments: newSegments,
                node_count: newSegments.length + 1,
                total_distance_km: newSegments.reduce((sum: number, s: SegmentData) => sum + s.distance_km, 0),
                total_cost: cumulativeCost,
                total_time_hours: cumulativeTime,
                label: `${bestRoute.label} +${selectedStop.city}`,
            };

            // Update the routes state - replace the first route with modified version
            setPlannedRoutes((prev) => [updatedRoute, ...prev.slice(1)]);
            setSelectedRoute(updatedRoute);

            console.log(`[Route] Inserted ${selectedStop.city} between ${fromNode.city} and ${toNode.city}`);

        } catch (err) {
            console.error("Failed to insert stop into route:", err);
            setRoutesError(err instanceof Error ? err.message : "Failed to insert stop");
        } finally {
            setRoutesLoading(false);
        }
    };

    // ── Dashboard State ──
    const [dashboardOpen, setDashboardOpen] = useState(false);
    const [blueprintExpanded, setBlueprintExpanded] = useState(false);
    const [highlightedRoute, setHighlightedRoute] = useState<"main" | "alt" | null>(null);

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
                    // Product info for agent decision-making
                    is_fragile: (data as any).productInfo?.isFragile || false,
                    has_expiry: (data as any).productInfo?.hasExpiry || false,
                    expiry_days: (data as any).productInfo?.expiryDays || 0,
                    quantity: (data as any).productInfo?.quantity || 0,
                    daily_demand: (data as any).productInfo?.dailyDemand || 0,
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
                        const past = currentIdx > i;
                        const segMode = segmentModes[i] || "sea";
                        const baseColor = segDisrupt ? "#dc2626" : past ? "#059669" : segMode === "air" ? "#7c3aed" : "#2563eb";
                        const dash = segDisrupt ? "8 6" : segMode === "air" ? "8 4" : undefined;
                        const isHighlighted = highlightedRoute === "main";
                        const isDimmed = highlightedRoute === "alt";
                        const weight = isHighlighted ? 6 : isDimmed ? 2 : 4;
                        const opacity = isDimmed ? 0.25 : 0.8;

                        return (
                            <React.Fragment key={`seg-${i}`}>
                                <Polyline
                                    positions={pts}
                                    pathOptions={{ color: baseColor, weight, opacity, dashArray: dash }}
                                    eventHandlers={{ click: () => setHighlightedRoute(highlightedRoute === "main" ? null : "main") }}
                                />
                                <Polyline
                                    positions={pts}
                                    pathOptions={{ color: baseColor, weight: 10, opacity: 0.12 }}
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
                        const isHighlighted = highlightedRoute === "alt";
                        const isDimmed = highlightedRoute === "main";
                        return (
                            <React.Fragment key={`alt-${i}`}>
                                <Polyline
                                    positions={pts}
                                    pathOptions={{ color: "#3b82f6", weight: isHighlighted ? 5 : isDimmed ? 1.5 : 3, opacity: isDimmed ? 0.15 : 0.6, dashArray: "6 8" }}
                                    eventHandlers={{ click: () => setHighlightedRoute(highlightedRoute === "alt" ? null : "alt") }}
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

            {/* ── Dashboard Toggle Button ── */}
            {!dashboardOpen && (
                <button
                    className="dash-toggle"
                    onClick={() => setDashboardOpen(true)}
                    type="button"
                >
                    <span className="dash-toggle__icon"><ChevronLeft size={16} /></span>
                    Dashboard
                </button>
            )}

            {/* ── Sliding Dashboard Panel (right side) ── */}
            <div className={`dash-panel ${dashboardOpen ? "dash-panel--open" : ""}`}>
                {/* Dashboard Header */}
                <div className="dash-header">
                    <div className="dash-header__left">
                        <Shield size={20} color="var(--accent)" />
                        <div>
                            <div className="dash-header__title">Disruption Shield Dashboard</div>
                            <div className="dash-header__subtitle">
                                {routeNodes[0]?.name} → {routeNodes[routeNodes.length - 1]?.name} · {routeNodes.length} nodes
                            </div>
                        </div>
                    </div>
                    <button className="dash-header__close" onClick={() => setDashboardOpen(false)} type="button">
                        <ChevronRight size={14} /> Close
                    </button>
                </div>

                <div className="dash-content">

                    {/* ── 4 Agent Result Cards ── */}
                    <div className="dash-agents">
                        {/* 1. Monitoring Agent */}
                        <div className={`dash-agent-card dash-agent-card--monitoring ${agentLoading ? "dash-agent-card--loading" : ""}`}>
                            <div className="dash-agent-card__header">
                                <div className="dash-agent-card__icon"><Radar size={16} /></div>
                                <div>
                                    <div className="dash-agent-card__title">Agent 1</div>
                                    <div className="dash-agent-card__subtitle">Monitoring</div>
                                </div>
                            </div>
                            <div className="dash-agent-card__body">
                                {agentLoading ? (
                                    <Loader2 size={20} className="viz-spinner" />
                                ) : agentResult?.monitoring ? (
                                    <>
                                        <div className="dash-agent-card__kpi">
                                            {agentResult.monitoring.total_transit_days?.toFixed(1)}d transit
                                        </div>
                                        <div className="dash-agent-card__badge dash-agent-card__badge--info">
                                            ETA: {agentResult.monitoring.total_eta}d · Delay: {agentResult.monitoring.total_delay}d
                                        </div>
                                        <div className="dash-agent-card__detail">
                                            {agentResult.monitoring.llm_analysis || agentResult.monitoring.disruption_summary || "Route monitoring complete."}
                                        </div>
                                    </>
                                ) : (
                                    <div className="dash-agent-card__detail">Awaiting pipeline results...</div>
                                )}
                            </div>
                        </div>

                        {/* 2. Risk Agent */}
                        <div className={`dash-agent-card dash-agent-card--risk ${agentLoading ? "dash-agent-card--loading" : ""}`}>
                            <div className="dash-agent-card__header">
                                <div className="dash-agent-card__icon"><Shield size={16} /></div>
                                <div>
                                    <div className="dash-agent-card__title">Agent 2</div>
                                    <div className="dash-agent-card__subtitle">Risk Assessment</div>
                                </div>
                            </div>
                            <div className="dash-agent-card__body">
                                {agentLoading ? (
                                    <Loader2 size={20} className="viz-spinner" />
                                ) : agentResult?.risk ? (
                                    <>
                                        <div className="dash-agent-card__kpi">
                                            ${agentResult.risk.revenue_loss?.toLocaleString() || "0"}
                                        </div>
                                        <div className={`dash-agent-card__badge dash-agent-card__badge--${agentResult.risk.risk_level?.toLowerCase() || "low"}`}>
                                            {agentResult.risk.risk_level || "N/A"}
                                        </div>
                                        <div className="dash-agent-card__detail">
                                            Stockout: {agentResult.risk.stockout_days}d · Arrival: {agentResult.risk.shipment_arrival_days}d
                                            {agentResult.risk.llm_analysis && <><br />{agentResult.risk.llm_analysis}</>}
                                        </div>
                                    </>
                                ) : (
                                    <div className="dash-agent-card__detail">Awaiting pipeline results...</div>
                                )}
                            </div>
                        </div>

                        {/* 3. Planner Agent */}
                        <div className={`dash-agent-card dash-agent-card--planner ${agentLoading ? "dash-agent-card--loading" : ""}`}>
                            <div className="dash-agent-card__header">
                                <div className="dash-agent-card__icon"><Navigation size={16} /></div>
                                <div>
                                    <div className="dash-agent-card__title">Agent 3</div>
                                    <div className="dash-agent-card__subtitle">Recovery Planner</div>
                                </div>
                            </div>
                            <div className="dash-agent-card__body">
                                {agentLoading ? (
                                    <Loader2 size={20} className="viz-spinner" />
                                ) : agentResult?.planner?.options ? (
                                    <>
                                        <div className="dash-agent-card__kpi">
                                            {agentResult.planner.options.length} options
                                        </div>
                                        {agentResult.planner.options.slice(0, 2).map((opt: { option_name: string; total_impact: number; timeline_days: number }, i: number) => (
                                            <div key={i} className="dash-agent-card__badge dash-agent-card__badge--info">
                                                {opt.option_name}: ${opt.total_impact?.toLocaleString()}
                                            </div>
                                        ))}
                                        <div className="dash-agent-card__detail">
                                            {agentResult.planner.llm_analysis || "Recovery scenarios generated."}
                                        </div>
                                    </>
                                ) : (
                                    <div className="dash-agent-card__detail">Awaiting pipeline results...</div>
                                )}
                            </div>
                        </div>

                        {/* 4. Decision Agent */}
                        <div className={`dash-agent-card dash-agent-card--decision ${agentLoading ? "dash-agent-card--loading" : ""}`}>
                            <div className="dash-agent-card__header">
                                <div className="dash-agent-card__icon"><Brain size={16} /></div>
                                <div>
                                    <div className="dash-agent-card__title">Agent 4</div>
                                    <div className="dash-agent-card__subtitle">Decision</div>
                                </div>
                            </div>
                            <div className="dash-agent-card__body">
                                {agentLoading ? (
                                    <Loader2 size={20} className="viz-spinner" />
                                ) : agentResult?.decision ? (
                                    <>
                                        <div className="dash-agent-card__kpi">
                                            {agentResult.decision.chosen_option?.option_name || "Pending"}
                                        </div>
                                        <div className="dash-agent-card__badge dash-agent-card__badge--success">
                                            <CheckCircle2 size={10} />
                                            ${agentResult.decision.chosen_option?.total_impact?.toLocaleString() || "—"} impact
                                        </div>
                                        <div className="dash-agent-card__detail">
                                            {agentResult.decision.reasoning || "Decision analysis complete."}
                                        </div>
                                        {executionResult ? (
                                            <div className="dash-agent-card__badge dash-agent-card__badge--success">
                                                <CheckCircle2 size={10} /> Executed
                                            </div>
                                        ) : (
                                            <button
                                                className="dash-blueprint-expand"
                                                onClick={() => handleExecutePlan(agentResult.decision.chosen_option?.option_name)}
                                                type="button"
                                                style={{ marginTop: 4 }}
                                            >
                                                <Zap size={12} /> Execute Plan
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="dash-agent-card__detail">Awaiting pipeline results...</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Blueprint Route Viewer Section ── */}
                    <div className="dash-blueprint-section">
                        <div className="dash-blueprint-header">
                            <div className="dash-blueprint-title">
                                <Route size={16} /> Route Blueprint
                            </div>
                            <button
                                className="dash-blueprint-expand"
                                onClick={() => setBlueprintExpanded(true)}
                                type="button"
                            >
                                <Maximize2 size={13} /> Expand
                            </button>
                        </div>
                        <div className="dash-blueprint-content">
                            <BlueprintRouteViewer
                                routes={plannedRoutes}
                                loading={routesLoading}
                                availableNodes={availableNodes}
                                onRouteSelect={handleRouteSelect}
                                onCustomRouteRequest={handleCustomRouteRequest}
                            />
                            {routesError && (
                                <div className="viz-alert viz-alert--red" style={{ marginTop: 10 }}>
                                    <div className="viz-alert__title">Route Planning Error</div>
                                    <div className="viz-alert__detail">{routesError}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {agentError && (
                        <div className="viz-alert viz-alert--red">
                            <div className="viz-alert__title">Pipeline Error</div>
                            <div className="viz-alert__detail">{agentError}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Blueprint Expanded Overlay ── */}
            {blueprintExpanded && (
                <div className="dash-blueprint-overlay">
                    <div className="dash-blueprint-overlay__header">
                        <div className="dash-blueprint-overlay__title">
                            <Route size={18} /> Route Blueprint — Expanded View
                        </div>
                        <button
                            className="dash-blueprint-overlay__close"
                            onClick={() => setBlueprintExpanded(false)}
                            type="button"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div className="dash-blueprint-overlay__content">
                        <BlueprintRouteViewer
                            routes={plannedRoutes}
                            loading={routesLoading}
                            availableNodes={availableNodes}
                            onRouteSelect={handleRouteSelect}
                            onCustomRouteRequest={handleCustomRouteRequest}
                        />
                        {routesError && (
                            <div className="viz-alert viz-alert--red" style={{ marginTop: 10 }}>
                                <div className="viz-alert__title">Route Planning Error</div>
                                <div className="viz-alert__detail">{routesError}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
