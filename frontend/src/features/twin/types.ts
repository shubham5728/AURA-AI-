/** Shapes from GET /api/twin/systems. Mirrors app/services/twin_systems.py. */

export interface TwinMetric {
  label: string;
  /** null when this has not been measured. Never shown as zero. */
  value: number | null;
  unit: string;
  status: 'good' | 'attention' | 'unknown' | 'none';
  detail: string;
  /** True for BMI and BMR, which AURA derives rather than reads. */
  computed: boolean;
  /** What the test measures, in plain language. */
  explanation: string;
  /** Past readings, oldest first, for a sparkline. Empty when there is one. */
  history: number[];
  /** Movement toward or away from the range, when there is history. */
  direction: 'improving' | 'declining' | 'steady' | '';
  /** Inside the range but near a bound. */
  near_edge: boolean;
}

export type BodyRegion = 'core' | 'chest' | 'torso' | 'abdomen' | 'legs';

export interface RelatedSystem {
  key: string;
  label: string;
  why: string;
}

export interface SystemSummary {
  headline: string;
  tone: 'good' | 'attention' | 'none';
}

export interface TwinSystem {
  key: string;
  label: string;
  tagline: string;
  purpose: string;
  accent: string;
  region: BodyRegion;
  covered_by: string;
  has_data: boolean;
  unlock_hint: string;
  measured: number;
  abnormal: number;
  latest_date: string | null;
  /** Markers this system looks for that were not measured. */
  missing: string[];
  summary: SystemSummary;
  relates_to: RelatedSystem[];
  metrics: TwinMetric[];
}
