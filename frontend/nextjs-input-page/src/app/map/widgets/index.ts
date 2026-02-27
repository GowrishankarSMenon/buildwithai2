/**
 * Widgets — Barrel Export
 * =======================
 * Import all widgets from a single path:
 *   import { CostImpactCard, RevenueImpactScore, TransitTimeComparison } from './widgets';
 */

export { default as CostImpactCard } from './CostImpactCard';
export { default as RevenueImpactScore } from './RevenueImpactScore';
export { default as TransitTimeComparison } from './TransitTimeComparison';

export type { CostImpactCardProps } from './CostImpactCard';
export type { RevenueImpactScoreProps } from './RevenueImpactScore';
export type { TransitTimeComparisonProps, RouteSegment } from './TransitTimeComparison';
