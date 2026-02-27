"use client";

/**
 * BackgroundMap — Decorative, non-interactive blurred map background
 */

import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const SAMPLE_NODES: [number, number][] = [
    [31.23, 121.47],  // Shanghai
    [1.26, 103.82],   // Singapore
    [18.95, 72.95],   // Mumbai
    [25.01, 55.08],   // Dubai
    [51.91, 4.47],    // Rotterdam
    [53.55, 9.99],    // Hamburg
    [35.68, 139.65],  // Tokyo
    [6.95, 79.84],    // Colombo
];

const ROUTES: [number, number][][] = [
    [SAMPLE_NODES[0], SAMPLE_NODES[1], SAMPLE_NODES[7], SAMPLE_NODES[3], SAMPLE_NODES[4]],
    [SAMPLE_NODES[0], SAMPLE_NODES[6], SAMPLE_NODES[2], SAMPLE_NODES[3]],
    [SAMPLE_NODES[5], SAMPLE_NODES[4]],
];

export default function BackgroundMap() {
    return (
        <MapContainer
            center={[25, 55]}
            zoom={3}
            className="bg-map"
            zoomControl={false}
            attributionControl={false}
            dragging={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            touchZoom={false}
            keyboard={false}
            style={{ width: "100%", height: "100%", pointerEvents: "none" }}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
            />

            {/* Decorative routes */}
            {ROUTES.map((route, i) => (
                <Polyline
                    key={i}
                    positions={route}
                    pathOptions={{ color: "#2563eb", weight: 2, opacity: 0.4 }}
                />
            ))}

            {/* Decorative nodes */}
            {SAMPLE_NODES.map((pos, i) => (
                <CircleMarker
                    key={i}
                    center={pos}
                    radius={5}
                    pathOptions={{
                        color: "#2563eb",
                        fillColor: "#2563eb",
                        fillOpacity: 0.5,
                        weight: 2,
                        opacity: 0.6,
                    }}
                />
            ))}
        </MapContainer>
    );
}
