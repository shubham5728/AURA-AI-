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

import { useNavigate } from 'react-router-dom';
import { AlertTriangle, MessageCircle, ShieldCheck } from 'lucide-react';
import { STATUS_COLOUR, STATUS_TINT, statusForPoints } from '../../../components/ui/tokens';
import { stashChatDraft } from '../../../lib/chatHandoff';
import type { Concern } from '../types';

export default function RiskMonitor({ concerns }: { concerns: Concern[] }) {
  const nav = useNavigate();

  // Turn a concern into a conversation with the companion, which reads the same
  // health data this panel was built from. The evidence is carried along so the
  // chat starts with the actual measurement, not a vague "tell me more".
  const ask = (concern: Concern) => {
    stashChatDraft(
      `On my overview it says "${concern.reason}"` +
      `${concern.evidence ? ` (${concern.evidence})` : ''}. ` +
      `Can you explain what this means and what I can do about it?`,
    );
    nav('/app/companion');
  };

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
                  <button onClick={() => ask(concern)} style={{
                    marginTop: 6, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    color: 'var(--accent, #2563eb)', font: 'inherit', fontSize: 'var(--text-small)',
                  }}>
                    <MessageCircle size={13} /> Ask AURA
                  </button>
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
