/**
 * Compatibility layer between the UI and the FastAPI backend.
 *
 * The UI was written against a generic table API -- `useResource('metrics')`
 * returned rows straight from a database table. This backend exposes
 * purpose-built endpoints instead (`/api/score` computes a score; it does not
 * dump a table). This module maps one onto the other so the components did not
 * have to be rewritten.
 *
 * Resources with no backend equivalent return an empty list rather than
 * throwing. Those pages then render their empty state, which is honest: there
 * is no data behind them yet. Inventing placeholder rows would make the app
 * look finished while showing users numbers that mean nothing.
 */

import { get, patch } from './api';
import type {
  DailyLog,
  Interaction,
  Medication,
  Report,
  ScoreResponse,
  Trend,
} from './types';

export type Row = Record<string, any>;

const round = (n: number, places = 0) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/** Dashboard metric tiles. */
async function metrics(): Promise<Row[]> {
  const [score, logs] = await Promise.all([
    get<ScoreResponse>('/api/score'),
    get<DailyLog[]>('/api/logs?days=7'),
  ]);

  const rows: Row[] = [];

  // The score tile is identified by name, not position -- the Dashboard finds
  // it with metric === 'Health Score'.
  rows.push({
    id: 'score',
    metric: 'Health Score',
    // null is preserved as an em dash rather than shown as 0. A user with no
    // data has an unknown score, not a terrible one.
    value: score.score ?? '—',
    unit: score.score === null ? '' : '/100',
    change: score.status === 'scored' ? score.summary : 'Not enough data yet',
    trend: [],
  });

  const series = (pick: (log: DailyLog) => number | null) =>
    logs
      .map(pick)
      .filter((v): v is number => v !== null)
      .reverse();

  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  const definitions: Array<[string, string, (l: DailyLog) => number | null, number]> = [
    ['Steps', 'avg/day', (l) => l.steps, 0],
    ['Sleep', 'hrs/night', (l) => l.sleep_hours, 1],
    ['Water', 'ml/day', (l) => l.water_ml, 0],
  ];

  for (const [label, unit, pick, places] of definitions) {
    const values = series(pick);
    const avg = average(values);
    if (avg === null) continue;
    rows.push({
      id: label.toLowerCase(),
      metric: label,
      value: round(avg, places),
      unit,
      change: `${values.length} day${values.length === 1 ? '' : 's'} logged`,
      trend: values,
    });
  }

  return rows;
}

async function medications(): Promise<Row[]> {
  const list = await get<Medication[]>('/api/medications');
  return list.map((m) => ({
    id: m.id,
    name: m.drug_name,
    dose: m.dose || '',
    schedule: m.schedule || 'As prescribed',
    taken: m.taken_today,
  }));
}

async function reports(): Promise<Row[]> {
  const list = await get<Report[]>('/api/reports');

  // Each card shows its extracted values, which live on the detail endpoint.
  const detailed = await Promise.all(
    list.map((r) => get<Report>(`/api/reports/${r.id}`).catch(() => r)),
  );

  return detailed.map((r) => ({
    id: r.id,
    file_name: `Report #${r.id}`,
    status: r.parse_status === 'parsed' ? 'Analyzed' : r.parse_status,
    summary:
      r.parse_error ||
      `${r.biomarker_count} values extracted, ${r.abnormal_count} outside the normal range.`,
    file_url: '#',
    extracted: {
      parameters: (r.biomarkers || []).map((b) => ({
        name: b.label,
        value: `${b.value}${b.unit ? ' ' + b.unit : ''}`,
        // Capitalised to match the CSS class names the cards already use.
        status: b.flag === 'normal' ? 'Normal' : b.flag === 'unknown' ? 'Unknown' : b.flag === 'high' ? 'High' : 'Low',
      })),
    },
  }));
}

/** Risk rows come from the score's deductions -- the same data, ranked. */
async function risks(): Promise<Row[]> {
  const score = await get<ScoreResponse>('/api/score');
  return score.deductions.map((d, i) => ({
    id: i,
    name: d.reason,
    status: d.evidence || '',
    level: d.points >= 8 ? 'High' : d.points >= 4 ? 'Medium' : 'Low',
  }));
}

/** Timeline is built from measurement history rather than a separate table. */
async function timeline(): Promise<Row[]> {
  const trends = await get<Trend[]>('/api/reports/trends');
  const events: Row[] = [];

  for (const trend of trends) {
    const latest = trend.points[trend.points.length - 1];
    if (!latest) continue;
    events.push({
      id: `${trend.name}-${latest.report_id}`,
      time: latest.measured_at || 'Recent',
      title: `${trend.label}: ${latest.value}${trend.unit ? ' ' + trend.unit : ''}`,
      detail:
        latest.flag === 'normal'
          ? 'Within the normal range.'
          : `Flagged ${latest.flag} against the reference range.`,
      sort: latest.measured_at || '',
    });
  }

  return events.sort((a, b) => String(b.sort).localeCompare(String(a.sort))).slice(0, 8);
}

/**
 * The specialist roles, straight from the backend.
 *
 * These are the actual routing targets, not a diagram. If a role is added or
 * renamed server-side, this page changes with it -- which is the difference
 * between showing the architecture and illustrating it.
 */
async function agents(): Promise<Row[]> {
  const roles = await get<Array<{ key: string; label: string; description: string }>>(
    '/api/chat/roles',
  );
  return roles.map((r) => ({
    id: r.key,
    name: r.label,
    role: r.description,
    status: 'Active',
    specialty: r.description,
  }));
}

async function interactions(): Promise<Row[]> {
  const list = await get<Interaction[]>('/api/medications/interactions');
  return list.map((i, index) => ({
    id: index,
    name: `${i.drugs[0]} + ${i.drugs[1]}`,
    status: i.description,
    level: i.severity === 'major' ? 'High' : 'Medium',
  }));
}

/**
 * Resources the UI asks for that this backend does not model.
 *
 * Listed explicitly rather than caught by a default, so adding a real
 * implementation later is a visible change in one place.
 */
const NOT_MODELLED = [
  'appointments',
  'patients',
  'audits',
  'wearables',
  'conditions',
  'simulations',
  'visual_scans',
  'content',
  'emergency_profiles',
  'family_members',
  'health_memories',
  'journey_milestones',
  'wellness_personas',
];

const HANDLERS: Record<string, () => Promise<Row[]>> = {
  metrics,
  medications,
  reports,
  risks,
  timeline,
  interactions,
  agents,
};

export async function fetchResource(resource: string): Promise<Row[]> {
  const handler = HANDLERS[resource];
  if (handler) return handler();
  if (NOT_MODELLED.includes(resource)) return [];

  console.warn(`Unknown resource "${resource}" requested.`);
  return [];
}

export const setMedicationTaken = (id: number, taken: boolean) =>
  patch(`/api/medications/${id}/taken`, { taken });

export class NotConnectedError extends Error {
  constructor(resource: string) {
    super(
      `"${resource}" is not connected to the backend yet, so nothing was saved.`,
    );
  }
}

/**
 * Writes.
 *
 * Only resources with a real backend endpoint are handled. Everything else
 * rejects loudly instead of pretending to succeed -- a save button that
 * silently does nothing is how users end up trusting data that was never
 * stored.
 */
export async function writeResource(
  resource: string,
  options: RequestInit,
): Promise<Row> {
  const body = options.body ? JSON.parse(String(options.body)) : {};

  if (resource === 'medications' && options.method === 'PUT') {
    await setMedicationTaken(Number(body.id), Boolean(body.taken));
    return { ok: true };
  }

  throw new NotConnectedError(resource);
}
