/**
 * Steps, sleep and water against their targets.
 *
 * Each tile states how many of the last seven days it is averaged over. One
 * logged day showing 3,000 steps is a different claim from seven days of it,
 * and a bar with no denominator invites the stronger reading.
 *
 * Nothing is shown for a metric with no data. The previous dashboard printed
 * "Water low · 1.8L / 2.5L" for a user who had never logged anything, which was
 * a measurement of nobody.
 */

import { useNavigate } from 'react-router-dom';
import { Droplets, Footprints, Moon, Plus } from 'lucide-react';
import type { ComponentType } from 'react';
import { STATUS_COLOUR } from '../../../components/ui/tokens';
import type { Metric } from '../types';

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  steps: Footprints,
  sleep: Moon,
  water: Droplets,
};

function format(metric: Metric): string {
  if (metric.value === null) return '—';
  if (metric.key === 'sleep') return metric.value.toFixed(1);
  return Math.round(metric.value).toLocaleString();
}

export default function TodayMetrics({ metrics }: { metrics: Metric[] }) {
  const nav = useNavigate();
  const anyLogged = metrics.some((m) => m.value !== null);

  if (!anyLogged) {
    return (
      <article className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
        <span className="card-label">DAILY HABITS</span>
        <p style={{ opacity: 0.75, margin: 'var(--space-3) 0 var(--space-4)' }}>
          Nothing logged yet. Sleep, steps and hydration are three of the six areas
          your score is built from.
        </p>
        <button className="btn primary" onClick={() => nav('/app/log')}>
          <Plus size={16} /> Log your day
        </button>
      </article>
    );
  }

  return (
    <article className="card" style={{ padding: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="card-label">DAILY HABITS</span>
        <button className="btn ghost" style={{ padding: '4px 10px' }}
          onClick={() => nav('/app/log')}>
          <Plus size={14} /> Log
        </button>
      </div>

      <div style={{
        display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-4)',
        gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
      }}>
        {metrics.map((metric) => {
          const Icon = ICONS[metric.key];
          const met = metric.value !== null && metric.target !== null
            && metric.value >= metric.target;
          const share = metric.value !== null && metric.target
            ? Math.min(1, metric.value / metric.target)
            : 0;

          return (
            <div key={metric.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
                <Icon size={14} />
                <small>{metric.label}</small>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 2 }}>
                <b style={{ fontSize: 'var(--text-section)' }}>{format(metric)}</b>
                <small style={{ opacity: 0.6 }}>{metric.unit}</small>
              </div>

              <div style={{
                height: 6, borderRadius: 3, marginTop: 8,
                background: 'rgba(128,128,128,0.16)', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${share * 100}%`, height: '100%',
                  background: met ? STATUS_COLOUR.good : STATUS_COLOUR.attention,
                  transition: 'width .5s ease',
                }} />
              </div>

              <small style={{ opacity: 0.6, display: 'block', marginTop: 5 }}>
                {metric.value === null
                  ? 'not logged'
                  : `${metric.days_logged} of 7 days · target ${metric.target?.toLocaleString()}`}
              </small>
            </div>
          );
        })}
      </div>
    </article>
  );
}
