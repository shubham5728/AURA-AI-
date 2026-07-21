/**
 * The Digital Twin, as a set of physiological systems.
 *
 * Each tab is a different real system -- metabolic, heart, blood, organs,
 * lifestyle -- and switching tabs changes the whole scene: the accent flows
 * through the background, the platform and the highlighted region on the body;
 * that system's own metrics load with a count-up; and the specialist that
 * covers it is named.
 *
 * What makes every tab honest is that all of it comes from the user's own data.
 * A system with no data does not show empty gauges -- it says what to upload to
 * fill it. There are no invented metrics (HRV, VO2 max, stress) because there is
 * no sensor for them, and no invented agents because there are five real roles.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Brain, Dumbbell, Pill, Salad, Stethoscope, TrendingUp } from 'lucide-react';
import type { ComponentType } from 'react';
import { get } from '../../lib/api';
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
        // Open on the first system that actually has data, so a returning user
        // lands on something populated rather than an unlock prompt.
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
    return (
      <main className="page">
        <div className="center"><div className="spinner" /> Loading your Digital Twin…</div>
      </main>
    );
  }
  if (error || !current) {
    return <main className="page"><div className="error">{error || 'Could not load your Digital Twin'}</div></main>;
  }

  const covered = ROLE_META[current.covered_by];
  const anyData = systems.some((s) => s.has_data);

  return (
    <main className="page" style={{ maxWidth: 1120 }}>
      <header className="page-head">
        <div>
          <h1>Digital Twin</h1>
          <p>A living model of your health, one system at a time — built entirely from your own data.</p>
        </div>
      </header>

      {/* Tabs. The active one carries its system's accent. */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        {systems.map((s) => {
          const on = s.key === active;
          return (
            <button key={s.key} onClick={() => setActive(s.key)}
              className="twin-tab"
              style={on
                ? { borderColor: s.accent, background: `${s.accent}1a`, color: 'var(--ink)' }
                : { opacity: s.has_data ? 1 : 0.6 }}>
              <span className="twin-tab-dot" style={{ background: s.accent, opacity: on ? 1 : 0.5 }} />
              {s.label}
            </button>
          );
        })}
      </div>

      <div
        key={active}
        className="twin-scene"
        style={{
          display: 'grid',
          gap: 'var(--space-5)',
          gridTemplateColumns: 'minmax(260px, 360px) 1fr',
          alignItems: 'start',
        }}
      >
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
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-small)', color: '#cfe9ff' }}>
              {current.tagline}
            </p>
          </div>
        </div>

        {/* Right: this system's metrics, or its unlock prompt. */}
        <div>
          {current.has_data ? (
            <div style={{
              display: 'grid', gap: 'var(--space-3)',
              gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
            }}>
              {current.metrics.map((m) => <MetricCard key={m.label} metric={m} />)}
            </div>
          ) : (
            <article className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
              <h3 style={{ marginTop: 0 }}>Nothing to show here yet</h3>
              <p style={{ opacity: 0.8, maxWidth: 420, margin: '0 auto' }}>{current.unlock_hint}</p>
              <button className="btn primary" style={{ marginTop: 'var(--space-4)' }}
                onClick={() => nav('/app/reports')}>
                Upload a report <ArrowRight size={15} />
              </button>
            </article>
          )}

          {/* Who covers this system -- a real specialist, not an invented one. */}
          {covered && (
            <div className="card" style={{
              padding: 'var(--space-4)', marginTop: 'var(--space-4)',
              display: 'flex', gap: 'var(--space-3)', alignItems: 'center',
            }}>
              <div className="file-icon" style={{ color: current.accent }}>
                <covered.Icon size={18} />
              </div>
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

      {!anyData && (
        <p style={{ marginTop: 'var(--space-5)', textAlign: 'center', opacity: 0.7 }}>
          Every system here fills in from your own data. Upload a report or log a day, and
          your Twin starts taking shape.
        </p>
      )}
    </main>
  );
}
