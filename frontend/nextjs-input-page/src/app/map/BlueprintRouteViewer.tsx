"use client";

/**
 * BlueprintRouteViewer — Unreal Engine Blueprint-style Route Graph
 * =================================================================
 * Renders planned routes (best + 1 alt) as an interactive node-graph.
 * Users can add custom intermediate stops via "+" buttons on nodes.
 */

import React, { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    Anchor,
    Plane,
    Maximize2,
    DollarSign,
    Clock,
    Navigation,
    CircleDot,
    Trophy,
    Star,
    X,
    Plus,
    Search,
    MapPin,
} from "lucide-react";

// ── Types matching backend PlannedRoute.to_dict() ──

export interface RouteNodeData {
    node_id: string;
    name: string;
    city: string;
    state: string;
    lat: number;
    lng: number;
    node_type: "port" | "airport";
    subtype: string;
    code: string;
}

export interface SegmentData {
    from: RouteNodeData;
    to: RouteNodeData;
    transport_mode: "sea" | "air" | "intermodal";
    distance_km: number;
    cost_usd: number;
    time_hours: number;
    cumulative_cost: number;
    cumulative_time_hours: number;
}

export interface RouteData {
    route_id: number;
    label: string;
    segments: SegmentData[];
    total_cost: number;
    total_time_hours: number;
    total_distance_km: number;
    transport_modes_used: string[];
    node_count: number;
    isCustom?: boolean;
}

export interface TransportNode {
    id: string;
    name: string;
    city: string;
    state: string;
    lat: number;
    lng: number;
    node_type: "port" | "airport";
    subtype: string;
    code: string;
}

interface BlueprintRouteViewerProps {
    routes: RouteData[];
    loading?: boolean;
    onRouteSelect?: (route: RouteData) => void;
    onCustomRouteRequest?: (fromNode: RouteNodeData, selectedStop: TransportNode, toNode: RouteNodeData) => void;
    availableNodes?: TransportNode[];
}

// ── Layout Constants ──
const NODE_W = 220;
const NODE_H = 130;
const NODE_GAP_X = 160;
const ROUTE_GAP_Y = 200;
const CANVAS_PAD = 80;
const WIRE_LABEL_OFFSET = -30;
const MAX_ROUTES = 2; // Best + 1 alternative

// ── Color Palette ──
const ROUTE_COLORS = [
    { wire: "#2563eb", node: "#2563eb", bg: "#eff6ff", label: "Best" },
    { wire: "#8b5cf6", node: "#7c3aed", bg: "#f5f3ff", label: "Alt" },
    { wire: "#10b981", node: "#059669", bg: "#ecfdf5", label: "Custom" },
];

