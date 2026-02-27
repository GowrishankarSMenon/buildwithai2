"use client";

/**
 * Agentic Disruption Shield — Landing Page
 * ==========================================
 * Blurred map background with a centered form for:
 * - Initial node (origin)
 * - Final node (destination)
 * - Intermediate stops
 * - Current position of shipment
 * - Disruption node + reason
 * Submitting transitions to the visualization page.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import "./map.css";

import {
    Shield,
    Search,
    X,
    Plane,
    Warehouse,
    AlertTriangle,
    Anchor,
    MapPin,
    Navigation,
    Plus,
    Trash2,
    ChevronDown,
    Send,
    Loader2,
    Locate,
} from "lucide-react";

// ── Types ──
export interface LocationNode {
    id: string;
    name: string;
    country: string;
    type: "port" | "airport" | "hub";
    lat: number;
    lng: number;
}

export interface RouteSubmission {
    origin: LocationNode;
    destination: LocationNode;
    stops: LocationNode[];
    currentPosition: LocationNode | null;
    disruption: {
        node: LocationNode;
        type: string;
        description: string;
    } | null;
}

// ── All available locations ──
export const LOCATIONS: LocationNode[] = [
    { id: "N1", name: "Shanghai", country: "China", type: "port", lat: 31.2304, lng: 121.4737 },
    { id: "N2", name: "Singapore", country: "Singapore", type: "port", lat: 1.2644, lng: 103.8222 },
    { id: "N3", name: "Mumbai", country: "India", type: "port", lat: 18.9500, lng: 72.9500 },
    { id: "N4", name: "Dubai", country: "UAE", type: "port", lat: 25.0143, lng: 55.0802 },
    { id: "N5", name: "Rotterdam", country: "Netherlands", type: "port", lat: 51.9054, lng: 4.4666 },
    { id: "N6", name: "Los Angeles", country: "USA", type: "port", lat: 33.7405, lng: -118.2723 },
    { id: "N7", name: "Colombo", country: "Sri Lanka", type: "port", lat: 6.9497, lng: 79.8428 },
    { id: "N8", name: "Tokyo", country: "Japan", type: "airport", lat: 35.6762, lng: 139.6503 },
    { id: "N9", name: "Hamburg", country: "Germany", type: "port", lat: 53.5511, lng: 9.9937 },
    { id: "N10", name: "Sydney", country: "Australia", type: "port", lat: -33.8688, lng: 151.2093 },
    { id: "N11", name: "Busan", country: "South Korea", type: "port", lat: 35.1796, lng: 129.0756 },
    { id: "N12", name: "Jeddah", country: "Saudi Arabia", type: "port", lat: 21.4858, lng: 39.1925 },
];

// Dynamic map (background only)
const BackgroundMap = dynamic(() => import("./BackgroundMap"), { ssr: false });
// Visualization page
const VisualizationPage = dynamic(() => import("./VisualizationPage"), { ssr: false });

// ── Location Picker Component ──
function LocationPicker({
    label, value, onChange, placeholder, icon, exclude, locations,
}: {
    label: string;
    value: string;
    onChange: (id: string) => void;
    placeholder: string;
    icon: React.ReactNode;
    exclude?: string[];
    locations?: LocationNode[];
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);
    const locs = locations || LOCATIONS;

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return locs.filter(
            (l) =>
                (!exclude || !exclude.includes(l.id)) &&
                (l.name.toLowerCase().includes(q) || l.country.toLowerCase().includes(q))
        );
    }, [search, exclude, locs]);

    const selected = locs.find((l) => l.id === value);

    return (
        <div className="lp-picker" ref={ref}>
            <label className="lp-picker__label">{label}</label>
            <button className="lp-picker__btn" onClick={() => setOpen(!open)} type="button">
                <span className="lp-picker__icon">{icon}</span>
                {selected ? (
                    <span className="lp-picker__selected">
                        {selected.name} <span className="lp-picker__country">({selected.country})</span>
                    </span>
                ) : (
                    <span className="lp-picker__placeholder">{placeholder}</span>
                )}
                <ChevronDown size={14} className={`lp-picker__chevron ${open ? "lp-picker__chevron--open" : ""}`} />
            </button>
            <div className={`lp-picker__dropdown ${open ? "lp-picker__dropdown--open" : ""}`}>
                <div className="lp-picker__search-wrap">
                    <Search size={14} className="lp-picker__search-icon" />
                    <input
                        className="lp-picker__search"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="lp-picker__list">
                    {filtered.length === 0 ? (
                        <div className="lp-picker__empty">No locations found</div>
                    ) : (
                        filtered.map((loc) => (
                            <button
                                key={loc.id}
                                className={`lp-picker__option ${value === loc.id ? "lp-picker__option--active" : ""}`}
                                onClick={() => { onChange(loc.id); setOpen(false); setSearch(""); }}
                                type="button"
                            >
                                {loc.type === "airport" ? <Plane size={13} /> : <Anchor size={13} />}
                                <span>{loc.name}</span>
                                <span className="lp-picker__opt-country">{loc.country}</span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──
export default function MapPage() {
    const [origin, setOrigin] = useState("");
    const [destination, setDestination] = useState("");
    const [stops, setStops] = useState<string[]>([]);
    const [currentPos, setCurrentPos] = useState("");
    const [disruptionNode, setDisruptionNode] = useState("");
    const [disruptionType, setDisruptionType] = useState("Port Strike");
    const [disruptionDesc, setDisruptionDesc] = useState("");
    const [submission, setSubmission] = useState<RouteSubmission | null>(null);

    // All selected IDs (to prevent duplicates)
    const usedIds = useMemo(() => {
        const ids: string[] = [];
        if (origin) ids.push(origin);
        if (destination) ids.push(destination);
        stops.forEach((s) => { if (s) ids.push(s); });
        return ids;
    }, [origin, destination, stops]);

    // Full ordered route node IDs
    const routeNodeIds = useMemo(() => {
        const ids: string[] = [];
        if (origin) ids.push(origin);
        stops.forEach((s) => { if (s) ids.push(s); });
        if (destination) ids.push(destination);
        return ids;
    }, [origin, destination, stops]);

    const addStop = useCallback(() => setStops((prev) => [...prev, ""]), []);
    const removeStop = useCallback((i: number) => setStops((prev) => prev.filter((_, idx) => idx !== i)), []);
    const updateStop = useCallback((i: number, val: string) => setStops((prev) => prev.map((s, idx) => (idx === i ? val : s))), []);

    const canSubmit = origin && destination && routeNodeIds.length >= 2;

    const handleSubmit = useCallback(() => {
        if (!canSubmit) return;
        const originNode = LOCATIONS.find((l) => l.id === origin)!;
        const destNode = LOCATIONS.find((l) => l.id === destination)!;
        const stopNodes = stops.map((s) => LOCATIONS.find((l) => l.id === s)).filter(Boolean) as LocationNode[];
        const curPosNode = currentPos ? LOCATIONS.find((l) => l.id === currentPos) || null : null;
        const disruptNode = disruptionNode ? LOCATIONS.find((l) => l.id === disruptionNode) || null : null;

        setSubmission({
            origin: originNode,
            destination: destNode,
            stops: stopNodes,
            currentPosition: curPosNode,
            disruption: disruptNode ? { node: disruptNode, type: disruptionType, description: disruptionDesc || disruptionType } : null,
        });
    }, [canSubmit, origin, destination, stops, currentPos, disruptionNode, disruptionType, disruptionDesc]);

    // If submitted → show visualization
    if (submission) {
        return (
            <VisualizationPage
                data={submission}
                onBack={() => setSubmission(null)}
            />
        );
    }

    return (
        <div className="lp">
            {/* Blurred map background */}
            <div className="lp-bg">
                <BackgroundMap />
            </div>
            <div className="lp-blur-overlay" />

            {/* Centered card */}
            <div className="lp-center">
                <div className="lp-logo">
                    <Shield size={28} />
                    <div>
                        <div className="lp-logo__title">Disruption Shield</div>
                        <div className="lp-logo__sub">Supply Chain Route Planner</div>
                    </div>
                </div>

                <div className="lp-card">
                    <div className="lp-card__header">
                        <Navigation size={18} />
                        <h2 className="lp-card__title">Plan Your Route</h2>
                    </div>

                    <div className="lp-card__body">
                        {/* Origin */}
                        <LocationPicker
                            label="Origin"
                            value={origin}
                            onChange={setOrigin}
                            placeholder="Select origin port..."
                            icon={<div className="lp-dot lp-dot--green" />}
                            exclude={usedIds.filter((id) => id !== origin)}
                        />

                        {/* Intermediate Stops */}
                        <div className="lp-stops">
                            <div className="lp-stops__header">
                                <span className="lp-stops__label">Intermediate Stops</span>
                                <button className="lp-add-btn" onClick={addStop} type="button">
                                    <Plus size={14} /> Add Stop
                                </button>
                            </div>
                            {stops.map((stop, i) => (
                                <div key={i} className="lp-stop-row" style={{ animationDelay: `${i * 60}ms`, position: 'relative', zIndex: 50 - i }}>
                                    <LocationPicker
                                        label={`Stop ${i + 1}`}
                                        value={stop}
                                        onChange={(val) => updateStop(i, val)}
                                        placeholder="Select intermediate port..."
                                        icon={<div className="lp-dot lp-dot--blue" />}
                                        exclude={usedIds.filter((id) => id !== stop)}
                                    />
                                    <button className="lp-remove-btn" onClick={() => removeStop(i)} type="button">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Destination */}
                        <LocationPicker
                            label="Destination"
                            value={destination}
                            onChange={setDestination}
                            placeholder="Select destination port..."
                            icon={<div className="lp-dot lp-dot--red" />}
                            exclude={usedIds.filter((id) => id !== destination)}
                        />

                        {/* Current Position */}
                        {routeNodeIds.length >= 2 && (
                            <>
                                <div className="lp-divider" />
                                <div className="lp-section-title">
                                    <Locate size={15} />
                                    Current Position
                                </div>
                                <LocationPicker
                                    label="Shipment is currently at"
                                    value={currentPos}
                                    onChange={setCurrentPos}
                                    placeholder="Where is the shipment now?"
                                    icon={<Locate size={13} />}
                                    locations={routeNodeIds.map((id) => LOCATIONS.find((l) => l.id === id)).filter(Boolean) as LocationNode[]}
                                />
                            </>
                        )}

                        {/* Disruption Section */}
                        <div className="lp-divider" />
                        <div className="lp-section-title">
                            <AlertTriangle size={15} />
                            Disruption (optional)
                        </div>

                        <LocationPicker
                            label="Disrupted Node"
                            value={disruptionNode}
                            onChange={setDisruptionNode}
                            placeholder="Which node has a disruption?"
                            icon={<AlertTriangle size={13} />}
                        />

                        {disruptionNode && (
                            <div className="lp-disruption-fields">
                                <div className="lp-field">
                                    <label className="lp-field__label">Disruption Type</label>
                                    <select className="lp-field__select" value={disruptionType} onChange={(e) => setDisruptionType(e.target.value)}>
                                        <option>Port Strike</option>
                                        <option>Severe Weather</option>
                                        <option>Port Congestion</option>
                                        <option>Equipment Failure</option>
                                        <option>Security Alert</option>
                                        <option>Customs Delay</option>
                                    </select>
                                </div>
                                <div className="lp-field">
                                    <label className="lp-field__label">Description</label>
                                    <input className="lp-field__input" placeholder="Describe..." value={disruptionDesc} onChange={(e) => setDisruptionDesc(e.target.value)} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="lp-card__footer">
                        <div className="lp-route-preview">
                            {routeNodeIds.length > 0 && (
                                <span className="lp-route-preview__text">
                                    {routeNodeIds.map((id) => LOCATIONS.find((l) => l.id === id)?.name || "?").join(" → ")}
                                </span>
                            )}
                        </div>
                        <button
                            className={`lp-submit ${canSubmit ? "" : "lp-submit--disabled"}`}
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            type="button"
                        >
                            <Send size={15} /> Analyze Route
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
