"use client";

/**
 * BackgroundMap — Decorative, non-interactive blurred map background
 */

import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const SAMPLE_NODES: [number, number][] = [
    [18.95, 72.95],   // Nhava Sheva (JNPT)
    [13.08, 80.27],   // Chennai
    [9.97, 76.27],    // Kochi
    [17.69, 83.22],   // Visakhapatnam
    [22.77, 69.68],   // Mundra
    [22.03, 88.12],   // Kolkata (Haldia)
    [23.03, 70.07],   // Kandla
    [8.76, 78.13],    // Tuticorin
    [12.92, 74.86],   // New Mangalore
    [20.26, 86.71],   // Paradip
];

const ROUTES: [number, number][][] = [
    [SAMPLE_NODES[0], SAMPLE_NODES[2], SAMPLE_NODES[7], SAMPLE_NODES[1]],              // West → South → East
    [SAMPLE_NODES[4], SAMPLE_NODES[6], SAMPLE_NODES[0], SAMPLE_NODES[8]],              // Gujarat → Mumbai → Mangalore
    [SAMPLE_NODES[5], SAMPLE_NODES[9], SAMPLE_NODES[3], SAMPLE_NODES[1]],              // Kolkata → Paradip → Vizag → Chennai
];

export default function BackgroundMap() {
    return (
        <MapContainer
            center={[17, 78]}
            zoom={5}
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
