"use client";

/**
 * Agentic Disruption Shield — Landing Page
 * ==========================================
 * Two operating modes:
 *   🌐 Live Mode — Tavily detects disruptions via real-time web search
 *   🔬 Simulation Mode — Manually inject disruptions for demo
 *
 * Blurred map background with a centered form for:
 * - Mode toggle (Live / Simulation)
 * - Initial node (origin)
 * - Final node (destination)
 * - Intermediate stops
 * - Current position of shipment
 * - Disruption node + reason (simulation mode only)
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
    Globe,
    FlaskConical,
} from "lucide-react";

// ── Types ──
export type OperatingMode = "simulation" | "realtime";

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
    mode: OperatingMode;
}

// ── Indian Ports (matching world branch backend) ──
export const LOCATIONS: LocationNode[] = [
    { id: "N1",  name: "Nhava Sheva (JNPT)", country: "India", type: "port", lat: 18.9490, lng: 72.9510 },
    { id: "N2",  name: "Chennai",             country: "India", type: "port", lat: 13.0827, lng: 80.2707 },
    { id: "N3",  name: "Kochi",               country: "India", type: "port", lat: 9.9312,  lng: 76.2673 },
    { id: "N4",  name: "Visakhapatnam",        country: "India", type: "port", lat: 17.6868, lng: 83.2185 },
    { id: "N5",  name: "Mundra",              country: "India", type: "port", lat: 22.8394, lng: 69.7250 },
    { id: "N6",  name: "Kolkata (Haldia)",    country: "India", type: "port", lat: 22.0257, lng: 88.0583 },
    { id: "N7",  name: "Kandla",              country: "India", type: "port", lat: 23.0333, lng: 70.2167 },
    { id: "N8",  name: "Tuticorin",           country: "India", type: "port", lat: 8.7642,  lng: 78.1348 },
    { id: "N9",  name: "New Mangalore",       country: "India", type: "port", lat: 12.9141, lng: 74.8560 },
    { id: "N10", name: "Paradip",             country: "India", type: "port", lat: 20.2644, lng: 86.6085 },
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
    const [mode, setMode] = useState<OperatingMode>("simulation");
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
            disruption: (mode === "simulation" && disruptNode)
                ? { node: disruptNode, type: disruptionType, description: disruptionDesc || disruptionType }
                : null,
            mode,
        });
    }, [canSubmit, origin, destination, stops, currentPos, disruptionNode, disruptionType, disruptionDesc, mode]);

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
                        <div className="lp-logo__sub">Indian Port Supply Chain Route Planner</div>
                    </div>
                </div>

                {/* Mode Toggle */}
                <div className="lp-mode-toggle">
                    <button
                        className={`lp-mode-btn ${mode === "realtime" ? "lp-mode-btn--active lp-mode-btn--live" : ""}`}
                        onClick={() => setMode("realtime")}
                        type="button"
                    >
                        <Globe size={15} />
                        <span>Live Mode</span>
                        <span className="lp-mode-desc">Tavily web search</span>
                    </button>
                    <button
                        className={`lp-mode-btn ${mode === "simulation" ? "lp-mode-btn--active lp-mode-btn--sim" : ""}`}
                        onClick={() => setMode("simulation")}
                        type="button"
                    >
                        <FlaskConical size={15} />
                        <span>Simulation</span>
                        <span className="lp-mode-desc">Manual injection</span>
                    </button>
                </div>

                {mode === "realtime" && (
                    <div className="lp-mode-banner lp-mode-banner--live">
                        <Globe size={14} />
                        <span><strong>Live Mode:</strong> Tavily will search the web for real-time disruptions at each port in your route.</span>
                    </div>
                )}
                {mode === "simulation" && (
                    <div className="lp-mode-banner lp-mode-banner--sim">
                        <FlaskConical size={14} />
                        <span><strong>Simulation Mode:</strong> Manually inject a disruption to demonstrate a real-world scenario.</span>
                    </div>
                )}

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

                        {/* Disruption Section (Simulation mode only) */}
                        {mode === "simulation" && (
                            <>
                                <div className="lp-divider" />
                                <div className="lp-section-title">
                                    <AlertTriangle size={15} />
                                    Inject Disruption (Simulation)
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
                            </>
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
                            <Send size={15} /> {mode === "realtime" ? "Analyze Route (Live)" : "Analyze Route (Sim)"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
