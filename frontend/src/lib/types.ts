/** Response shapes from the FastAPI backend. Mirrors backend/app/schemas.py. */

export interface Profile {
  dob: string;
  sex: string;
  height_cm: number;
  weight_kg: number;
  conditions: string[];
  allergies: string[];
  goals: string[];
  age: number | null;
  bmi: number | null;
}

export interface Deduction {
  category: string;
  points: number;
  reason: string;
  evidence: string | null;
}

export interface ScoreResponse {
  /** null when there is not enough data. Never assume a number. */
  score: number | null;
  status: 'scored' | 'insufficient_data';
  summary: string;
  max_possible_deduction: number;
  coverage: Record<string, boolean>;
  deductions: Deduction[];
}

export interface Biomarker {
  id: number;
  name: string;
  label: string;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: 'low' | 'normal' | 'high' | 'unknown';
  measured_at: string | null;
}

export interface Report {
  id: number;
  report_type: string;
  parse_status: string;
  parse_error: string | null;
  created_at: string;
  biomarker_count: number;
  abnormal_count: number;
  biomarkers?: Biomarker[];
}

export interface TrendPoint {
  value: number;
  measured_at: string | null;
  flag: string;
  report_id: number;
}

export interface Trend {
  name: string;
  label: string;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  points: TrendPoint[];
}

export interface DailyLog {
  date: string;
  steps: number | null;
  sleep_hours: number | null;
  water_ml: number | null;
  calories_in: number | null;
  calories_out: number | null;
}

export interface Medication {
  id: number;
  drug_name: string;
  dose: string | null;
  schedule: string | null;
  start_date: string | null;
  end_date: string | null;
  /** Derived server-side from the date last marked, so it resets each day. */
  taken_today: boolean;
}

export interface Interaction {
  drugs: string[];
  severity: 'moderate' | 'major';
  description: string;
}

export interface ChatResponse {
  reply: string;
  role_key: string;
  role_label: string;
  routing_method: string;
  routing_confidence: string;
  emergency: boolean;
  context_sections: string[];
  warnings: string[];
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  agent_role: string | null;
}

export interface SimulationChange {
  field: string;
  label: string;
  from: number | null;
  to: number;
}

export interface Simulation {
  current_score: number | null;
  projected_score: number | null;
  delta: number | null;
  changes: SimulationChange[];
  resolved: Deduction[];
  assumption: string;
  horizon: string;
}
