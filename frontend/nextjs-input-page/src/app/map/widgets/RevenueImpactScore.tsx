"use client";

/**
 * RevenueImpactScore Widget
 * =========================
 * Shows estimated revenue loss per day of delay,
 * total projected loss, and a visual risk gauge.
 *
 * Usage:
 *   import RevenueImpactScore from './widgets/RevenueImpactScore';
 *   <RevenueImpactScore
 *     dailyRevenueLoss={8500}
 *     delayDays={5}
 *     shipmentValue={250000}
 *     currency="USD"
 *   />
 */

import React from "react";
import { Activity, Clock, Package, TrendingDown } from "lucide-react";
import "./widgets.css";

export interface RevenueImpactScoreProps {
    /** Estimated revenue lost per day of delay */
    dailyRevenueLoss: number;
    /** Number of delay days */
    delayDays: number;
    /** Total shipment value */
    shipmentValue?: number;
    /** Currency code */
    currency?: string;
}

function formatMoney(val: number, currency = "USD"): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(val);
}

export default function RevenueImpactScore({
    dailyRevenueLoss,
    delayDays,
    shipmentValue = 0,
    currency = "USD",
}: RevenueImpactScoreProps) {
    const totalLoss = dailyRevenueLoss * delayDays;
    const impactPercent = shipmentValue > 0 ? Math.min(Math.round((totalLoss / shipmentValue) * 100), 100) : 0;

    // Risk level
    const riskLevel = impactPercent >= 50 ? "Critical" : impactPercent >= 25 ? "High" : impactPercent >= 10 ? "Medium" : "Low";
    const riskColor = impactPercent >= 50 ? "#dc2626" : impactPercent >= 25 ? "#ea580c" : impactPercent >= 10 ? "#d97706" : "#059669";

    // Gauge angle (0 to 180 degrees)
    const gaugeAngle = Math.min((impactPercent / 100) * 180, 180);

    return (
        <div className="w-card w-revenue">
            <div className="w-card__header">
                <Activity size={16} />
                <h3 className="w-card__title">Revenue Impact Score</h3>
            </div>

            <div className="w-revenue__body">
                {/* Gauge */}
                <div className="w-revenue__gauge-wrap">
                    <svg viewBox="0 0 200 120" className="w-revenue__gauge">
                        {/* Background arc */}
                        <path
                            d="M 20 100 A 80 80 0 0 1 180 100"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="14"
                            strokeLinecap="round"
                        />
                        {/* Filled arc */}
                        <path
                            d="M 20 100 A 80 80 0 0 1 180 100"
                            fill="none"
                            stroke={riskColor}
                            strokeWidth="14"
                            strokeLinecap="round"
                            strokeDasharray={`${(gaugeAngle / 180) * 251.2} 251.2`}
                            style={{ transition: "stroke-dasharray 0.8s ease-out, stroke 0.4s" }}
                        />
                        {/* Center text */}
                        <text x="100" y="85" textAnchor="middle" className="w-revenue__gauge-value" fill={riskColor}>
                            {impactPercent}%
                        </text>
                        <text x="100" y="110" textAnchor="middle" className="w-revenue__gauge-label">
                            {riskLevel} Risk
                        </text>
                    </svg>
                </div>

                {/* Metrics */}
                <div className="w-revenue__metrics">
                    <div className="w-revenue__metric">
                        <Clock size={14} />
                        <div>
                            <span className="w-revenue__metric-label">Daily Loss</span>
                            <span className="w-revenue__metric-value">{formatMoney(dailyRevenueLoss, currency)}/day</span>
                        </div>
                    </div>
                    <div className="w-revenue__metric">
                        <TrendingDown size={14} />
                        <div>
                            <span className="w-revenue__metric-label">Total Projected Loss ({delayDays} days)</span>
                            <span className="w-revenue__metric-value w-revenue__metric-value--red">{formatMoney(totalLoss, currency)}</span>
                        </div>
                    </div>
                    {shipmentValue > 0 && (
                        <div className="w-revenue__metric">
                            <Package size={14} />
                            <div>
                                <span className="w-revenue__metric-label">Shipment Value</span>
                                <span className="w-revenue__metric-value">{formatMoney(shipmentValue, currency)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
