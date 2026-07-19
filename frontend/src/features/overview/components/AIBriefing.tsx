/**
 * The narrative and what to do next.
 *
 * The previous version listed three fixed instructions -- drink 2L water, walk
 * 30 minutes, sleep before 11 -- identical for every user regardless of their
 * data. These come from the score's own deductions, so someone already meeting
 * their hydration target is not told to drink more.
 *
 * The source of the text is stated. When a model writes it, it says so; when
 * the text is derived because generation was unavailable or failed its checks,
 * it says that instead. Passing fallback text off as AI insight would be a
 * small lie that makes every other claim in the product harder to believe.
 */

import { Check, Cpu, Sigma } from 'lucide-react';
import type { Briefing } from '../types';

export default function AIBriefing({ briefing }: { briefing: Briefing }) {
  const fromModel = briefing.source === 'model';

  return (
    <article className="card" style={{ padding: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)' }}>
        <span className="card-label">YOUR BRIEFING</span>
        <small style={{ opacity: 0.6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {fromModel ? <Cpu size={12} /> : <Sigma size={12} />}
          {fromModel ? 'Written by AURA' : 'Calculated from your data'}
        </small>
      </div>

      <p className="t-lead" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
        {briefing.text}
      </p>

      {briefing.actions.length > 0 && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <span className="card-label">WHAT TO DO NEXT</span>
          <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-3) 0 0' }}>
            {briefing.actions.map((action) => (
              <li key={action} style={{
                display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                padding: 'var(--space-2) 0',
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                  display: 'grid', placeItems: 'center', marginTop: 1,
                  background: 'rgba(56,132,232,0.12)', color: 'var(--blue)',
                }}>
                  <Check size={12} />
                </span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
