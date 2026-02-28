"use client";

/**
 * Agentic Disruption Shield — Landing Page
 * ==========================================
 * Two operating modes:
 *   🌐 Live Mode — Tavily detects disruptions via real-time web search
 *   🔬 Simulation Mode — Manually inject disruptions for demo
 *
 * City-based input: user enters source city, destination city, and
 * intermediate city stops.  The backend computes optimal multi-modal
 * routes (sea + air) and returns them as blueprint data.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import "./map.css";

import {
    Shield,
    Search,
    Plane,
    AlertTriangle,
    Anchor,
    MapPin,
    Navigation,
    Plus,
    Trash2,
    Send,
    Loader2,
    Globe,
    FlaskConical,
    Package,
    Clock,
    Box,
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

export interface ProductInfo {
    isFragile: boolean;
    hasExpiry: boolean;
    expiryDays: number;
    quantity: number;
    dailyDemand: number;
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
    /** City-based route planning data */
    sourceCity: string;
    destCity: string;
    intermediateCities: string[];
    /** Product details for agent decisions */
    productInfo: ProductInfo;
    /** Selected current and disruption node IDs */
    currentNodeId: string;
    disruptionNodeId: string;
}

// Keep LOCATIONS for backward compat with VisualizationPage map markers
export const LOCATIONS: LocationNode[] = [
    { id: "N1", name: "Nhava Sheva (JNPT)", country: "India", type: "port", lat: 18.9490, lng: 72.9510 },
    { id: "N2", name: "Chennai", country: "India", type: "port", lat: 13.0827, lng: 80.2707 },
    { id: "N3", name: "Kochi", country: "India", type: "port", lat: 9.9312, lng: 76.2673 },
    { id: "N4", name: "Visakhapatnam", country: "India", type: "port", lat: 17.6868, lng: 83.2185 },
    { id: "N5", name: "Mundra", country: "India", type: "port", lat: 22.8394, lng: 69.7250 },
    { id: "N6", name: "Kolkata (Haldia)", country: "India", type: "port", lat: 22.0257, lng: 88.0583 },
    { id: "N7", name: "Kandla", country: "India", type: "port", lat: 23.0333, lng: 70.2167 },
    { id: "N8", name: "Tuticorin", country: "India", type: "port", lat: 8.7642, lng: 78.1348 },
    { id: "N9", name: "New Mangalore", country: "India", type: "port", lat: 12.9141, lng: 74.8560 },
    { id: "N10", name: "Paradip", country: "India", type: "port", lat: 20.2644, lng: 86.6085 },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Dynamic components
const BackgroundMap = dynamic(() => import("./BackgroundMap"), { ssr: false });
const VisualizationPage = dynamic(() => import("./VisualizationPage"), { ssr: false });

// ── City Autocomplete Input ──
interface CityOption {
    city: string;
    state: string;
    lat: number;
    lng: number;
    has_port: boolean;
    has_airport: boolean;
    port_count: number;
    airport_count: number;
}

function CityInput({
    label,
    value,
    onChange,
    placeholder,
    icon,
}: {
    label: string;
    value: string;
    onChange: (city: string) => void;
    placeholder: string;
    icon: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<CityOption[]>([]);
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const fetchCities = useCallback((q: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            if (q.length < 1) { setOptions([]); return; }
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE}/cities?q=${encodeURIComponent(q)}`);
                const data = await res.json();
                setOptions(data.cities || []);
            } catch {
                setOptions([]);
            } finally {
                setLoading(false);
            }
        }, 250);
    }, []);

    return (
        <div className="lp-city-field" ref={ref}>
            <label className="lp-city-field__label">{icon} {label}</label>
            <div className="lp-city-wrap">
                <div className="lp-city-wrap__icon"><Search size={14} /></div>
                <input
                    className="lp-city-input"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        fetchCities(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => { if (value.length >= 1) { fetchCities(value); setOpen(true); } }}
                />
            </div>
            {open && options.length > 0 && (
                <div className="lp-city-dropdown">
                    {options.map((opt, i) => (
                        <button
                            key={i}
                            className="lp-city-option"
                            onClick={() => { onChange(opt.city); setOpen(false); }}
                            type="button"
                        >
                            <MapPin size={13} />
                            <span>{opt.city}</span>
                            <span className="lp-city-option__icons">
                                {opt.has_port && <Anchor size={11} />}
                                {opt.has_airport && <Plane size={11} />}
                            </span>
                            <span className="lp-city-option__state">{opt.state}</span>
                        </button>
                    ))}
                    {loading && <div className="lp-city-option" style={{ justifyContent: "center", opacity: 0.5 }}><Loader2 size={14} className="viz-spinner" /></div>}
                </div>
            )}
        </div>
    );
}

// ── Main Page ──
export default function MapPage() {
    const [mode, setMode] = useState<OperatingMode>("simulation");
    const [sourceCity, setSourceCity] = useState("");
    const [destCity, setDestCity] = useState("");
    const [intermediateCities, setIntermediateCities] = useState<string[]>([]);
    const [disruptionType, setDisruptionType] = useState("Port Strike");
    const [disruptionDesc, setDisruptionDesc] = useState("");
    const [submission, setSubmission] = useState<RouteSubmission | null>(null);

    // Product details state
    const [isFragile, setIsFragile] = useState(false);
    const [hasExpiry, setHasExpiry] = useState(false);
    const [expiryDays, setExpiryDays] = useState("");
    const [quantity, setQuantity] = useState("");
    const [dailyDemand, setDailyDemand] = useState("");

    // Node selection state
    const [selectedCurrentNode, setSelectedCurrentNode] = useState("");
    const [selectedDisruptionNode, setSelectedDisruptionNode] = useState("");

    // Build list of all entered cities for node selection
    const allCities = [sourceCity, ...intermediateCities.filter(c => c.trim()), destCity].filter(c => c.trim().length >= 2);

    const addStop = useCallback(() => setIntermediateCities((prev) => [...prev, ""]), []);
    const removeStop = useCallback((i: number) => setIntermediateCities((prev) => prev.filter((_, idx) => idx !== i)), []);
    const updateStop = useCallback((i: number, val: string) => setIntermediateCities((prev) => prev.map((s, idx) => (idx === i ? val : s))), []);

    const canSubmit = sourceCity.trim().length >= 2 && destCity.trim().length >= 2 && quantity.trim() !== "" && dailyDemand.trim() !== "";

    const handleSubmit = useCallback(() => {
        if (!canSubmit) return;

        // Create minimal LocationNode stubs for the visualization map (actual route nodes come from blueprint)
        const originNode: LocationNode = { id: "src", name: sourceCity, country: "India", type: "port", lat: 20, lng: 78 };
        const destNode: LocationNode = { id: "dst", name: destCity, country: "India", type: "port", lat: 20, lng: 78 };

        setSubmission({
            origin: originNode,
            destination: destNode,
            stops: [],
            currentPosition: null,
            disruption: mode === "simulation" && disruptionDesc
                ? { node: originNode, type: disruptionType, description: disruptionDesc }
                : null,
            mode,
            sourceCity: sourceCity.trim(),
            destCity: destCity.trim(),
            intermediateCities: intermediateCities.filter((c) => c.trim().length > 0),
            productInfo: {
                isFragile,
                hasExpiry,
                expiryDays: hasExpiry ? Number(expiryDays) || 0 : 0,
                quantity: Number(quantity) || 0,
                dailyDemand: Number(dailyDemand) || 0,
            },
            currentNodeId: selectedCurrentNode,
            disruptionNodeId: selectedDisruptionNode,
        });
    }, [canSubmit, sourceCity, destCity, intermediateCities, mode, disruptionType, disruptionDesc, isFragile, hasExpiry, expiryDays, quantity, dailyDemand, selectedCurrentNode, selectedDisruptionNode]);

    if (submission) {
        return <VisualizationPage data={submission} onBack={() => setSubmission(null)} />;
    }

    return (
        <div className="lp">
            <div className="lp-bg"><BackgroundMap /></div>
            <div className="lp-blur-overlay" />

            <div className="lp-center">
                <div className="lp-logo">
                    <Shield size={28} />
                    <div>
                        <div className="lp-logo__title">Disruption Shield</div>
                        <div className="lp-logo__sub">Multi-Modal Supply Chain Route Planner</div>
                    </div>
                </div>

                {/* Mode Toggle */}
                <div className="lp-mode-toggle">
                    <button
                        className={`lp-mode-btn ${mode === "realtime" ? "lp-mode-btn--active lp-mode-btn--live" : ""}`}
                        onClick={() => setMode("realtime")}
                        type="button"
                    >
                        <Globe size={15} /> <span>Live Mode</span>
                    </button>
                    <button
                        className={`lp-mode-btn ${mode === "simulation" ? "lp-mode-btn--active lp-mode-btn--sim" : ""}`}
                        onClick={() => setMode("simulation")}
                        type="button"
                    >
                        <FlaskConical size={15} /> <span>Simulation</span>
                    </button>
                </div>

                {mode === "realtime" && (
                    <div className="lp-mode-banner lp-mode-banner--live">
                        <Globe size={14} />
                        <span><strong>Live Mode:</strong> Tavily searches for real-time disruptions.</span>
                    </div>
                )}
                {mode === "simulation" && (
                    <div className="lp-mode-banner lp-mode-banner--sim">
                        <FlaskConical size={14} />
                        <span><strong>Simulation:</strong> Inject disruptions manually for demo.</span>
                    </div>
                )}

                <div className="lp-cards-row">
                    <div className="lp-card">
                        <div className="lp-card__header">
                            <Navigation size={18} />
                            <h2 className="lp-card__title">Plan Your Route</h2>
                        </div>

                        <div className="lp-card__body">
                            {/* Source City */}
                            <CityInput
                                label="Source City"
                                value={sourceCity}
                                onChange={setSourceCity}
                                placeholder="e.g. Mumbai, New Delhi, Chennai..."
                                icon={<div className="lp-dot lp-dot--green" />}
                            />

                            {/* Intermediate Stops */}
                            <div className="lp-stops">
                                <div className="lp-stops__header">
                                    <span className="lp-stops__label">Intermediate Stops</span>
                                    <button className="lp-add-btn" onClick={addStop} type="button">
                                        <Plus size={14} /> Add Stop
                                    </button>
                                </div>
                                {intermediateCities.map((city, i) => (
                                    <div key={i} className="lp-stop-row" style={{ animationDelay: `${i * 60}ms`, position: "relative", zIndex: 50 - i }}>
                                        <CityInput
                                            label={`Stop ${i + 1}`}
                                            value={city}
                                            onChange={(val) => updateStop(i, val)}
                                            placeholder="Intermediate city..."
                                            icon={<div className="lp-dot lp-dot--blue" />}
                                        />
                                        <button className="lp-remove-btn" onClick={() => removeStop(i)} type="button">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Destination City */}
                            <CityInput
                                label="Destination City"
                                value={destCity}
                                onChange={setDestCity}
                                placeholder="e.g. Kochi, Kolkata, Visakhapatnam..."
                                icon={<div className="lp-dot lp-dot--red" />}
                            />

                            {/* Current & Disruption Node Selectors */}
                            <div className="lp-divider" />
                            <div className="lp-section-title">
                                <MapPin size={15} /> Current Position & Disruption
                            </div>
                            <div className="lp-disruption-fields">
                                <div className="lp-field">
                                    <label className="lp-field__label">📍 Current Node</label>
                                    <select
                                        className="lp-field__select"
                                        value={selectedCurrentNode}
                                        onChange={(e) => setSelectedCurrentNode(e.target.value)}
                                    >
                                        <option value="">Where is the shipment now?</option>
                                        {allCities.map((city, i) => (
                                            <option key={i} value={city}>
                                                {i === 0 ? "[Origin] " : i === allCities.length - 1 ? "[Dest] " : `[Stop ${i}] `}
                                                {city}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="lp-field">
                                    <label className="lp-field__label">⚠️ Disruption Node</label>
                                    <select
                                        className="lp-field__select"
                                        value={selectedDisruptionNode}
                                        onChange={(e) => setSelectedDisruptionNode(e.target.value)}
                                    >
                                        <option value="">Where is the disruption?</option>
                                        {allCities.map((city, i) => (
                                            <option key={i} value={city}>
                                                {i === 0 ? "[Origin] " : i === allCities.length - 1 ? "[Dest] " : `[Stop ${i}] `}
                                                {city}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Disruption (Simulation only) */}
                            {mode === "simulation" && (
                                <>
                                    <div className="lp-divider" />
                                    <div className="lp-section-title">
                                        <AlertTriangle size={15} /> Inject Disruption (Optional)
                                    </div>
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
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="lp-card__footer">
                            <div className="lp-route-preview">
                                {sourceCity && destCity && (
                                    <span className="lp-route-preview__text">
                                        {[sourceCity, ...intermediateCities.filter(Boolean), destCity].join(" → ")}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Product Details Card */}
                    <div className="lp-card lp-product-card">
                        <div className="lp-card__header">
                            <Package size={18} />
                            <h2 className="lp-card__title">Product Details</h2>
                        </div>
                        <div className="lp-card__body">
                            {/* Product Properties */}
                            <div className="lp-section-title" style={{ margin: '0 0 10px 0' }}>
                                <Box size={15} /> Product Properties
                            </div>
                            <div className="lp-product-field lp-product-field--full">
                                <label className="lp-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={isFragile}
                                        onChange={(e) => setIsFragile(e.target.checked)}
                                    />
                                    <AlertTriangle size={14} /> This product is fragile
                                </label>
                            </div>
                            <div className="lp-product-field lp-product-field--full">
                                <label className="lp-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={hasExpiry}
                                        onChange={(e) => setHasExpiry(e.target.checked)}
                                    />
                                    <Clock size={14} /> This product has an expiry date
                                </label>
                                {hasExpiry && (
                                    <input
                                        className="lp-product-field__input"
                                        type="number"
                                        placeholder="Expiry window in days (e.g. 30)"
                                        value={expiryDays}
                                        onChange={(e) => setExpiryDays(e.target.value)}
                                        min="1"
                                        style={{ marginTop: 6 }}
                                    />
                                )}
                            </div>

                            <div className="lp-divider" />

                            {/* Quantity & Demand */}
                            <div className="lp-section-title" style={{ margin: '0 0 8px 0' }}>
                                <Package size={15} /> Shipment Volume
                            </div>
                            <div className="lp-product-grid">
                                {/* Quantity */}
                                <div className="lp-product-field">
                                    <label className="lp-product-field__label">Total Quantity (units)</label>
                                    <input
                                        className="lp-product-field__input"
                                        type="number"
                                        placeholder="e.g. 500"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        min="1"
                                    />
                                </div>

                                {/* Daily Demand */}
                                <div className="lp-product-field">
                                    <label className="lp-product-field__label">Daily Demand (units/day)</label>
                                    <input
                                        className="lp-product-field__input"
                                        type="number"
                                        placeholder="e.g. 50"
                                        value={dailyDemand}
                                        onChange={(e) => setDailyDemand(e.target.value)}
                                        min="1"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="lp-card__footer">
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
        </div>
    );
}
