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

    // Determine transport mode from majority of segment modes (cost-optimal = sea)
    const mode: "sea" | "air" = useMemo(() => {
        if (segmentModes.length > 0) {
            const seaCount = segmentModes.filter((m) => m === "sea").length;
            return seaCount >= segmentModes.length / 2 ? "sea" : "air";
        }
        // Fallback: if most nodes are ports, it's sea
        const portCount = routeNodes.filter((n) => n.type === "port").length;
        return portCount >= routeNodes.length / 2 ? "sea" : "air";
    }, [routeNodes, segmentModes]);

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
                const aa = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
                return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
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

    // Detail panel state
    const [panelOpen, setPanelOpen] = useState(true);

    // ── Agent Pipeline State ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [agentResult, setAgentResult] = useState<any>(null);
    const [agentLoading, setAgentLoading] = useState(false);
    const [agentError, setAgentError] = useState<string | null>(null);
    const [executionResult, setExecutionResult] = useState<string | null>(null);

    // ── Disrupted Port Selection ──
    // In simulation mode, let the user pick which port gets the disruption
    const [disruptedPortIdx, setDisruptedPortIdx] = useState<number>(-1);

    // Auto-select a middle port once route nodes are available (simulation + disruption present)
    useEffect(() => {
        if (disruption && operatingMode === "simulation" && routeNodes.length > 2 && disruptedPortIdx === -1) {
            // Default: pick the first intermediate stop (index 1)
            setDisruptedPortIdx(1);
        }
    }, [routeNodes, disruption, operatingMode, disruptedPortIdx]);

    // Call agent pipeline AFTER routes are loaded (so we have real route nodes)
    useEffect(() => {
        if (routesLoading || routeNodes.length < 2) return;

        const runPipeline = async () => {
            setAgentLoading(true);
            setAgentError(null);
            try {
                // Build stops from the actual planned route nodes (skip origin = index 0)
                const intermediateNodes = routeNodes.slice(1); // includes destination
                const agentStops = intermediateNodes.map((node, i) => {
                    const isDisrupted = disruption && operatingMode === "simulation" && (i + 1) === disruptedPortIdx;
                    return {
                        stop_name: node.name,
                        eta_days: 2.0,
                        delay_days: isDisrupted ? 3.0 : 0.0,
                    };
                });

                const payload = {
                    product_id: "P1",
                    origin: routeNodes[0].name,
                    destination: routeNodes[routeNodes.length - 1].name,
                    stops: agentStops,
                    mode: operatingMode,
                    disruption_type: disruption?.type || "",
                    disruption_description: disruption?.description || "",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routesLoading, routeNodes, disruptedPortIdx]);

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

                        return (
                            <React.Fragment key={`seg-${i}`}>
                                <Polyline
                                    positions={pts}
                                    pathOptions={{ color: baseColor, weight: 4, opacity: 0.8, dashArray: dash }}
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

                    {/* ── Disruption Port Selector (Simulation only) ── */}
                    {operatingMode === "simulation" && disruption && routeNodes.length > 2 && (
                        <div className="viz-section">
                            <h4 className="viz-section__title"><AlertTriangle size={14} /> Disrupted Port</h4>
                            <div className="viz-alert viz-alert--red" style={{ padding: "10px 12px" }}>
                                <div className="viz-alert__title" style={{ marginBottom: 6 }}>
                                    {disruption.type}: {disruption.description || "No description"}
                                </div>
                                <label style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                                    Apply disruption to:
                                </label>
                                <select
                                    value={disruptedPortIdx}
                                    onChange={(e) => {
                                        setDisruptedPortIdx(Number(e.target.value));
                                        setAgentResult(null);
                                    }}
                                    style={{
                                        width: "100%",
                                        padding: "6px 8px",
                                        borderRadius: 6,
                                        border: "1px solid rgba(255,255,255,0.15)",
                                        background: "rgba(0,0,0,0.3)",
                                        color: "#e2e8f0",
                                        fontSize: "0.8rem",
                                    }}
                                >
                                    <option value={-1}>No disruption</option>
                                    {routeNodes.slice(1, -1).map((node, i) => (
                                        <option key={node.id} value={i + 1}>
                                            {node.name} (Stop {i + 1})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

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

                    {/* ── Blueprint Route Viewer ── */}
                    <div className="viz-blueprint-section">
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
            </div>
        </div>
    );
}
