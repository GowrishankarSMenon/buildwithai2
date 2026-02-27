"use client";

/**
 * CostImpactCard Widget
 * =====================
 * Shows three key financial metrics:
 * - Potential loss (if no action taken)
 * - Actual loss (after rerouting)
 * - Amount saved (by using our solution)
 *
 * Usage:
 *   import CostImpactCard from './widgets/CostImpactCard';
 *   <CostImpactCard
 *     potentialLoss={45000}
 *     actualLoss={12000}
 *     currency="USD"
 *     delayDays={5}
 *   />
 */

import React from "react";
import { TrendingDown, TrendingUp, Shield, DollarSign, AlertTriangle, CheckCircle2 } from "lucide-react";
import "./widgets.css";

export interface CostImpactCardProps {
    /** Total estimated loss if disruption was not handled (no reroute) */
    potentialLoss: number;
    /** Actual loss after rerouting (reduced cost) */
    actualLoss: number;
    /** Currency code */
    currency?: string;
    /** Number of delay days caused by disruption */
    delayDays?: number;
    /** Optional: label for the disruption cause */
    disruptionType?: string;
}

function formatMoney(val: number, currency = "USD"): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(val);
}

export default function CostImpactCard({
    potentialLoss,
    actualLoss,
    currency = "USD",
    delayDays,
    disruptionType,
}: CostImpactCardProps) {
    const saved = potentialLoss - actualLoss;
    const savingsPercent = potentialLoss > 0 ? Math.round((saved / potentialLoss) * 100) : 0;

    return (
        <div className="w-card w-cost">
            <div className="w-card__header">
                <DollarSign size={16} />
                <h3 className="w-card__title">Cost Impact Analysis</h3>
            </div>

            {disruptionType && (
                <div className="w-cost__cause">
                    <AlertTriangle size={12} />
                    <span>Disruption: {disruptionType}</span>
                    {delayDays !== undefined && <span className="w-cost__delay">+{delayDays} days delay</span>}
                </div>
            )}

            <div className="w-cost__grid">
                {/* Potential Loss */}
                <div className="w-cost__metric w-cost__metric--red">
                    <div className="w-cost__metric-icon">
                        <TrendingDown size={18} />
                    </div>
                    <div className="w-cost__metric-info">
                        <span className="w-cost__metric-label">Potential Loss</span>
                        <span className="w-cost__metric-value">{formatMoney(potentialLoss, currency)}</span>
                        <span className="w-cost__metric-desc">If no action taken</span>
                    </div>
                </div>

                {/* Actual Loss */}
                <div className="w-cost__metric w-cost__metric--amber">
                    <div className="w-cost__metric-icon">
                        <AlertTriangle size={18} />
                    </div>
                    <div className="w-cost__metric-info">
                        <span className="w-cost__metric-label">Actual Loss</span>
                        <span className="w-cost__metric-value">{formatMoney(actualLoss, currency)}</span>
                        <span className="w-cost__metric-desc">After rerouting</span>
                    </div>
                </div>

                {/* Saved */}
                <div className="w-cost__metric w-cost__metric--green">
                    <div className="w-cost__metric-icon">
                        <Shield size={18} />
                    </div>
                    <div className="w-cost__metric-info">
                        <span className="w-cost__metric-label">Saved by Solution</span>
                        <span className="w-cost__metric-value">{formatMoney(saved, currency)}</span>
                        <span className="w-cost__metric-desc">{savingsPercent}% cost reduction</span>
                    </div>
                </div>
            </div>

            {/* Savings bar */}
            <div className="w-cost__bar-wrap">
                <div className="w-cost__bar-labels">
                    <span>Loss Mitigated</span>
                    <span className="w-cost__bar-pct">{savingsPercent}%</span>
                </div>
                <div className="w-cost__bar">
                    <div className="w-cost__bar-fill" style={{ width: `${savingsPercent}%` }} />
                </div>
            </div>
        </div>
    );
}
