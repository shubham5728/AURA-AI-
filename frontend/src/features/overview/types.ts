/** Shapes returned by GET /api/overview. Mirrors app/routers/overview.py. */

export interface Briefing {
  text: string;
  /** "model" when a model wrote it, "computed" when it was derived. */
  source: 'model' | 'computed';
  score: number | null;
  actions: string[];
}

export interface Metric {
  key: 'steps' | 'sleep' | 'water';
  label: string;
  /** null when nothing has been logged. Not the same as zero. */
  value: number | null;
  unit: string;
  target: number | null;
  /** Days out of the last seven carrying this metric. */
  days_logged: number;
}

export interface Concern {
  category: string;
  reason: string;
  evidence: string | null;
  points: number;
}

export interface Signal {
  label: string;
  value: number;
  unit: string | null;
  flag: 'low' | 'normal' | 'high' | 'unknown';
  measured_at: string | null;
}

export interface TrendPoint {
  date: string;
  score: number;
  assessed_areas: number;
}

export interface ScoreTrend {
  points: TrendPoint[];
  /** null when there is one reading, or when coverage changed across the window. */
  change: number | null;
  compared_with: string | null;
  days_recorded: number;
  coverage_changed: boolean;
}

export interface Overview {
  score: number | null;
  score_status: 'scored' | 'insufficient_data';
  summary: string;
  coverage: Record<string, boolean>;
  briefing: Briefing;
  trend: ScoreTrend;
  metrics: Metric[];
  concerns: Concern[];
  signals: Signal[];
}
