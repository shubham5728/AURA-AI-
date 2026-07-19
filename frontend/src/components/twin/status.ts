/**
 * Agent status, derived from a real trace.
 *
 * The statuses here are the ones the system can actually be in. AURA's roles
 * are not long-running processes -- one is selected per message, it runs, it
 * returns. There is no background "thinking" to display, and no agent-to-agent
 * traffic, because the Digital Twin Core is deliberately the only resolving
 * layer.
 *
 * So nothing on this screen animates on a timer. Every state below is read
 * from a trace the server produced while answering a real question: which role
 * was chosen, by what margin, what data it was given, how long each step took,
 * and whether the reply was flagged. An indicator that pulsed on its own would
 * be inventing system state, which is the one thing a health product cannot
 * afford to do with its own diagnostics.
 */

import type { Trace, TraceStage } from '../../lib/types';

export type AgentStatus =
  /** Not selected for this question. */
  | 'idle'
  /** The router is deciding; every role is briefly a candidate. */
  | 'considered'
  /** Chosen, and its context is being assembled. */
  | 'receiving'
  /** Chosen, and the model is generating its reply. */
  | 'processing'
  /** Finished. */
  | 'completed'
  /** Finished, but the reply tripped a safety check. */
  | 'flagged';

export const STATUS_META: Record<AgentStatus, { label: string; colour: string }> = {
  idle: { label: 'Idle', colour: '#64748b' },
  considered: { label: 'Considered', colour: '#7dd3fc' },
  receiving: { label: 'Receiving context', colour: '#38bdf8' },
  processing: { label: 'Reasoning', colour: '#3b82f6' },
  completed: { label: 'Answered', colour: '#16a34a' },
  flagged: { label: 'Needs attention', colour: '#d97706' },
};

export interface AgentState {
  status: AgentStatus;
  /** Keyword score from the router. Absent when the model decided instead. */
  score?: number;
  /** Share of the winning score, 0-1. Drives emphasis, not a probability. */
  relative: number;
  /** Real elapsed milliseconds attributable to this role, if it ran. */
  ms?: number;
  sections?: string[];
  withheld?: string[];
}

const stageBy = (trace: Trace, name: TraceStage['name']) =>
  trace.stages.find((s) => s.name === name);

/**
 * Agent states at a given point in a trace replay.
 *
 * `upto` is the index of the last stage revealed, so the caller can step
 * through the pipeline at the pace it actually ran.
 */
export function statesAt(
  trace: Trace | null,
  roleKeys: string[],
  upto: number,
): Record<string, AgentState> {
  const base: Record<string, AgentState> = {};
  for (const key of roleKeys) base[key] = { status: 'idle', relative: 0 };
  if (!trace) return base;

  const revealed = trace.stages.slice(0, upto + 1);
  const seen = (name: TraceStage['name']) => revealed.some((s) => s.name === name);

  const routing = stageBy(trace, 'routing');
  const context = stageBy(trace, 'context');
  const generation = stageBy(trace, 'generation');
  const safetyOut = stageBy(trace, 'safety_out');

  const chosen = routing?.data.chosen;
  const scores = routing?.data.scores ?? {};
  const best = Math.max(...Object.values(scores), 1);

  for (const key of roleKeys) {
    const score = scores[key];
    if (score !== undefined) {
      base[key].score = score;
      base[key].relative = score / best;
    }
  }

  // An emergency trace has only the safety stage. Every role stays idle, which
  // is the honest picture: none of them ran.
  if (!seen('routing')) return base;

  // While routing is the newest stage, roles with any keyword evidence are
  // candidates -- that is what the router was weighing.
  if (!seen('context')) {
    for (const key of roleKeys) {
      if ((base[key].score ?? 0) > 0) base[key].status = 'considered';
    }
    if (chosen) base[chosen].status = 'considered';
    return base;
  }

  if (!chosen || !base[chosen]) return base;

  base[chosen].sections = context?.data.sections ?? [];
  base[chosen].withheld = context?.data.withheld ?? [];

  if (!seen('generation')) {
    base[chosen].status = 'receiving';
    return base;
  }

  if (!seen('safety_out')) {
    base[chosen].status = 'processing';
    base[chosen].ms = generation?.ms;
    return base;
  }

  const flagged = (safetyOut?.data.warnings?.length ?? 0) > 0;
  base[chosen].status = flagged ? 'flagged' : 'completed';
  base[chosen].ms = (context?.ms ?? 0) + (generation?.ms ?? 0);
  return base;
}

/** The role the trace routed to, if any. */
export function chosenRole(trace: Trace | null): string | null {
  return stageBy(trace ?? ({ stages: [] } as unknown as Trace), 'routing')?.data.chosen ?? null;
}
