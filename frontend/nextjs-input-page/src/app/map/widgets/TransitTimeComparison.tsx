"use client";

/**
 * TransitTimeComparison Widget
 * ============================
 * Side-by-side horizontal bar chart comparing
 * original route vs alternative route transit times per segment.
 *
 * Usage:
 *   import TransitTimeComparison from './widgets/TransitTimeComparison';
 *   <TransitTimeComparison
 *     originalSegments={[
 *       { from: "Shanghai", to: "Singapore", days: 4 },
 *       { from: "Singapore", to: "Rotterdam", days: 18 },
 *     ]}
 *     alternativeSegments={[
 *       { from: "Shanghai", to: "Colombo", days: 6 },
 *       { from: "Colombo", to: "Rotterdam", days: 16 },
 *     ]}
 *     disruptedSegment="Singapore"
 *   />
 */

import React, { useMemo } from "react";
import { GitCompare, Clock, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import "./widgets.css";

export interface RouteSegment {
    from: string;
    to: string;
    /** Transit time in days */
    days: number;
    /** Is this segment disrupted? */
    disrupted?: boolean;
}

export interface TransitTimeComparisonProps {
    originalSegments: RouteSegment[];
    alternativeSegments: RouteSegment[];
    /** Name of the disrupted node (to highlight) */
    disruptedSegment?: string;
}

export default function TransitTimeComparison({
    originalSegments,
    alternativeSegments,
    disruptedSegment,
}: TransitTimeComparisonProps) {
    const originalTotal = useMemo(() => originalSegments.reduce((s, seg) => s + seg.days, 0), [originalSegments]);
    const altTotal = useMemo(() => alternativeSegments.reduce((s, seg) => s + seg.days, 0), [alternativeSegments]);
    const maxDays = useMemo(() => Math.max(...originalSegments.map((s) => s.days), ...alternativeSegments.map((s) => s.days), 1), [originalSegments, alternativeSegments]);
    const timeDiff = originalTotal - altTotal;

    return (
        <div className="w-card w-transit">
            <div className="w-card__header">
                <GitCompare size={16} />
                <h3 className="w-card__title">Transit Time Comparison</h3>
            </div>

            {/* Summary row */}
            <div className="w-transit__summary">
                <div className="w-transit__summary-item">
                    <span className="w-transit__summary-label">Original Route</span>
                    <span className="w-transit__summary-val w-transit__summary-val--original">{originalTotal} days</span>
                </div>
                <div className="w-transit__summary-vs">vs</div>
                <div className="w-transit__summary-item">
                    <span className="w-transit__summary-label">Alternative Route</span>
                    <span className="w-transit__summary-val w-transit__summary-val--alt">{altTotal} days</span>
                </div>
                <div className={`w-transit__summary-diff ${timeDiff > 0 ? "w-transit__summary-diff--saved" : timeDiff < 0 ? "w-transit__summary-diff--extra" : ""}`}>
                    {timeDiff > 0 ? (
                        <><CheckCircle2 size={13} /> {timeDiff}d faster</>
                    ) : timeDiff < 0 ? (
                        <><AlertTriangle size={13} /> {Math.abs(timeDiff)}d slower</>
                    ) : (
                        <>Same duration</>
                    )}
                </div>
            </div>

            {/* Original segments */}
            <div className="w-transit__section">
                <div className="w-transit__section-header">
                    <span className="w-transit__section-dot w-transit__section-dot--original" />
                    Original Route
                </div>
                {originalSegments.map((seg, i) => {
                    const isDisrupted = disruptedSegment && (seg.from === disruptedSegment || seg.to === disruptedSegment);
                    return (
                        <div key={`orig-${i}`} className={`w-transit__bar-row ${isDisrupted ? "w-transit__bar-row--disrupted" : ""}`}>
                            <div className="w-transit__bar-label">
                                <span>{seg.from}</span>
                                <ArrowRight size={10} />
                                <span>{seg.to}</span>
                            </div>
                            <div className="w-transit__bar-track">
                                <div
                                    className={`w-transit__bar-fill ${isDisrupted ? "w-transit__bar-fill--disrupted" : "w-transit__bar-fill--original"}`}
                                    style={{ width: `${(seg.days / maxDays) * 100}%` }}
                                />
                            </div>
                            <span className="w-transit__bar-val">{seg.days}d</span>
                            {isDisrupted && <AlertTriangle size={12} className="w-transit__bar-warn" />}
                        </div>
                    );
                })}
            </div>

            {/* Alternative segments */}
            <div className="w-transit__section">
                <div className="w-transit__section-header">
                    <span className="w-transit__section-dot w-transit__section-dot--alt" />
                    Alternative Route
                </div>
                {alternativeSegments.map((seg, i) => (
                    <div key={`alt-${i}`} className="w-transit__bar-row">
                        <div className="w-transit__bar-label">
                            <span>{seg.from}</span>
                            <ArrowRight size={10} />
                            <span>{seg.to}</span>
                        </div>
                        <div className="w-transit__bar-track">
                            <div
                                className="w-transit__bar-fill w-transit__bar-fill--alt"
                                style={{ width: `${(seg.days / maxDays) * 100}%` }}
                            />
                        </div>
                        <span className="w-transit__bar-val">{seg.days}d</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
