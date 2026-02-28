"use client";

/**
 * BlueprintRouteViewer — Unreal Engine Blueprint-style Route Graph
 * =================================================================
 * Renders planned routes as an interactive node-graph on a dotted grid.
 * Each route is a horizontal chain of nodes connected by wires.
 * 
 * Features:
 * - Dotted grid background (UE Blueprint style, light theme)
 * - Pannable / zoomable canvas
 * - Route nodes with segment details (cost, ETA, status)
 * - Best route highlighted, alternatives shown below
 * - Expand button → full-page mode, close button → collapse back
 */

import React, { useRef, useState, useCallback, useEffect } from "react";
import {
    Anchor,
    Plane,
    Maximize2,
    Minimize2,
    DollarSign,
    Clock,
    Navigation,
    ArrowRight,
    Ship,
    CircleDot,
    Trophy,
    Star,
} from "lucide-react";

// ── Types matching backend PlannedRoute.to_dict() ──

interface RouteNodeData {
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

interface SegmentData {
    from: RouteNodeData;
    to: RouteNodeData;
    transport_mode: "sea" | "air" | "intermodal";
    distance_km: number;
    cost_usd: number;
    time_hours: number;
    cumulative_cost: number;
    cumulative_time_hours: number;
}

interface RouteData {
    route_id: number;
    label: string;
    segments: SegmentData[];
    total_cost: number;
    total_time_hours: number;
    total_distance_km: number;
    transport_modes_used: string[];
    node_count: number;
}

interface BlueprintRouteViewerProps {
    routes: RouteData[];
    loading?: boolean;
}

// ── Layout Constants ──
const NODE_W = 220;
const NODE_H = 130;
const NODE_GAP_X = 160;
const ROUTE_GAP_Y = 200;
const CANVAS_PAD = 80;
const WIRE_LABEL_OFFSET = -30;

// ── Color Palette ──
const ROUTE_COLORS = [
    { wire: "#2563eb", node: "#2563eb", bg: "#eff6ff", label: "Best" },
    { wire: "#8b5cf6", node: "#7c3aed", bg: "#f5f3ff", label: "Alt 1" },
    { wire: "#059669", node: "#059669", bg: "#ecfdf5", label: "Alt 2" },
    { wire: "#d97706", node: "#b45309", bg: "#fffbeb", label: "Alt 3" },
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
export default function BlueprintRouteViewer({ routes, loading }: BlueprintRouteViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);

    // Pan state
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

    // Compute canvas dimensions
    const maxNodes = Math.max(...routes.map((r) => r.segments.length + 1), 2);
    const canvasW = CANVAS_PAD * 2 + maxNodes * NODE_W + (maxNodes - 1) * NODE_GAP_X;
    const canvasH = CANVAS_PAD * 2 + routes.length * (NODE_H + ROUTE_GAP_Y);

    // Mouse handlers for panning
    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest(".bp-node, .bp-expand-btn, .bp-legend")) return;
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

    // Collect all unique nodes across routes (for rendering)
    const getNodesForRoute = (route: RouteData): RouteNodeData[] => {
        if (route.segments.length === 0) return [];
        const nodes = [route.segments[0].from];
        for (const seg of route.segments) {
            nodes.push(seg.to);
        }
        return nodes;
    };

    if (loading) {
        return (
            <div className={`bp-container ${expanded ? "bp-container--expanded" : ""}`}>
                <div className="bp-loading">
                    <div className="bp-loading__spinner" />
                    <span>Computing optimal routes...</span>
                </div>
            </div>
        );
    }

    if (routes.length === 0) {
        return (
            <div className={`bp-container ${expanded ? "bp-container--expanded" : ""}`}>
                <div className="bp-empty">
                    <Navigation size={32} />
                    <span>Submit a route to see the blueprint</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`bp-container ${expanded ? "bp-container--expanded" : ""}`}>
            {/* Header bar */}
            <div className="bp-header">
                <div className="bp-header__title">
                    <CircleDot size={16} />
                    <span>Route Blueprint</span>
                    <span className="bp-header__count">{routes.length} routes</span>
                </div>
                <button
                    className="bp-expand-btn"
                    onClick={() => setExpanded(!expanded)}
                    title={expanded ? "Collapse" : "Expand to full page"}
                    type="button"
                >
                    {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
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
                    {routes.map((route, ri) => {
                        const nodes = getNodesForRoute(route);
                        const color = ROUTE_COLORS[ri % ROUTE_COLORS.length];
                        const yBase = CANVAS_PAD + ri * (NODE_H + ROUTE_GAP_Y);
                        const isBest = ri === 0;

                        return (
                            <div key={route.route_id} className="bp-route" style={{ position: "absolute", top: yBase, left: CANVAS_PAD }}>
                                {/* Route label */}
                                <div
                                    className={`bp-route-label ${isBest ? "bp-route-label--best" : ""}`}
                                    style={{ borderLeftColor: color.wire, top: -36, left: 0 }}
                                >
                                    {isBest ? <Trophy size={13} /> : <Star size={13} />}
                                    <span>{route.label}</span>
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
                                                    strokeWidth={isBest ? 3 : 2}
                                                    strokeDasharray={seg.transport_mode === "air" ? "8 4" : seg.transport_mode === "intermodal" ? "4 4" : "none"}
                                                    opacity={isBest ? 0.85 : 0.5}
                                                />
                                                {/* Arrow head */}
                                                <polygon
                                                    points={`${x2 - 8},${y - 5} ${x2},${y} ${x2 - 8},${y + 5}`}
                                                    fill={modeColor}
                                                    opacity={isBest ? 0.8 : 0.4}
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

                                    return (
                                        <div
                                            key={`${route.route_id}-${node.node_id}-${ni}`}
                                            className={`bp-node ${isBest ? "bp-node--best" : ""} ${isFirst ? "bp-node--origin" : ""} ${isLast ? "bp-node--dest" : ""}`}
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

                                            {/* Output pin (right side) */}
                                            {!isLast && <div className="bp-pin bp-pin--out" style={{ borderColor: color.node }} />}
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
                <span className="bp-legend__hint">Scroll to zoom · Drag to pan</span>
            </div>
        </div>
    );
}
