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
}

export type BodyRegion = 'core' | 'chest' | 'torso' | 'abdomen' | 'legs';

export interface TwinSystem {
  key: string;
  label: string;
  tagline: string;
  accent: string;
  region: BodyRegion;
  /** The specialist role that covers this system, from the real five. */
  covered_by: string;
  has_data: boolean;
  unlock_hint: string;
  metrics: TwinMetric[];
}
