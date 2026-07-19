/**
 * The latest lab results, abnormal ones first.
 *
 * Answers "what changed?". Sorted by whether a value is outside its range
 * rather than alphabetically, which is how the previous timeline ordered them
 * -- so on a panel of sixteen results the two that mattered appeared wherever
 * the alphabet put them.
 */

import { useNavigate } from 'react-router-dom';
import { ArrowRight, FlaskConical } from 'lucide-react';
import Chip from '../../../components/ui/Chip';
import { statusForFlag } from '../../../components/ui/tokens';
import type { Signal } from '../types';

export default function RecentSignals({ signals }: { signals: Signal[] }) {
  const nav = useNavigate();

  if (signals.length === 0) {
    return (
      <article className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
        <span className="card-label">LATEST RESULTS</span>
        <p style={{ opacity: 0.75, margin: 'var(--space-3) 0 var(--space-4)' }}>
          No lab results yet. Upload a report and AURA will read the values and explain
          them in plain language.
        </p>
        <button className="btn primary" onClick={() => nav('/app/reports')}>
          <FlaskConical size={16} /> Upload a report
        </button>
      </article>
    );
  }

  return (
    <article className="card" style={{ padding: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="card-label">LATEST RESULTS</span>
        <button className="btn ghost" style={{ padding: '4px 10px' }}
          onClick={() => nav('/app/trends')}>
          Trends <ArrowRight size={13} />
        </button>
      </div>

      <div style={{
        display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-4)',
        gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
      }}>
        {signals.map((signal) => (
          <div key={signal.label} style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <small style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {signal.label}
              </small>
              <Chip status={statusForFlag(signal.flag)}>
                {signal.flag === 'normal' ? 'normal' : signal.flag}
              </Chip>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
              <b style={{ fontSize: 'var(--text-card)' }}>{signal.value.toLocaleString()}</b>
              {signal.unit && <small style={{ opacity: 0.6 }}>{signal.unit}</small>}
            </div>
            {signal.measured_at && (
              <small style={{ opacity: 0.55 }}>{signal.measured_at}</small>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}
