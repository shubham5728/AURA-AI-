/**
 * What is currently costing the score, and why.
 *
 * Answers "should I worry?" and "why?" together. Each row is a real deduction
 * with the evidence that produced it, so nothing appears without a reason
 * attached -- the previous risk panel rendered rows from a table that was
 * always empty, so it showed a heading over nothing.
 *
 * Ordered by weight, because the largest factor is the one worth acting on.
 */

import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { STATUS_COLOUR, STATUS_TINT, statusForPoints } from '../../../components/ui/tokens';
import type { Concern } from '../types';

export default function RiskMonitor({ concerns }: { concerns: Concern[] }) {
  return (
    <article className="card" style={{ padding: 'var(--space-5)' }}>
      <span className="card-label">WHAT NEEDS ATTENTION</span>

      {concerns.length === 0 ? (
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', marginTop: 'var(--space-3)' }}>
          <ShieldCheck size={18} style={{ color: STATUS_COLOUR.good, flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, opacity: 0.8 }}>
            Nothing is currently reducing your score. This reflects the areas that have
            been assessed — not the ones with no data.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--space-3)' }}>
          {concerns.map((concern, i) => {
            const status = statusForPoints(concern.points);
            return (
              <div key={`${concern.category}-${i}`} style={{
                display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
                padding: 'var(--space-3) 0',
                borderTop: i === 0 ? undefined : '1px solid rgba(128,128,128,0.12)',
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                  background: STATUS_TINT[status], color: STATUS_COLOUR[status],
                }}>
                  <AlertTriangle size={13} />
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'var(--w-semibold)' }}>{concern.reason}</div>
                  {/* The measurement behind the claim. A concern without its
                      evidence is an opinion. */}
                  {concern.evidence && (
                    <small style={{ opacity: 0.7, display: 'block', marginTop: 2 }}>
                      {concern.evidence}
                    </small>
                  )}
                </div>

                <small style={{ opacity: 0.55, whiteSpace: 'nowrap' }}>
                  −{concern.points}
                </small>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
