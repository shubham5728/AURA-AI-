/**
 * Shared visual tokens.
 *
 * The audit found the same four status colours redefined across six files --
 * BiomarkerRow, TrendChart, TracePanel, Reports, Hereditary and twin/status.
 * Six copies of "amber means out of range" is six places for them to drift, and
 * a colour that means one thing on the report card and another on the dashboard
 * is worse than no colour at all.
 *
 * These are the semantic layer only. Sizing and spacing already live as CSS
 * custom properties in index.css (--text-*, --space-*, --w-*); this file exists
 * because those cannot be read from TypeScript when a value has to be passed to
 * an SVG attribute or an inline style.
 */

export type HealthStatus = 'good' | 'attention' | 'urgent' | 'unknown';

export const STATUS_COLOUR: Record<HealthStatus, string> = {
  good: '#16a34a',
  attention: '#d97706',
  urgent: '#dc2626',
  unknown: '#94a3b8',
};

/** Faint fill of the same hue, for row tints and chip backgrounds. */
export const STATUS_TINT: Record<HealthStatus, string> = {
  good: 'rgba(22,163,74,0.10)',
  attention: 'rgba(217,119,6,0.10)',
  urgent: 'rgba(220,38,38,0.10)',
  unknown: 'rgba(148,163,184,0.10)',
};

/**
 * Maps a biomarker flag to a status.
 *
 * Both "low" and "high" are `attention` rather than one being worse: outside
 * the reference range is outside it, and ranking the direction would be a
 * clinical judgement this product does not make.
 */
export function statusForFlag(flag: string): HealthStatus {
  if (flag === 'low' || flag === 'high') return 'attention';
  if (flag === 'normal') return 'good';
  return 'unknown';
}

/** Maps a score deduction's weight to a status. */
export function statusForPoints(points: number): HealthStatus {
  if (points >= 8) return 'attention';
  return 'unknown';
}
