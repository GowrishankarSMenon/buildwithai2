"use client";

/**
 * MapView — Leaflet Map Component (client-only, no SSR)
 * Renders nodes, route segments, and alternative routes.
 * Node clicks directly open the disruption modal (no popup).
 */

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Anchor, Plane, Warehouse } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

// ── Types ──
interface LocationNode {
    id: string;
    name: string;
    country: string;
    type: "port" | "airport" | "hub";
    lat: number;
    lng: number;
    disruption: { type: string; severity: string; delayHours: number; description: string } | null;
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

interface MapViewProps {
    nodes: LocationNode[];
    shipments: Shipment[];
    selectedShipment: string | null;
    onNodeClick: (nodeId: string) => void;
    onShipmentClick: (shipmentId: string) => void;
    flyTo: [number, number, number] | null;
    computeAltRoute: (shipment: Shipment) => LocationNode[] | null;
    getStatus: (shipment: Shipment) => "on-time" | "at-risk" | "disrupted";
}

// ── SVG Icon Markup ──
function createNodeIcon(type: string, isDisrupted: boolean): L.DivIcon {
    const iconSvg =
        type === "airport"
            ? renderToStaticMarkup(<Plane size={14} color="#fff" />)
            : type === "hub"
                ? renderToStaticMarkup(<Warehouse size={14} color="#fff" />)
                : renderToStaticMarkup(<Anchor size={14} color="#fff" />);

    const disruptedBadge = isDisrupted
        ? '<div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:#ef4444;border:2px solid #0a0e1a;"></div>'
        : "";

    const cssClass = `node-mk node-mk--${type} ${isDisrupted ? "node-mk--disrupted" : ""}`;

    return L.divIcon({
        className: "",
        html: `<div class="${cssClass}">${iconSvg}${disruptedBadge}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
}

// ── Curved path between two points ──
function curvedPath(start: [number, number], end: [number, number], n = 40): [number, number][] {
    const pts: [number, number][] = [];
    const dist = Math.sqrt((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2);
    const curve = Math.min(dist * 0.1, 6);

    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const lat = start[0] + (end[0] - start[0]) * t;
        const lng = start[1] + (end[1] - start[1]) * t;
        const arc = Math.sin(t * Math.PI) * curve;
        pts.push([lat + arc, lng]);
    }
    return pts;
}

// ── FlyTo sub-component ──
function FlyToControl({ flyTo }: { flyTo: [number, number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (flyTo) {
            map.flyTo([flyTo[0], flyTo[1]], flyTo[2], { duration: 1.2 });
        }
    }, [flyTo, map]);
    return null;
}

// ── Main Component ──
export default function MapView({
    nodes,
    shipments,
    selectedShipment,
    onNodeClick,
    onShipmentClick,
    flyTo,
    computeAltRoute,
}: MapViewProps) {
    return (
        <MapContainer
            center={[20, 40]}
            zoom={3}
            className="mp-map"
            zoomControl={true}
            attributionControl={true}
            minZoom={2}
            maxZoom={18}
            worldCopyJump={true}
            style={{ width: "100%", height: "100%" }}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                maxZoom={19}
            />

            <FlyToControl flyTo={flyTo} />

            {/* Route segments */}
            {shipments.map((s) => {
                const routeNodes = s.routeNodes
                    .map((id) => nodes.find((n) => n.id === id))
                    .filter(Boolean) as LocationNode[];
                const isSel = selectedShipment === s.id;
                const dimmed = selectedShipment && !isSel;

                const segments: React.ReactNode[] = [];

                for (let i = 0; i < routeNodes.length - 1; i++) {
                    const from = routeNodes[i];
                    const to = routeNodes[i + 1];
                    const toDisrupted = !!to.disruption;
                    const pts = curvedPath([from.lat, from.lng], [to.lat, to.lng]);
                    const color = toDisrupted ? "#ef4444" : "#00e5c8";
                    const glowColor = toDisrupted ? "rgba(239,68,68,0.2)" : "rgba(0,229,200,0.15)";

                    segments.push(
                        <Polyline
                            key={`${s.id}-glow-${i}`}
                            positions={pts}
                            pathOptions={{ color: glowColor, weight: 8, opacity: dimmed ? 0.03 : 0.3 }}
                            interactive={false}
                        />,
                        <Polyline
                            key={`${s.id}-line-${i}`}
                            positions={pts}
                            pathOptions={{
                                color,
                                weight: 3,
                                opacity: dimmed ? 0.1 : 0.8,
                                dashArray: toDisrupted ? "8 6" : undefined,
                            }}
                            eventHandlers={{ click: () => onShipmentClick(s.id) }}
                        />
                    );
                }

                const altRoute = computeAltRoute(s);
                if (altRoute && altRoute.length > 1) {
                    for (let i = 0; i < altRoute.length - 1; i++) {
                        const from = altRoute[i];
                        const to = altRoute[i + 1];
                        const pts = curvedPath([from.lat, from.lng], [to.lat, to.lng], 30);

                        segments.push(
                            <Polyline
                                key={`${s.id}-alt-glow-${i}`}
                                positions={pts}
                                pathOptions={{ color: "rgba(59,130,246,0.15)", weight: 10, opacity: dimmed ? 0 : 0.25 }}
                                interactive={false}
                            />,
                            <Polyline
                                key={`${s.id}-alt-line-${i}`}
                                positions={pts}
                                pathOptions={{ color: "#3b82f6", weight: 3, opacity: dimmed ? 0 : 0.7, dashArray: "6 8" }}
                                interactive={false}
                            />
                        );
                    }
                }

                return <React.Fragment key={s.id}>{segments}</React.Fragment>;
            })}

            {/* Node markers — click opens disruption modal directly */}
            {nodes.map((node) => {
                const icon = createNodeIcon(node.type, !!node.disruption);
                const typeLabel = node.type === "airport" ? "Airport" : node.type === "hub" ? "Hub" : "Port";
                const tooltipText = node.disruption
                    ? `${node.name} — ${typeLabel} · ${node.disruption.type} (+${node.disruption.delayHours}h)`
                    : `${node.name} — ${typeLabel} · Click to disrupt`;

                return (
                    <Marker
                        key={node.id}
                        position={[node.lat, node.lng]}
                        icon={icon}
                        eventHandlers={{
                            click: (e) => {
                                L.DomEvent.stopPropagation(e.originalEvent);
                                onNodeClick(node.id);
                            },
                        }}
                    >
                        <Tooltip
                            direction="top"
                            offset={[0, -16]}
                            opacity={0.95}
                            className="node-tooltip"
                        >
                            {tooltipText}
                        </Tooltip>
                    </Marker>
                );
            })}
        </MapContainer>
    );
}
