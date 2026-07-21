/**
 * The Digital Twin, as a set of connected physiological systems.
 *
 * The redesign answers a real critique: the old version was a biomarker viewer
 * with isolated cards. Each system now leads with a one-glance verdict, states
 * what it looked for and did not find, shows each value with its meaning and its
 * history, and names the other systems it bears on -- which are clickable, so
 * the tabs read as connected rather than independent.
 *
 * Everything remains the user's own data. What is deliberately absent -- a
 * confidence percentage, an "analysed at 9:42" timestamp, predicted values,
 * age-group comparison, wearable provenance -- is absent because there is no
 * data behind it. The honest substitute for confidence is the list of markers
 * this system could not measure.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Dumbbell, Link2, Pill, Salad,
  ShieldCheck, Stethoscope, TrendingUp,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { get } from '../../lib/api';
import { STATUS_COLOUR } from '../../components/ui/tokens';
import MetricCard from './MetricCard';
import TwinAvatar from './TwinAvatar';
import type { TwinSystem } from './types';

const ROLE_META: Record<string, { label: string; Icon: ComponentType<{ size?: number }> }> = {
  doctor: { label: 'General Health', Icon: Stethoscope },
  nutrition: { label: 'Nutrition', Icon: Salad },
  fitness: { label: 'Fitness', Icon: Dumbbell },
  medication: { label: 'Medication', Icon: Pill },
  prediction: { label: 'Health Trends', Icon: TrendingUp },
};

export default function TwinPage() {
  const nav = useNavigate();
  const [systems, setSystems] = useState<TwinSystem[]>([]);
  const [active, setActive] = useState<string>('metabolic');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    get<TwinSystem[]>('/api/twin/systems')
      .then((s) => {
        setSystems(s);
        const withData = s.find((sys) => sys.has_data);
        if (withData) setActive(withData.key);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const current = useMemo(
    () => systems.find((s) => s.key === active) ?? systems[0],
    [systems, active],
  );

  if (loading) {
    return <main className="page"><div className="center"><div className="spinner" /> Loading your Digital Twin…</div></main>;
  }
  if (error || !current) {
    return <main className="page"><div className="error">{error || 'Could not load your Digital Twin'}</div></main>;
  }

  const covered = ROLE_META[current.covered_by];
  const summaryColour = STATUS_COLOUR[current.summary.tone === 'none' ? 'unknown' : current.summary.tone];
  const SummaryIcon = current.summary.tone === 'attention' ? AlertTriangle : ShieldCheck;

  return (
    <main className="page" style={{ maxWidth: 1180 }}>
      <header className="page-head">
        <div>
          <h1>Digital Twin</h1>
          <p>A living model of your health, one system at a time — built entirely from your own data.</p>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        {systems.map((s) => {
          const on = s.key === active;
          return (
            <button key={s.key} onClick={() => setActive(s.key)} className="twin-tab"
              style={on ? { borderColor: s.accent, background: `${s.accent}1a`, color: 'var(--ink)' } : undefined}>
              <span className="twin-tab-dot" style={{ background: s.accent, opacity: on ? 1 : 0.5 }} />
              {s.label}
              {!s.has_data && <span className="twin-tab-lock">empty</span>}
            </button>
          );
        })}
      </div>

      <div key={active} className="twin-scene"
        style={{ display: 'grid', gap: 'var(--space-5)', gridTemplateColumns: 'minmax(240px, 320px) 1fr', alignItems: 'start' }}>

        {/* Left: the body, tinted to the active system. */}
        <div className="card" style={{
          padding: 'var(--space-4)',
          background: `linear-gradient(170deg, #06162e, ${current.accent}18 60%, #08203c)`,
          border: `1px solid ${current.accent}33`,
          transition: 'background .5s ease, border-color .5s ease',
        }}>
          <TwinAvatar accent={current.accent} region={current.region} whole={!current.has_data} />
          <div style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
            <b style={{ color: current.accent }}>{current.label}</b>
            {/* Why this system matters, so the tab is not just a label. */}
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-small)', color: '#cfe9ff', lineHeight: 1.5 }}>
              {current.purpose || current.tagline}
            </p>
          </div>
        </div>

        {/* Right. */}
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {current.has_data ? (
            <>
              {/* System verdict, so the cards need not be read one by one. */}
              <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: `${summaryColour}1a`, color: summaryColour, flexShrink: 0 }}>
                  <SummaryIcon size={17} />
                </span>
                <div style={{ flex: 1 }}>
                  <b>{current.summary.headline}</b>
                  <div style={{ fontSize: 'var(--text-small)', opacity: 0.7 }}>
                    {current.measured} measured{current.latest_date ? ` · latest ${current.latest_date}` : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-3)', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
                {current.metrics.map((m) => <MetricCard key={m.label} metric={m} accent={current.accent} />)}
              </div>

              {/* The honest stand-in for a confidence score. */}
              {current.missing.length > 0 && (
                <div className="card" style={{ padding: 'var(--space-4)', fontSize: 'var(--text-small)' }}>
                  <b style={{ opacity: 0.8 }}>Interpretation may be incomplete</b>
                  <p style={{ margin: '4px 0 0', opacity: 0.72 }}>
                    This system also looks at {current.missing.join(', ')}, which
                    {current.missing.length === 1 ? ' has' : ' have'} not been measured. Add
                    a report covering {current.missing.length === 1 ? 'it' : 'them'} for a fuller picture.
                  </p>
                </div>
              )}
            </>
          ) : (
            <article className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
              <h3 style={{ marginTop: 0 }}>Nothing to show here yet</h3>
              <p style={{ opacity: 0.8, maxWidth: 420, margin: '0 auto' }}>{current.unlock_hint}</p>
              <button className="btn primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => nav('/app/reports')}>
                Upload a report <ArrowRight size={15} />
              </button>
            </article>
          )}

          {/* Connected systems -- the Twin behaving as a Twin, not five islands. */}
          {current.relates_to.length > 0 && (
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <span className="card-label"><Link2 size={13} /> HOW THIS CONNECTS</span>
              <div style={{ marginTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                {current.relates_to.map((rel) => (
                  <button key={rel.key} onClick={() => setActive(rel.key)} className="twin-related">
                    <span style={{ flex: 1, textAlign: 'left' }}>
                      <b>{rel.label}</b>
                      <span style={{ display: 'block', fontSize: 'var(--text-small)', opacity: 0.7 }}>{rel.why}</span>
                    </span>
                    <ArrowRight size={15} style={{ flexShrink: 0, opacity: 0.5 }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Who covers this system -- a real specialist, no invented timestamp. */}
          {covered && (
            <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <div className="file-icon" style={{ color: current.accent }}><covered.Icon size={18} /></div>
              <div style={{ flex: 1 }}>
                <small style={{ opacity: 0.6 }}>Covered by</small>
                <div style={{ fontWeight: 'var(--w-semibold)' }}>{covered.label} specialist</div>
              </div>
              <button className="btn ghost" onClick={() => nav('/app/companion')}>
                Ask about this <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
