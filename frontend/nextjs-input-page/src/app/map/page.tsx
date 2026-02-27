"use client";

/**
 * Agentic Disruption Shield — Map Page
 * ======================================
 * Interactive supply chain map with:
 * - Search-based node placement (ports/airports/hubs)
 * - Multi-node route visualization
 * - Disruption simulation at any node
 * - Alternative route computation
 * - Backend integration via /locations and /run-agents
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import "./map.css";

// Prevent SSR hydration issues with Leaflet
const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f0', color: '#64748b', fontSize: '0.9rem' }}>Loading map...</div> });

import {
    Shield,
    Search,
    X,
    Ship,
    Plane,
    Warehouse,
    AlertTriangle,
    Route,
    Anchor,
    MapPin,
    ChevronRight,
    Lightbulb,
    Navigation,
    Info,
    Zap,
    Clock,
    Package,
    Weight,
    ArrowRight,
    GitBranch,
    Radio,
    Activity,
    Play,
    Loader2,
    Trash2,
    Plus,
    Brain,
    BarChart3,
    CheckCircle2,
    XCircle,
    DollarSign,
    TrendingUp,
    Target,
    Layers,
} from "lucide-react";

// ── Types ──
interface LocationNode {
    id: string;
    name: string;
    country: string;
    type: "port" | "airport" | "hub";
    lat: number;
    lng: number;
    disruption: DisruptionData | null;
    weather?: { risk: string; detail: string; condition: string };
    disruptionInfo?: { active: boolean; type: string; detail: string; severity: string; extra_delay_days: number };
}

interface DisruptionData {
    type: string;
    severity: string;
    delayHours: number;
    description: string;
}

interface Shipment {
    id: string;
    carrier: string;
    cargo: string;
    weight: string;
    eta: string;
    departed: string;
    mode: "sea" | "air";
    routeNodes: string[];
}

// ── Constants ──
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AgentResults {
    monitoring: any;
    risk: any;
    planner: any;
    decision: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const INITIAL_NODES: LocationNode[] = [
    { id: "N1", name: "Shanghai", country: "China", type: "port", lat: 31.2304, lng: 121.4737, disruption: null },
    { id: "N2", name: "Singapore", country: "Singapore", type: "port", lat: 1.2644, lng: 103.8222, disruption: null },
    { id: "N3", name: "Mumbai", country: "India", type: "port", lat: 18.9500, lng: 72.9500, disruption: null },
    { id: "N4", name: "Dubai", country: "UAE", type: "port", lat: 25.0143, lng: 55.0802, disruption: null },
    { id: "N5", name: "Rotterdam", country: "Netherlands", type: "port", lat: 51.9054, lng: 4.4666, disruption: null },
    { id: "N6", name: "Los Angeles", country: "USA", type: "port", lat: 33.7405, lng: -118.2723, disruption: null },
    { id: "N7", name: "Colombo", country: "Sri Lanka", type: "port", lat: 6.9497, lng: 79.8428, disruption: null },
    { id: "N8", name: "Tokyo", country: "Japan", type: "port", lat: 35.6762, lng: 139.6503, disruption: null },
    { id: "N9", name: "Hamburg", country: "Germany", type: "port", lat: 53.5511, lng: 9.9937, disruption: null },
    { id: "N10", name: "Sydney", country: "Australia", type: "port", lat: -33.8688, lng: 151.2093, disruption: null },
];

const INITIAL_SHIPMENTS: Shipment[] = [
    {
        id: "SHP-4821",
        carrier: "Maersk Line",
        cargo: "Electronics — 3 containers",
        weight: "12,400 kg",
        eta: "Mar 05, 2026",
        departed: "Feb 20, 2026",
        mode: "sea",
        routeNodes: ["N1", "N2", "N7", "N4", "N5"],
    },
    {
        id: "SHP-4835",
        carrier: "COSCO Shipping",
        cargo: "Auto Parts — 5 containers",
        weight: "24,000 kg",
        eta: "Mar 12, 2026",
        departed: "Feb 18, 2026",
        mode: "sea",
        routeNodes: ["N1", "N8", "N6"],
    },
    {
        id: "SHP-4847",
        carrier: "Emirates SkyCargo",
        cargo: "Medical Supplies — 150 cartons",
        weight: "900 kg",
        eta: "Feb 28, 2026",
        departed: "Feb 27, 2026",
        mode: "air",
        routeNodes: ["N4", "N3"],
    },
    {
        id: "SHP-4852",
        carrier: "Hapag-Lloyd",
        cargo: "Machinery Parts — 12 pallets",
        weight: "3,800 kg",
        eta: "Mar 01, 2026",
        departed: "Feb 25, 2026",
        mode: "sea",
        routeNodes: ["N9", "N5"],
    },
];



// ── Main Page Component ──
export default function MapPage() {
    const [nodes, setNodes] = useState<LocationNode[]>(INITIAL_NODES);
    const [shipments] = useState<Shipment[]>(INITIAL_SHIPMENTS);
    const [selectedShipment, setSelectedShipment] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState("all");
    const [showBanner, setShowBanner] = useState(true);
    const [mounted, setMounted] = useState(false);

    // Data mode: "simulation" or "realtime"
    const [dataMode, setDataMode] = useState<"simulation" | "realtime">("simulation");
    const [modeLoading, setModeLoading] = useState(false);

    // Route Builder state
    const [routeNodeIds, setRouteNodeIds] = useState<string[]>([]);
    const [isRouteMode, setIsRouteMode] = useState(false);
    const [productId, setProductId] = useState("P1");

    // Agent Pipeline state
    const [agentResults, setAgentResults] = useState<AgentResults | null>(null);
    const [agentLoading, setAgentLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [activeAgentTab, setActiveAgentTab] = useState<"monitoring" | "risk" | "planner" | "decision">("monitoring");

    // Sidebar tab: "shipments" or "route"
    const [sidebarTab, setSidebarTab] = useState<"shipments" | "route">("route");

    useEffect(() => { setMounted(true); }, []);

    // Search
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearchResults, setShowSearchResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Disruption modal
    const [disruptModal, setDisruptModal] = useState<{ nodeId: string } | null>(null);
    const [disruptForm, setDisruptForm] = useState({
        type: "Port Strike",
        severity: "medium",
        delayHours: 12,
        description: "",
    });

    // Fly-to trigger
    const [flyTo, setFlyTo] = useState<[number, number, number] | null>(null);

    // Fetch locations from backend (re-fetches when dataMode changes)
    useEffect(() => {
        setModeLoading(true);
        fetch(`${API_BASE}/locations?mode=${dataMode}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.locations?.length) {
                    const backendNodes: LocationNode[] = data.locations.map((loc: Record<string, unknown>, i: number) => ({
                        id: `N${i + 1}`,
                        name: loc.name as string,
                        country: loc.country as string,
                        type: (loc.type as string) || "port",
                        lat: (loc.lat as number) || INITIAL_NODES[i]?.lat || 0,
                        lng: (loc.lng as number) || INITIAL_NODES[i]?.lng || 0,
                        disruption: null,
                        weather: loc.weather as LocationNode["weather"],
                        disruptionInfo: loc.disruption as LocationNode["disruptionInfo"],
                    }));
                    setNodes(backendNodes);
                }
            })
            .catch(() => { /* fallback to INITIAL_NODES */ })
            .finally(() => setModeLoading(false));
    }, [dataMode]);

    // Click outside search closes dropdown
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // ── Computed status ──
    const getStatus = useCallback(
        (shipment: Shipment): "on-time" | "at-risk" | "disrupted" => {
            const routeNodeObjs = shipment.routeNodes
                .map((id) => nodes.find((n) => n.id === id))
                .filter(Boolean) as LocationNode[];
            const disrupted = routeNodeObjs.filter((n) => n.disruption);
            if (disrupted.some((n) => n.disruption?.severity === "high")) return "disrupted";
            if (disrupted.length > 0) return "at-risk";
            return "on-time";
        },
        [nodes]
    );

    const stats = useMemo(() => {
        const statuses = shipments.map(getStatus);
        return {
            total: shipments.length,
            ok: statuses.filter((s) => s === "on-time").length,
            warn: statuses.filter((s) => s === "at-risk").length,
            bad: statuses.filter((s) => s === "disrupted").length,
        };
    }, [shipments, getStatus]);

    const filteredShipments = useMemo(
        () => (activeFilter === "all" ? shipments : shipments.filter((s) => getStatus(s) === activeFilter)),
        [shipments, activeFilter, getStatus]
    );

    // ── Node already on map? ──
    const nodeOnMap = useCallback((name: string) => nodes.some((n) => n.name.toLowerCase() === name.toLowerCase()), [nodes]);

    // ── Search results ──
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return nodes;
        const q = searchQuery.toLowerCase();
        return nodes.filter((n) => n.name.toLowerCase().includes(q) || n.country.toLowerCase().includes(q));
    }, [searchQuery, nodes]);

    // ── Actions ──
    const handleSearchSelect = useCallback(
        (node: LocationNode) => {
            setShowSearchResults(false);
            setSearchQuery("");
            setFlyTo([node.lat, node.lng, 6]);
        },
        []
    );

    const selectShipment = useCallback(
        (id: string) => {
            setSelectedShipment(id);
            const s = shipments.find((sh) => sh.id === id);
            if (!s) return;
            const routeNodeObjs = s.routeNodes
                .map((nid) => nodes.find((n) => n.id === nid))
                .filter(Boolean) as LocationNode[];
            if (routeNodeObjs.length > 0) {
                const lats = routeNodeObjs.map((n) => n.lat);
                const lngs = routeNodeObjs.map((n) => n.lng);
                const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
                setFlyTo([centerLat, centerLng, 3]);
            }
        },
        [shipments, nodes]
    );

    const closeDetail = useCallback(() => setSelectedShipment(null), []);

    const handleNodeClick = useCallback(
        (nodeId: string) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (!node) return;

            // Route builder mode: add/remove node from route
            if (isRouteMode) {
                setRouteNodeIds((prev) => {
                    if (prev.includes(nodeId)) {
                        return prev.filter((id) => id !== nodeId);
                    }
                    return [...prev, nodeId];
                });
                return;
            }

            // Default: open disruption modal
            setDisruptModal({ nodeId });
            setDisruptForm({
                type: node.disruption ? node.disruption.type : "Port Strike",
                severity: node.disruption ? node.disruption.severity : "medium",
                delayHours: node.disruption ? node.disruption.delayHours : 12,
                description: node.disruption ? node.disruption.description : "",
            });
        },
        [nodes, isRouteMode]
    );

    const confirmDisruption = useCallback(() => {
        if (!disruptModal) return;
        setNodes((prev) =>
            prev.map((n) =>
                n.id === disruptModal.nodeId
                    ? {
                        ...n,
                        disruption: {
                            type: disruptForm.type,
                            severity: disruptForm.severity,
                            delayHours: disruptForm.delayHours,
                            description: disruptForm.description || `${disruptForm.type} at ${n.name}`,
                        },
                    }
                    : n
            )
        );
        setDisruptModal(null);
    }, [disruptModal, disruptForm]);

    const clearDisruption = useCallback(() => {
        if (!disruptModal) return;
        setNodes((prev) => prev.map((n) => (n.id === disruptModal.nodeId ? { ...n, disruption: null } : n)));
        setDisruptModal(null);
    }, [disruptModal]);

    // ── Route Builder helpers ──
    const routeNodes = useMemo(
        () => routeNodeIds.map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as LocationNode[],
        [routeNodeIds, nodes]
    );

    const addNodeToRoute = useCallback((nodeId: string) => {
        setRouteNodeIds((prev) => {
            if (prev.includes(nodeId)) return prev;
            return [...prev, nodeId];
        });
        // Fly to the newly added node
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
            setFlyTo([node.lat, node.lng, 5]);
        }
    }, [nodes]);

    const removeNodeFromRoute = useCallback((nodeId: string) => {
        setRouteNodeIds((prev) => prev.filter((id) => id !== nodeId));
    }, []);

    const clearRoute = useCallback(() => {
        setRouteNodeIds([]);
        setAgentResults(null);
        setShowResults(false);
    }, []);

    // ── Run Agent Pipeline ──
    const runAgentPipeline = useCallback(async () => {
        if (routeNodeIds.length < 2) return;

        const origin = nodes.find((n) => n.id === routeNodeIds[0])?.name || "";
        const destination = nodes.find((n) => n.id === routeNodeIds[routeNodeIds.length - 1])?.name || "";
        const intermediateStops = routeNodeIds.slice(1, -1).map((id, i) => {
            const node = nodes.find((n) => n.id === id);
            return {
                stop_name: node?.name || "",
                eta_days: 3 + i * 2, // estimated ETA per stop
                delay_days: 0,
            };
        });

        setAgentLoading(true);
        setShowResults(true);
        setActiveAgentTab("monitoring");

        try {
            const response = await fetch(`${API_BASE}/run-agents`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_id: productId,
                    origin,
                    destination,
                    stops: intermediateStops,
                    mode: dataMode,
                }),
            });

            if (!response.ok) {
                throw new Error(`Pipeline failed: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                setAgentResults(data.data);
            } else {
                throw new Error("Pipeline returned unsuccessful");
            }
        } catch (err) {
            console.error("Agent pipeline error:", err);
            setAgentResults(null);
        } finally {
            setAgentLoading(false);
        }
    }, [routeNodeIds, nodes, productId, dataMode]);

    // ── Alt route computation ──
    const computeAltRoute = useCallback(
        (shipment: Shipment): LocationNode[] | null => {
            const routeNodeObjs = shipment.routeNodes.map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as LocationNode[];
            if (routeNodeObjs.length < 2) return null;
            const hasDisruptedMiddle = routeNodeObjs.slice(1, -1).some((n) => n.disruption);
            if (!hasDisruptedMiddle) return null;

            const start = routeNodeObjs[0];
            const end = routeNodeObjs[routeNodeObjs.length - 1];
            const usedIds = new Set(shipment.routeNodes);
            const alt: LocationNode[] = [start];

            for (let i = 1; i < routeNodeObjs.length - 1; i++) {
                const node = routeNodeObjs[i];
                if (node.disruption) {
                    const candidates = nodes.filter((n) => !n.disruption && !usedIds.has(n.id) && n.id !== start.id && n.id !== end.id);
                    if (candidates.length > 0) {
                        candidates.sort((a, b) => {
                            const dA = Math.sqrt((node.lat - a.lat) ** 2 + (node.lng - a.lng) ** 2);
                            const dB = Math.sqrt((node.lat - b.lat) ** 2 + (node.lng - b.lng) ** 2);
                            return dA - dB;
                        });
                        alt.push(candidates[0]);
                        usedIds.add(candidates[0].id);
                    }
                } else {
                    alt.push(node);
                }
            }
            alt.push(end);
            return alt;
        },
        [nodes]
    );

    // ── Selected shipment data ──
    const selectedData = useMemo(() => {
        if (!selectedShipment) return null;
        const s = shipments.find((sh) => sh.id === selectedShipment);
        if (!s) return null;
        const routeNodeObjs = s.routeNodes.map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as LocationNode[];
        const disrupted = routeNodeObjs.filter((n) => n.disruption);
        const status = getStatus(s);
        const alt = computeAltRoute(s);
        return { shipment: s, routeNodes: routeNodeObjs, disrupted, status, alt };
    }, [selectedShipment, shipments, nodes, getStatus, computeAltRoute]);

    const typeIcon = (type: string) => {
        switch (type) {
            case "airport": return <Plane size={14} />;
            case "hub": return <Warehouse size={14} />;
            default: return <Anchor size={14} />;
        }
    };

    const disruptingNode = disruptModal ? nodes.find((n) => n.id === disruptModal.nodeId) : null;

    return (
        <div className="map-page">
            {/* Header */}
            <header className="mp-header">
                <div className="mp-header__brand">
                    <Shield className="mp-header__logo" />
                    <div>
                        <div className="mp-header__title">Disruption Shield</div>
                        <div className="mp-header__subtitle">Agentic Supply Chain Monitor</div>
                    </div>
                </div>
                <div className="mp-header__stats">
                    {/* Mode Toggle */}
                    <div className="mp-mode-toggle">
                        <span className="mp-mode-toggle__label">Data Source</span>
                        <div
                            className={`mp-mode-toggle__switch ${dataMode === "realtime" ? "mp-mode-toggle__switch--active" : ""}`}
                            onClick={() => setDataMode(dataMode === "simulation" ? "realtime" : "simulation")}
                            title={dataMode === "simulation" ? "Switch to Real-Time (Tavily)" : "Switch to Simulation"}
                        >
                            <div className="mp-mode-toggle__knob" />
                        </div>
                        {modeLoading ? (
                            <div className="mp-mode-loading">
                                <div className="mp-mode-loading__spinner" />
                                Loading...
                            </div>
                        ) : (
                            <span className={`mp-mode-toggle__status ${dataMode === "realtime" ? "mp-mode-toggle__status--live" : "mp-mode-toggle__status--sim"}`}>
                                {dataMode === "realtime" ? (
                                    <><Activity size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />Live</>
                                ) : (
                                    <><Radio size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />Sim</>
                                )}
                            </span>
                        )}
                    </div>
                    <div className="mp-stat">
                        <span className="mp-stat__val">{stats.total}</span>
                        <span className="mp-stat__label">Shipments</span>
                    </div>
                    <div className="mp-stat mp-stat--ok">
                        <span className="mp-stat__val">{stats.ok}</span>
                        <span className="mp-stat__label">On Time</span>
                    </div>
                    <div className="mp-stat mp-stat--warn">
                        <span className="mp-stat__val">{stats.warn}</span>
                        <span className="mp-stat__label">At Risk</span>
                    </div>
                    <div className="mp-stat mp-stat--bad">
                        <span className="mp-stat__val">{stats.bad}</span>
                        <span className="mp-stat__label">Disrupted</span>
                    </div>
                </div>
            </header>

            {/* How-to banner */}
            {showBanner && (
                <div className="mp-howto">
                    <div className="mp-howto__text">
                        <Lightbulb size={16} />
                        <span>
                            <strong>How to use:</strong> Select locations from the Route Builder sidebar. First location = Origin, last = Destination. Click &quot;Analyze Route&quot; to run the 4-agent pipeline.
                        </span>
                    </div>
                    <button className="mp-howto__close" onClick={() => setShowBanner(false)}>
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Body */}
            <div className="mp-body">
                {/* Sidebar */}
                <aside className="mp-sidebar">
                    {/* Sidebar Tabs */}
                    <div className="mp-sidebar-tabs">
                        <button
                            className={`mp-sidebar-tab ${sidebarTab === "route" ? "mp-sidebar-tab--active" : ""}`}
                            onClick={() => setSidebarTab("route")}
                        >
                            <Navigation size={14} /> Route Builder
                        </button>
                        <button
                            className={`mp-sidebar-tab ${sidebarTab === "shipments" ? "mp-sidebar-tab--active" : ""}`}
                            onClick={() => setSidebarTab("shipments")}
                        >
                            <Ship size={14} /> Shipments
                        </button>
                    </div>

                    {sidebarTab === "route" ? (
                        <>
                            {/* Route Builder */}
                            <div className="mp-route-builder">
                                <div className="mp-rb__header">
                                    <div className="mp-rb__title">
                                        <Route size={16} />
                                        Build Your Route
                                    </div>
                                    <div className="mp-rb__hint">
                                        Select locations below. First = Origin, Last = Destination.
                                    </div>
                                </div>

                                {/* Route Mode Toggle */}
                                <button
                                    className={`mp-rb__mode-btn ${isRouteMode ? "mp-rb__mode-btn--active" : ""}`}
                                    onClick={() => setIsRouteMode(!isRouteMode)}
                                >
                                    {isRouteMode ? (
                                        <><MapPin size={14} /> Click Map to Add Nodes (Active)</>
                                    ) : (
                                        <><Plus size={14} /> Enable Map Click Mode</>
                                    )}
                                </button>

                                {/* Product ID */}
                                <div className="mp-rb__product">
                                    <label className="mp-label">Product ID</label>
                                    <input
                                        className="mp-input"
                                        type="text"
                                        value={productId}
                                        onChange={(e) => setProductId(e.target.value)}
                                        placeholder="e.g. P1"
                                    />
                                </div>

                                {/* Quick Add from list */}
                                <div className="mp-rb__quick-add">
                                    <label className="mp-label">Available Locations</label>
                                    <div className="mp-rb__node-list">
                                        {nodes
                                            .filter((n) => !routeNodeIds.includes(n.id))
                                            .map((node) => (
                                                <button
                                                    key={node.id}
                                                    className="mp-rb__node-chip"
                                                    onClick={() => addNodeToRoute(node.id)}
                                                    title={`Add ${node.name} to route`}
                                                >
                                                    <Plus size={10} /> {node.name}
                                                    <span className="mp-rb__node-chip-country">{node.country}</span>
                                                </button>
                                            ))}
                                        {nodes.filter((n) => !routeNodeIds.includes(n.id)).length === 0 && (
                                            <div className="mp-rb__all-added">All locations added to route</div>
                                        )}
                                    </div>
                                </div>

                                {/* Route Chain */}
                                {routeNodes.length > 0 ? (
                                    <div className="mp-rb__chain">
                                        <div className="mp-rb__chain-header">
                                            <span>Your Route ({routeNodes.length} node{routeNodes.length !== 1 ? "s" : ""})</span>
                                            <button className="mp-rb__clear" onClick={clearRoute}>
                                                <Trash2 size={12} /> Clear
                                            </button>
                                        </div>
                                        <div className="mp-rb__chain-nodes">
                                            {routeNodes.map((node, i) => {
                                                const role = i === 0 ? "Origin" : i === routeNodes.length - 1 && routeNodes.length > 1 ? "Destination" : `Stop ${i}`;
                                                const roleClass = i === 0 ? "mp-rb__chain-label--origin" : i === routeNodes.length - 1 && routeNodes.length > 1 ? "mp-rb__chain-label--dest" : "";
                                                return (
                                                    <div key={node.id} className="mp-rb__chain-item">
                                                        <div className="mp-rb__chain-node">
                                                            <span className={`mp-rb__chain-label ${roleClass}`}>
                                                                {role}
                                                            </span>
                                                            <span className="mp-rb__chain-name">
                                                                {typeIcon(node.type)} {node.name}
                                                            </span>
                                                            <button
                                                                className="mp-rb__chain-remove"
                                                                onClick={() => removeNodeFromRoute(node.id)}
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                        {i < routeNodes.length - 1 && (
                                                            <div className="mp-rb__chain-arrow">
                                                                <ArrowRight size={14} />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mp-rb__empty">
                                        <MapPin size={24} className="mp-rb__empty-icon" />
                                        <div className="mp-rb__empty-text">No locations selected yet</div>
                                        <div className="mp-rb__empty-hint">Click locations above to build your supply chain route</div>
                                    </div>
                                )}

                                {/* Run Pipeline Button */}
                                <button
                                    className="mp-rb__run-btn"
                                    disabled={routeNodeIds.length < 2 || agentLoading}
                                    onClick={runAgentPipeline}
                                >
                                    {agentLoading ? (
                                        <><Loader2 size={16} className="mp-spin" /> Running 4-Agent Pipeline...</>
                                    ) : (
                                        <><Play size={16} /> Analyze Route ({dataMode === "realtime" ? "Live" : "Sim"})</>
                                    )}
                                </button>

                                {routeNodeIds.length < 2 && (
                                    <div className="mp-rb__min-hint">Select at least 2 locations to analyze</div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Original Shipments Tab */}
                            <div className="mp-sidebar__header">
                                <div className="mp-sidebar__title">
                                    <MapPin size={16} />
                                    Search Ports & Airports
                                </div>
                                <div className="mp-search" ref={searchRef}>
                                    <Search className="mp-search__icon" />
                                    <input
                                        className="mp-search__input"
                                        type="text"
                                        placeholder="Search by name or country..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setShowSearchResults(true);
                                        }}
                                        onFocus={() => setShowSearchResults(true)}
                                    />
                                    {showSearchResults && (
                                        <div className="mp-search__results">
                                            {searchResults.length === 0 ? (
                                                <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                                                    No locations found
                                                </div>
                                            ) : (
                                                searchResults.map((node) => (
                                                    <div
                                                        key={node.id}
                                                        className={`mp-search__item ${nodeOnMap(node.name) ? "" : ""}`}
                                                        onClick={() => handleSearchSelect(node)}
                                                    >
                                                        {typeIcon(node.type)}
                                                        <div>
                                                            <div className="mp-search__item-name">{node.name}</div>
                                                            <div className="mp-search__item-country">{node.country}</div>
                                                        </div>
                                                        {node.disruption && (
                                                            <AlertTriangle size={14} style={{ color: "var(--red)", marginLeft: "auto" }} />
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="mp-filters">
                                {(["all", "on-time", "at-risk", "disrupted"] as const).map((f) => (
                                    <button
                                        key={f}
                                        className={`mp-filter-btn ${activeFilter === f ? "mp-filter-btn--active" : ""}`}
                                        onClick={() => setActiveFilter(f)}
                                    >
                                        {f === "all" ? "All" : f === "on-time" ? "On Time" : f === "at-risk" ? "At Risk" : "Disrupted"}
                                    </button>
                                ))}
                            </div>

                            {/* Shipment Cards */}
                            <div className="mp-shipments">
                                {filteredShipments.map((s) => {
                                    const status = getStatus(s);
                                    const routeNodeObjs = s.routeNodes.map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as LocationNode[];
                                    const disrupted = routeNodeObjs.filter((n) => n.disruption);
                                    const statusClass = status === "on-time" ? "ok" : status === "at-risk" ? "warn" : "bad";

                                    return (
                                        <div
                                            key={s.id}
                                            className={`mp-card mp-card--${statusClass} ${selectedShipment === s.id ? "mp-card--selected" : ""}`}
                                            onClick={() => selectShipment(s.id)}
                                        >
                                            <div className="mp-card__top">
                                                <span className="mp-card__id">{s.id}</span>
                                                <span className={`mp-card__badge badge--${statusClass}`}>
                                                    {status === "on-time" ? "On Time" : status === "at-risk" ? "At Risk" : "Disrupted"}
                                                </span>
                                            </div>
                                            <div className="mp-card__route">
                                                <Route size={14} />
                                                <span>
                                                    {routeNodeObjs[0]?.name || "?"} <ArrowRight size={10} style={{ verticalAlign: "-1px" }} /> {routeNodeObjs[routeNodeObjs.length - 1]?.name || "?"}
                                                </span>
                                            </div>
                                            <div className="mp-card__meta">
                                                <span>{s.mode === "sea" ? <Ship size={12} /> : <Plane size={12} />} {s.carrier}</span>
                                                <span><MapPin size={12} /> {routeNodeObjs.length} stops</span>
                                                {disrupted.length > 0 && (
                                                    <span className="mp-card__disrupted">
                                                        <AlertTriangle size={12} /> {disrupted.length} disrupted
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </aside>

                {/* Map */}
                <div className="mp-map-wrap" suppressHydrationWarning>
                    <MapView
                        nodes={nodes}
                        shipments={shipments}
                        selectedShipment={selectedShipment}
                        onNodeClick={handleNodeClick}
                        onShipmentClick={selectShipment}
                        flyTo={flyTo}
                        computeAltRoute={computeAltRoute}
                        getStatus={getStatus}
                        routeNodeIds={routeNodeIds}
                        sidebarTab={sidebarTab}
                    />

                    {/* Legend */}
                    <div className="mp-legend">
                        <div className="mp-legend__title">Legend</div>
                        <div className="mp-legend__row"><span className="mp-legend__dot" style={{ background: "var(--blue)" }} /> Port</div>
                        <div className="mp-legend__row"><span className="mp-legend__dot" style={{ background: "var(--purple)" }} /> Airport</div>
                        <div className="mp-legend__row"><span className="mp-legend__dot" style={{ background: "var(--amber)" }} /> Hub</div>
                        <div className="mp-legend__divider" />
                        <div className="mp-legend__row"><span className="mp-legend__line" style={{ background: "var(--teal)" }} /> Clear Route</div>
                        <div className="mp-legend__row"><span className="mp-legend__line" style={{ background: "var(--red)", backgroundImage: "repeating-linear-gradient(90deg,var(--red) 0,var(--red) 5px,transparent 5px,transparent 9px)" }} /> Disrupted</div>
                        <div className="mp-legend__row"><span className="mp-legend__line" style={{ background: "var(--blue)", backgroundImage: "repeating-linear-gradient(90deg,var(--blue) 0,var(--blue) 4px,transparent 4px,transparent 8px)" }} /> Alt Route</div>
                    </div>

                    {/* Detail Panel */}
                    <div className={`mp-detail ${selectedData ? "mp-detail--open" : ""}`}>
                        <button className="mp-detail__close" onClick={closeDetail}>
                            <X size={16} />
                        </button>
                        {selectedData && (
                            <div className="mp-detail__content">
                                <div className="mp-detail__id">{selectedData.shipment.id}</div>
                                <span className={`mp-card__badge badge--${selectedData.status === "on-time" ? "ok" : selectedData.status === "at-risk" ? "warn" : "bad"}`} style={{ display: "inline-block", marginBottom: 14 }}>
                                    {selectedData.status === "on-time" ? "On Time" : selectedData.status === "at-risk" ? "At Risk" : "Disrupted"}
                                </span>

                                {/* Disruptions */}
                                {selectedData.disrupted.map((n) => (
                                    <div key={n.id} className={`mp-disruption ${n.disruption?.severity === "high" ? "" : "mp-disruption--warn"}`}>
                                        <div className={`mp-disruption__title ${n.disruption?.severity === "high" ? "mp-disruption__title--red" : "mp-disruption__title--amber"}`}>
                                            <AlertTriangle size={14} />
                                            {n.disruption?.type} — {n.name}
                                        </div>
                                        <div className="mp-disruption__desc">{n.disruption?.description}</div>
                                        <div style={{ marginTop: 4, fontSize: "0.75rem", color: "var(--text-primary)", fontWeight: 600 }}>
                                            Delay: +{n.disruption?.delayHours}h · Severity: {n.disruption?.severity.toUpperCase()}
                                        </div>
                                    </div>
                                ))}

                                {/* Node Chain */}
                                <div className="mp-detail__section">
                                    <div className="mp-detail__section-title"><Route size={13} /> Route ({selectedData.routeNodes.length} stops)</div>
                                    <div className="node-chain">
                                        {selectedData.routeNodes.map((node, i) => (
                                            <div key={node.id}>
                                                <div className="nc-item">
                                                    <div className={`nc-dot ${node.disruption ? "nc-dot--bad" : `nc-dot--${node.type}`}`} />
                                                    <span className={`nc-name ${node.disruption ? "nc-name--bad" : ""}`}>
                                                        {typeIcon(node.type)} {node.name}
                                                    </span>
                                                    {node.disruption && (
                                                        <span className="nc-badge badge--bad">{node.disruption.type}</span>
                                                    )}
                                                </div>
                                                {i < selectedData.routeNodes.length - 1 && (
                                                    <div className={`nc-conn ${selectedData.routeNodes[i + 1].disruption ? "nc-conn--bad" : ""}`} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Alt Route */}
                                {selectedData.alt && (
                                    <div className="mp-detail__section">
                                        <div className="mp-detail__section-title"><GitBranch size={13} /> Alternative Route</div>
                                        <div className="mp-alt">
                                            <div className="mp-alt__title"><Navigation size={13} /> Computed Bypass</div>
                                            <div className="mp-alt__text">
                                                {selectedData.alt.map((n) => n.name).join(" → ")}
                                            </div>
                                        </div>
                                        <div className="mp-rec">
                                            <div className="mp-rec__label"><Zap size={12} /> AI Recommendation</div>
                                            <div className="mp-rec__text">
                                                Reroute via the alternative path to bypass {selectedData.disrupted.length} disrupted node(s). Uses nearest available non-disrupted ports.
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Shipment Details */}
                                <div className="mp-detail__section">
                                    <div className="mp-detail__section-title"><Info size={13} /> Details</div>
                                    <div className="mp-detail__row"><span className="mp-detail__label">Carrier</span><span className="mp-detail__value">{selectedData.shipment.carrier}</span></div>
                                    <div className="mp-detail__row"><span className="mp-detail__label">Mode</span><span className="mp-detail__value">{selectedData.shipment.mode === "sea" ? "Sea Freight" : "Air Freight"}</span></div>
                                    <div className="mp-detail__row"><span className="mp-detail__label">Cargo</span><span className="mp-detail__value">{selectedData.shipment.cargo}</span></div>
                                    <div className="mp-detail__row"><span className="mp-detail__label">Weight</span><span className="mp-detail__value">{selectedData.shipment.weight}</span></div>
                                    <div className="mp-detail__row"><span className="mp-detail__label">Departed</span><span className="mp-detail__value">{selectedData.shipment.departed}</span></div>
                                    <div className="mp-detail__row"><span className="mp-detail__label">ETA</span><span className="mp-detail__value">{selectedData.shipment.eta}</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Agent Results Modal */}
            {showResults && (
                <div className="mp-modal-overlay" onClick={() => setShowResults(false)}>
                    <div className="mp-agent-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="mp-agent-modal__head">
                            <div className="mp-agent-modal__title">
                                <Brain size={20} />
                                Agent Pipeline Results
                                <span className={`mp-mode-toggle__status ${dataMode === "realtime" ? "mp-mode-toggle__status--live" : "mp-mode-toggle__status--sim"}`} style={{ marginLeft: 8 }}>
                                    {dataMode === "realtime" ? "Live Data" : "Simulation"}
                                </span>
                            </div>
                            <button className="mp-modal__x" onClick={() => setShowResults(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        {agentLoading ? (
                            <div className="mp-agent-loading">
                                <Loader2 size={40} className="mp-spin" />
                                <div className="mp-agent-loading__text">Running 4-Agent Pipeline...</div>
                                <div className="mp-agent-loading__stages">
                                    <div className="mp-agent-loading__stage">
                                        <Layers size={14} /> Monitor Agent — scanning route & disruptions
                                    </div>
                                    <div className="mp-agent-loading__stage">
                                        <BarChart3 size={14} /> Risk Agent — assessing stockout & revenue loss
                                    </div>
                                    <div className="mp-agent-loading__stage">
                                        <GitBranch size={14} /> Planner Agent — generating recovery options
                                    </div>
                                    <div className="mp-agent-loading__stage">
                                        <Target size={14} /> Decision Agent — selecting optimal plan
                                    </div>
                                </div>
                            </div>
                        ) : agentResults ? (
                            <>
                                {/* Agent Tabs */}
                                <div className="mp-agent-tabs">
                                    {([
                                        { key: "monitoring" as const, label: "Monitor", icon: <Layers size={14} /> },
                                        { key: "risk" as const, label: "Risk", icon: <BarChart3 size={14} /> },
                                        { key: "planner" as const, label: "Planner", icon: <GitBranch size={14} /> },
                                        { key: "decision" as const, label: "Decision", icon: <Target size={14} /> },
                                    ]).map((tab) => (
                                        <button
                                            key={tab.key}
                                            className={`mp-agent-tab ${activeAgentTab === tab.key ? "mp-agent-tab--active" : ""}`}
                                            onClick={() => setActiveAgentTab(tab.key)}
                                        >
                                            {tab.icon} {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <div className="mp-agent-content">
                                    {/* ── Monitoring Tab ── */}
                                    {activeAgentTab === "monitoring" && (
                                        <div className="mp-agent-panel">
                                            <div className="mp-agent-section">
                                                <h3><Layers size={16} /> Route Monitoring Summary</h3>
                                                <div className="mp-agent-kpi-row">
                                                    <div className="mp-agent-kpi">
                                                        <span className="mp-agent-kpi__val">{agentResults.monitoring.total_eta?.toFixed(1)}d</span>
                                                        <span className="mp-agent-kpi__label">Total ETA</span>
                                                    </div>
                                                    <div className="mp-agent-kpi mp-agent-kpi--warn">
                                                        <span className="mp-agent-kpi__val">{agentResults.monitoring.total_delay?.toFixed(1)}d</span>
                                                        <span className="mp-agent-kpi__label">Total Delay</span>
                                                    </div>
                                                    <div className="mp-agent-kpi mp-agent-kpi--bad">
                                                        <span className="mp-agent-kpi__val">{agentResults.monitoring.total_transit_days?.toFixed(1)}d</span>
                                                        <span className="mp-agent-kpi__label">Transit Time</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mp-agent-section">
                                                <h4>Weather Summary</h4>
                                                <p className="mp-agent-text">{agentResults.monitoring.weather_summary}</p>
                                            </div>

                                            <div className="mp-agent-section">
                                                <h4>Disruption Summary</h4>
                                                <p className="mp-agent-text">{agentResults.monitoring.disruption_summary}</p>
                                            </div>

                                            {agentResults.monitoring.segments?.map((seg: any, i: number) => (
                                                <div key={i} className={`mp-agent-segment ${seg.disruption_active ? "mp-agent-segment--disrupted" : ""}`}>
                                                    <div className="mp-agent-segment__route">
                                                        {seg.from_location} <ArrowRight size={12} /> {seg.to_location}
                                                    </div>
                                                    <div className="mp-agent-segment__details">
                                                        <span>ETA: {seg.eta_days}d</span>
                                                        <span>Delay: +{seg.delay_days}d</span>
                                                        <span className={`mp-agent-segment__weather mp-agent-segment__weather--${seg.weather_risk}`}>
                                                            Weather: {seg.weather_risk}
                                                        </span>
                                                        {seg.disruption_active && (
                                                            <span className="mp-agent-segment__disrupt">
                                                                <AlertTriangle size={11} /> {seg.disruption_type}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {seg.disruption_detail && (
                                                        <div className="mp-agent-segment__detail-text">{seg.disruption_detail}</div>
                                                    )}
                                                </div>
                                            ))}

                                            <div className="mp-agent-section">
                                                <h4><Brain size={14} /> LLM Analysis</h4>
                                                <div className="mp-agent-llm">{agentResults.monitoring.llm_analysis}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Risk Tab ── */}
                                    {activeAgentTab === "risk" && (
                                        <div className="mp-agent-panel">
                                            <div className="mp-agent-section">
                                                <h3><BarChart3 size={16} /> Risk Assessment</h3>
                                                <div className={`mp-agent-risk-badge mp-agent-risk-badge--${agentResults.risk.risk_level?.toLowerCase()}`}>
                                                    {agentResults.risk.risk_level}
                                                </div>
                                                <div className="mp-agent-kpi-row">
                                                    <div className="mp-agent-kpi">
                                                        <span className="mp-agent-kpi__val">{agentResults.risk.stock}</span>
                                                        <span className="mp-agent-kpi__label">Current Stock</span>
                                                    </div>
                                                    <div className="mp-agent-kpi">
                                                        <span className="mp-agent-kpi__val">{agentResults.risk.daily_demand}/d</span>
                                                        <span className="mp-agent-kpi__label">Daily Demand</span>
                                                    </div>
                                                    <div className="mp-agent-kpi mp-agent-kpi--warn">
                                                        <span className="mp-agent-kpi__val">{agentResults.risk.stockout_days?.toFixed(1)}d</span>
                                                        <span className="mp-agent-kpi__label">Days to Stockout</span>
                                                    </div>
                                                    <div className="mp-agent-kpi">
                                                        <span className="mp-agent-kpi__val">{agentResults.risk.shipment_arrival_days?.toFixed(1)}d</span>
                                                        <span className="mp-agent-kpi__label">Arrival In</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mp-agent-section">
                                                <h4>Financial Impact</h4>
                                                <div className="mp-agent-kpi-row">
                                                    <div className={`mp-agent-kpi ${agentResults.risk.disruption_risk ? "mp-agent-kpi--bad" : "mp-agent-kpi--ok"}`}>
                                                        <span className="mp-agent-kpi__val">
                                                            {agentResults.risk.disruption_risk ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                                                        </span>
                                                        <span className="mp-agent-kpi__label">Disruption Risk</span>
                                                    </div>
                                                    <div className="mp-agent-kpi mp-agent-kpi--bad">
                                                        <span className="mp-agent-kpi__val">{agentResults.risk.lost_units?.toFixed(0)}</span>
                                                        <span className="mp-agent-kpi__label">Lost Units</span>
                                                    </div>
                                                    <div className="mp-agent-kpi mp-agent-kpi--bad">
                                                        <span className="mp-agent-kpi__val">
                                                            <DollarSign size={14} />{agentResults.risk.revenue_loss?.toLocaleString()}
                                                        </span>
                                                        <span className="mp-agent-kpi__label">Revenue Loss</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mp-agent-section">
                                                <h4><Brain size={14} /> LLM Analysis</h4>
                                                <div className="mp-agent-llm">{agentResults.risk.llm_analysis}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Planner Tab ── */}
                                    {activeAgentTab === "planner" && (
                                        <div className="mp-agent-panel">
                                            <div className="mp-agent-section">
                                                <h3><GitBranch size={16} /> Recovery Options</h3>
                                            </div>

                                            {agentResults.planner.options?.map((opt: any, i: number) => {
                                                const isChosen = agentResults.decision.chosen_option?.option_name === opt.option_name;
                                                return (
                                                    <div key={i} className={`mp-agent-option ${isChosen ? "mp-agent-option--chosen" : ""}`}>
                                                        <div className="mp-agent-option__header">
                                                            <span className="mp-agent-option__name">
                                                                {isChosen && <CheckCircle2 size={14} />} {opt.option_name}
                                                            </span>
                                                            {isChosen && <span className="mp-agent-option__badge">AI Recommended</span>}
                                                        </div>
                                                        <p className="mp-agent-option__desc">{opt.description}</p>
                                                        <div className="mp-agent-option__metrics">
                                                            <span>Cost: <strong>${opt.cost?.toLocaleString()}</strong></span>
                                                            <span>Loss: <strong>${opt.projected_loss?.toLocaleString()}</strong></span>
                                                            <span>Total: <strong>${opt.total_impact?.toLocaleString()}</strong></span>
                                                            <span>Timeline: <strong>{opt.timeline_days}d</strong></span>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            <div className="mp-agent-section">
                                                <h4><Brain size={14} /> LLM Analysis</h4>
                                                <div className="mp-agent-llm">{agentResults.planner.llm_analysis}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Decision Tab ── */}
                                    {activeAgentTab === "decision" && (
                                        <div className="mp-agent-panel">
                                            <div className="mp-agent-section">
                                                <h3><Target size={16} /> Final Decision</h3>
                                                <div className="mp-agent-chosen">
                                                    <div className="mp-agent-chosen__label">
                                                        <CheckCircle2 size={18} /> Chosen Plan
                                                    </div>
                                                    <div className="mp-agent-chosen__name">
                                                        {agentResults.decision.chosen_option?.option_name}
                                                    </div>
                                                    <div className="mp-agent-chosen__impact">
                                                        Total Impact: ${agentResults.decision.chosen_option?.total_impact?.toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mp-agent-section">
                                                <h4><TrendingUp size={14} /> Scenario Comparison</h4>
                                                <div className="mp-agent-sim-table">
                                                    <div className="mp-agent-sim-header">
                                                        <span>Option</span>
                                                        <span>Cost</span>
                                                        <span>Loss</span>
                                                        <span>Total</span>
                                                    </div>
                                                    {agentResults.decision.simulations?.map((sim: any, i: number) => (
                                                        <div key={i} className={`mp-agent-sim-row ${sim.chosen ? "mp-agent-sim-row--chosen" : ""}`}>
                                                            <span>{sim.chosen && <CheckCircle2 size={12} />} {sim.option_name}</span>
                                                            <span>${sim.cost?.toLocaleString()}</span>
                                                            <span>${sim.projected_loss?.toLocaleString()}</span>
                                                            <span>${sim.total_impact?.toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mp-agent-section">
                                                <h4><Brain size={14} /> Decision Reasoning</h4>
                                                <div className="mp-agent-llm">{agentResults.decision.reasoning}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="mp-agent-loading">
                                <XCircle size={40} style={{ color: "var(--red)" }} />
                                <div className="mp-agent-loading__text">Pipeline failed. Check backend logs.</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Disruption Modal */}
            {disruptModal && disruptingNode && (
                <div className="mp-modal-overlay" onClick={() => setDisruptModal(null)}>
                    <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="mp-modal__head">
                            <div className="mp-modal__title">
                                <AlertTriangle size={18} />
                                {disruptingNode.disruption ? "Manage Disruption" : "Simulate Disruption"}
                            </div>
                            <button className="mp-modal__x" onClick={() => setDisruptModal(null)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="mp-modal__body">
                            <div className="mp-fg">
                                <label className="mp-label">Node</label>
                                <input className="mp-input" readOnly value={`${disruptingNode.name}, ${disruptingNode.country}`} style={{ opacity: 0.6 }} />
                            </div>
                            <div className="mp-fg">
                                <label className="mp-label">Disruption Type</label>
                                <select className="mp-select" value={disruptForm.type} onChange={(e) => setDisruptForm((f) => ({ ...f, type: e.target.value }))}>
                                    <option>Port Strike</option>
                                    <option>Severe Weather</option>
                                    <option>Port Congestion</option>
                                    <option>Equipment Failure</option>
                                    <option>Security Alert</option>
                                    <option>Customs Delay</option>
                                </select>
                            </div>
                            <div className="mp-fg">
                                <label className="mp-label">Severity</label>
                                <div className="mp-radio-group">
                                    {(["low", "medium", "high"] as const).map((s) => (
                                        <label key={s} className="mp-radio">
                                            <input type="radio" name="sev" value={s} checked={disruptForm.severity === s} onChange={() => setDisruptForm((f) => ({ ...f, severity: s }))} />
                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="mp-fg">
                                <label className="mp-label">Delay (hours)</label>
                                <input className="mp-input" type="number" min={1} max={720} value={disruptForm.delayHours} onChange={(e) => setDisruptForm((f) => ({ ...f, delayHours: parseInt(e.target.value) || 12 }))} />
                            </div>
                            <div className="mp-fg">
                                <label className="mp-label">Description (optional)</label>
                                <textarea className="mp-textarea" rows={2} value={disruptForm.description} onChange={(e) => setDisruptForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description..." />
                            </div>
                        </div>
                        <div className="mp-modal__foot">
                            {disruptingNode.disruption && (
                                <button className="mp-btn mp-btn--ghost" onClick={clearDisruption}>Clear Disruption</button>
                            )}
                            <button className="mp-btn mp-btn--ghost" onClick={() => setDisruptModal(null)}>Cancel</button>
                            <button className="mp-btn mp-btn--danger" onClick={confirmDisruption}>
                                {disruptingNode.disruption ? "Update" : "Trigger Disruption"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