function formatTime(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const d = Math.floor(hours / 24);
    const h = Math.round(hours % 24);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

function formatCost(usd: number): string {
    if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
    return `$${usd.toFixed(0)}`;
}

// ── Main Component ──
export default function BlueprintRouteViewer({ 
    routes, 
    loading,
    onRouteSelect,
    onCustomRouteRequest,
    availableNodes = [],
}: BlueprintRouteViewerProps) {
    // Debug: log available nodes count
    console.log("[Blueprint] availableNodes count:", availableNodes.length, "routes:", routes.length);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);

    // Node picker state
    const [showNodePicker, setShowNodePicker] = useState(false);
    const [pickerContext, setPickerContext] = useState<{
        fromNode: RouteNodeData;
        toNode: RouteNodeData;
        position: { x: number; y: number };
    } | null>(null);
    const [nodeSearch, setNodeSearch] = useState("");

    // Pan state
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

    // Limit routes to MAX_ROUTES (best + 1 alt)
    const displayRoutes = routes.slice(0, MAX_ROUTES);

    // Compute canvas dimensions
    const maxNodes = Math.max(...displayRoutes.map((r) => r.segments.length + 1), 2);
    const canvasW = CANVAS_PAD * 2 + maxNodes * NODE_W + (maxNodes - 1) * NODE_GAP_X;
    const canvasH = CANVAS_PAD * 2 + displayRoutes.length * (NODE_H + ROUTE_GAP_Y);

    // Mouse handlers for panning
    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest(".bp-node, .bp-expand-btn, .bp-legend, .bp-add-btn, .bp-node-picker")) return;
        setDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }, [pan]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragging) return;
        setPan({
            x: dragStart.current.panX + (e.clientX - dragStart.current.x),
            y: dragStart.current.panY + (e.clientY - dragStart.current.y),
        });
    }, [dragging]);

    const onMouseUp = useCallback(() => setDragging(false), []);

    // Wheel → zoom
    const onWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setScale((s) => Math.min(2, Math.max(0.3, s - e.deltaY * 0.001)));
    }, []);

    // Reset pan when routes change
    useEffect(() => {
        setPan({ x: 0, y: 0 });
        setScale(expanded ? 0.85 : 0.75);
    }, [routes, expanded]);

    // Handle Escape key to close expanded view or picker
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (showNodePicker) {
                    setShowNodePicker(false);
                    setPickerContext(null);
                } else if (expanded) {
                    setExpanded(false);
                }
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        if (expanded) {
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [expanded, showNodePicker]);

    // Collect all unique nodes across routes (for rendering)
    const getNodesForRoute = (route: RouteData): RouteNodeData[] => {
        if (route.segments.length === 0) return [];
        const nodes = [route.segments[0].from];
        for (const seg of route.segments) {
            nodes.push(seg.to);
        }
        return nodes;
    };

    // Handle add button click
    const handleAddClick = (
        e: React.MouseEvent, 
        fromNode: RouteNodeData, 
        toNode: RouteNodeData
    ) => {
        console.log("[Blueprint] Add button clicked!", { fromNode: fromNode.city, toNode: toNode.city });
        e.stopPropagation();
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setPickerContext({
            fromNode,
            toNode,
            position: { x: rect.left, y: rect.bottom + 8 },
        });
        setShowNodePicker(true);
        setNodeSearch("");
    };

    // Handle node selection from picker
    const handleNodeSelect = (node: TransportNode) => {
        if (pickerContext && onCustomRouteRequest) {
            onCustomRouteRequest(pickerContext.fromNode, node, pickerContext.toNode);
        }
        setShowNodePicker(false);
        setPickerContext(null);
    };

    // Handle route selection
    const handleRouteClick = (route: RouteData) => {
        setSelectedRouteId(route.route_id);
        onRouteSelect?.(route);
    };

    // Filter available nodes based on search
    const filteredNodes = availableNodes.filter(
        (n) =>
            n.name.toLowerCase().includes(nodeSearch.toLowerCase()) ||
            n.city.toLowerCase().includes(nodeSearch.toLowerCase()) ||
            n.code?.toLowerCase().includes(nodeSearch.toLowerCase())
    ).slice(0, 8);

    if (loading) {
        return (
            <div className="bp-container">
                <div className="bp-loading">
                    <div className="bp-loading__spinner" />
                    <span>Computing optimal routes...</span>
                </div>
            </div>
        );
    }

    if (routes.length === 0) {
        return (
            <div className="bp-container">
                <div className="bp-empty">
                    <Navigation size={32} />
                    <span>Submit a route to see the blueprint</span>
                </div>
            </div>
        );
    }

    // Node picker dropdown
    const renderNodePicker = () => {
        if (!showNodePicker || !pickerContext) return null;

        const pickerElement = (
            <div 
                className="bp-node-picker"
                style={{
                    position: "fixed",
                    left: Math.min(pickerContext.position.x, window.innerWidth - 320),
                    top: Math.min(pickerContext.position.y, window.innerHeight - 300),
                    zIndex: 100001,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bp-node-picker__header">
                    <MapPin size={14} />
                    <span>Add Intermediate Stop</span>
                    <button 
                        className="bp-node-picker__close"
                        onClick={() => {
                            setShowNodePicker(false);
                            setPickerContext(null);
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
                <div className="bp-node-picker__search">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder="Search port or airport..."
                        value={nodeSearch}
                        onChange={(e) => setNodeSearch(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="bp-node-picker__list">
                    {filteredNodes.length === 0 ? (
                        <div className="bp-node-picker__empty">No matching nodes found</div>
                    ) : (
                        filteredNodes.map((node) => (
                            <button
                                key={node.id}
                                className="bp-node-picker__item"
                                onClick={() => handleNodeSelect(node)}
                            >
                                {node.node_type === "airport" ? (
                                    <Plane size={14} className="bp-node-picker__icon bp-node-picker__icon--air" />
                                ) : (
                                    <Anchor size={14} className="bp-node-picker__icon bp-node-picker__icon--sea" />
                                )}
                                <div className="bp-node-picker__info">
                                    <span className="bp-node-picker__name">{node.name}</span>
                                    <span className="bp-node-picker__city">{node.city}, {node.state}</span>
                                </div>
                                {node.code && <span className="bp-node-picker__code">{node.code}</span>}
                            </button>
                        ))
                    )}
                </div>
                <div className="bp-node-picker__hint">
                    Select a stop between <strong>{pickerContext.fromNode.city}</strong> and <strong>{pickerContext.toNode.city}</strong>
                </div>
            </div>
        );

        if (typeof document !== "undefined") {
            return createPortal(pickerElement, document.body);
        }
        return pickerElement;
    };

    // The main blueprint content
    const blueprintContent = (
        <div className={`bp-container ${expanded ? "bp-container--expanded" : ""}`}>
            {/* Backdrop overlay for expanded mode (visual only) */}
            {expanded && <div className="bp-backdrop" aria-hidden="true" />}

            {/* Header bar */}
            <div className={`bp-header ${expanded ? "bp-header--expanded" : ""}`}>
                <div className="bp-header__title">
                    <CircleDot size={16} />
                    <span>Route Blueprint</span>
                    <span className="bp-header__count">{displayRoutes.length} routes</span>
                </div>

                {/* Summary stats shown in expanded mode */}
                {expanded && displayRoutes.length > 0 && (
                    <div className="bp-header__summary">
                        <div className="bp-header__stat">
                            <Trophy size={14} />
                            <span>Best: {formatCost(displayRoutes[0].total_cost)}</span>
                        </div>
                        <div className="bp-header__stat">
                            <Clock size={14} />
                            <span>{formatTime(displayRoutes[0].total_time_hours)}</span>
                        </div>
                        <div className="bp-header__stat">
                            <Navigation size={14} />
                            <span>{displayRoutes[0].total_distance_km.toFixed(0)} km</span>
                        </div>
                    </div>
                )}

                <div className="bp-header__actions">
                    {expanded && (
                        <span className="bp-header__hint">Press ESC to close</span>
                    )}
                    <button
                        className={`bp-expand-btn ${expanded ? "bp-expand-btn--close" : ""}`}
                        onClick={() => setExpanded(!expanded)}
                        title={expanded ? "Close (ESC)" : "Expand to full screen"}
                        type="button"
                    >
                        {expanded ? <X size={20} /> : <Maximize2 size={18} />}
                    </button>
                </div>
            </div>

            {/* Canvas area */}
            <div
                ref={containerRef}
                className="bp-viewport"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onWheel={onWheel}
                style={{ cursor: dragging ? "grabbing" : "grab" }}
            >
                {/* Dotted grid background rendered via CSS */}
                <div
                    ref={canvasRef}
                    className="bp-canvas"
                    style={{
                        width: canvasW,
                        height: canvasH,
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: "0 0",
                    }}
                >
                    {displayRoutes.map((route, ri) => {
                        const nodes = getNodesForRoute(route);
                        const color = route.isCustom ? ROUTE_COLORS[2] : ROUTE_COLORS[ri % 2];
                        const yBase = CANVAS_PAD + ri * (NODE_H + ROUTE_GAP_Y);
                        const isBest = ri === 0 && !route.isCustom;
                        const isSelected = route.route_id === selectedRouteId;

                        return (
                            <div 
                                key={route.route_id} 
                                className={`bp-route ${isSelected ? "bp-route--selected" : ""}`}
                                style={{ position: "absolute", top: yBase, left: CANVAS_PAD }}
                                onClick={() => handleRouteClick(route)}
                            >
                                {/* Route label */}
                                <div
                                    className={`bp-route-label ${isBest ? "bp-route-label--best" : ""} ${route.isCustom ? "bp-route-label--custom" : ""}`}
                                    style={{ borderLeftColor: color.wire, top: -36, left: 0 }}
                                >
                                    {isBest ? <Trophy size={13} /> : route.isCustom ? <MapPin size={13} /> : <Star size={13} />}
                                    <span>{route.isCustom ? "Custom Route" : route.label}</span>
                                    <span className="bp-route-label__cost">{formatCost(route.total_cost)}</span>
                                    <span className="bp-route-label__time">{formatTime(route.total_time_hours)}</span>
                                    <span className="bp-route-label__dist">{route.total_distance_km.toFixed(0)} km</span>
                                </div>

                                {/* Wires (SVG lines between nodes) */}
                                <svg
                                    className="bp-wires"
                                    width={nodes.length * (NODE_W + NODE_GAP_X)}
                                    height={NODE_H + 60}
                                    style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}
                                >
                                    {route.segments.map((seg, si) => {
                                        const x1 = si * (NODE_W + NODE_GAP_X) + NODE_W;
                                        const x2 = (si + 1) * (NODE_W + NODE_GAP_X);
                                        const y = NODE_H / 2;
                                        const mx = (x1 + x2) / 2;

                                        const modeColor = seg.transport_mode === "air" ? "#7c3aed"
                                            : seg.transport_mode === "sea" ? "#2563eb"
                                            : "#d97706";

                                        return (
                                            <g key={si}>
                                                {/* Wire */}
                                                <path
                                                    d={`M ${x1} ${y} C ${x1 + 40} ${y}, ${x2 - 40} ${y}, ${x2} ${y}`}
                                                    fill="none"
                                                    stroke={modeColor}
                                                    strokeWidth={isBest || isSelected ? 3 : 2}
                                                    strokeDasharray={seg.transport_mode === "air" ? "8 4" : seg.transport_mode === "intermodal" ? "4 4" : "none"}
                                                    opacity={isBest || isSelected ? 0.85 : 0.5}
                                                />
                                                {/* Arrow head */}
                                                <polygon
                                                    points={`${x2 - 8},${y - 5} ${x2},${y} ${x2 - 8},${y + 5}`}
                                                    fill={modeColor}
                                                    opacity={isBest || isSelected ? 0.8 : 0.4}
                                                />
                                                {/* Segment label */}
                                                <foreignObject x={mx - 55} y={y + WIRE_LABEL_OFFSET - 35} width={110} height={30}>
                                                    <div className="bp-wire-label">
                                                        <span className="bp-wire-label__mode" style={{ color: modeColor }}>
                                                            {seg.transport_mode === "air" ? "✈" : seg.transport_mode === "sea" ? "🚢" : "🔄"}
                                                            {" "}{seg.distance_km.toFixed(0)} km
                                                        </span>
                                                        <span className="bp-wire-label__cost">{formatCost(seg.cost_usd)} · {formatTime(seg.time_hours)}</span>
                                                    </div>
                                                </foreignObject>
                                            </g>
                                        );
                                    })}
                                </svg>

                                {/* Nodes */}
                                {nodes.map((node, ni) => {
                                    const x = ni * (NODE_W + NODE_GAP_X);
                                    const isFirst = ni === 0;
                                    const isLast = ni === nodes.length - 1;
                                    const seg = ni > 0 ? route.segments[ni - 1] : null;
                                    const nextNode = ni < nodes.length - 1 ? nodes[ni + 1] : null;

                                    return (
                                        <div
                                            key={`${route.route_id}-${node.node_id}-${ni}`}
                                            className={`bp-node ${isBest || isSelected ? "bp-node--best" : ""} ${isFirst ? "bp-node--origin" : ""} ${isLast ? "bp-node--dest" : ""}`}
                                            style={{
                                                position: "absolute",
                                                left: x,
                                                top: 0,
                                                width: NODE_W,
                                                height: NODE_H,
                                                borderColor: isFirst ? "#059669" : isLast ? "#dc2626" : color.node,
                                            }}
                                        >
                                            {/* Node header with icon */}
                                            <div className="bp-node__header" style={{ background: isFirst ? "#059669" : isLast ? "#dc2626" : color.node }}>
                                                {node.node_type === "airport" ? <Plane size={13} color="#fff" /> : <Anchor size={13} color="#fff" />}
                                                <span className="bp-node__type">
                                                    {isFirst ? "ORIGIN" : isLast ? "DESTINATION" : node.node_type.toUpperCase()}
                                                </span>
                                                {node.code && <span className="bp-node__code">{node.code}</span>}
                                            </div>
                                            {/* Node body */}
                                            <div className="bp-node__body">
                                                <div className="bp-node__name">{node.name}</div>
                                                <div className="bp-node__city">{node.city}, {node.state}</div>
                                                {seg && (
                                                    <div className="bp-node__stats">
                                                        <span className="bp-node__stat">
                                                            <DollarSign size={11} /> {formatCost(seg.cumulative_cost)}
                                                        </span>
                                                        <span className="bp-node__stat">
                                                            <Clock size={11} /> {formatTime(seg.cumulative_time_hours)}
                                                        </span>
                                                    </div>
                                                )}
                                                {isFirst && (
                                                    <div className="bp-node__stats">
                                                        <span className="bp-node__stat bp-node__stat--start">
                                                            <CircleDot size={11} /> Start
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Output pin with add button (right side) */}
                                            {!isLast && (
                                                <>
                                                    <div className="bp-pin bp-pin--out" style={{ borderColor: color.node }} />
                                                    {/* Add stop button - only on first route (best) */}
                                                    {ri === 0 && nextNode && availableNodes.length > 0 && (
                                                        <button
                                                            className="bp-add-btn"
                                                            onClick={(e) => handleAddClick(e, node, nextNode)}
                                                            title="Add intermediate stop"
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            {/* Input pin (left side) */}
                                            {!isFirst && <div className="bp-pin bp-pin--in" style={{ borderColor: isLast ? "#dc2626" : color.node }} />}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="bp-legend">
                <span className="bp-legend__item"><span className="bp-legend__dot" style={{ background: "#2563eb" }} /> Sea</span>
                <span className="bp-legend__item"><span className="bp-legend__dot" style={{ background: "#7c3aed" }} /> Air</span>
                <span className="bp-legend__item"><span className="bp-legend__dot" style={{ background: "#d97706" }} /> Transfer</span>
                <span className="bp-legend__sep">|</span>
                <span className="bp-legend__hint">Click route to select · <Plus size={10} style={{ display: "inline" }} /> to add stop</span>
            </div>

            {/* Node picker */}
            {renderNodePicker()}
        </div>
    );

    // When expanded, render via portal to document.body for true full-screen
    if (expanded && typeof document !== "undefined") {
        return createPortal(blueprintContent, document.body);
    }

    return blueprintContent;
}
