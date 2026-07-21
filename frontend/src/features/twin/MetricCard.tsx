/**
 * One metric within a system.
 *
 * Carries what the report card taught us a value needs: the number, whether it
 * is in range stated in words, what the test measures, and -- when there is
 * history -- a sparkline and whether it is moving toward or away from its range.
 *
 * A value that has not been measured is shown as such, never as a zero. Computed
 * figures (BMI, BMR) are marked calculated so neither reads as a lab result.
 * The number counts up on mount, only ever toward the real value.
 */

import { useEffect, useRef, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { STATUS_COLOUR, STATUS_TINT } from '../../components/ui/tokens';
import Sparkline from './Sparkline';
import type { TwinMetric } from './types';

type Status = keyof typeof STATUS_COLOUR;

function statusWord(m: TwinMetric): string {
  if (m.status === 'none') return 'Not measured';
  if (m.status === 'attention') return 'Out of range';
  if (m.near_edge) return 'Borderline';
  return 'Normal';
}

function useCountUp(target: number | null, places: number): number | null {
  const [value, setValue] = useState<number | null>(target === null ? null : 0);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (target === null) { setValue(null); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      const eased = 1 - Math.pow(1 - t, 3);
      const f = 10 ** places;
      setValue(Math.round(target * eased * f) / f);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, places]);

  return value;
}

export default function MetricCard({ metric, accent }: { metric: TwinMetric; accent: string }) {
  const [open, setOpen] = useState(false);
  const missing = metric.value === null;
  const status = (metric.status === 'none' ? 'unknown' : metric.status) as Status;
  const places = metric.label === 'Sleep' || metric.label === 'BMI' ? 1 : 0;
  const shown = useCountUp(metric.value, places);

  const canExpand = !missing && (!!metric.explanation || metric.history.length > 1);

  return (
    <div
      onClick={() => canExpand && setOpen(!open)}
      style={{
        padding: 'var(--space-4)',
        borderRadius: 14,
        background: missing ? 'rgba(128,128,128,0.05)' : STATUS_TINT[status],
        border: `1px solid ${missing ? 'rgba(128,128,128,0.14)' : STATUS_COLOUR[status] + '33'}`,
        opacity: missing ? 0.72 : 1,
        cursor: canExpand ? 'pointer' : 'default',
        transition: 'background .4s ease, border-color .4s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <small style={{ opacity: 0.75, fontWeight: 'var(--w-semibold)' }}>{metric.label}</small>
        {metric.computed && (
          <small style={{ fontSize: 10, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            calculated
          </small>
        )}
      </div>

      {missing ? (
        <div style={{ marginTop: 6, opacity: 0.6, fontSize: 'var(--text-small)' }}>
          Not measured yet
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <b style={{ fontSize: 'var(--text-section)', color: STATUS_COLOUR[status] }}>
                {shown?.toLocaleString()}
              </b>
              {metric.unit && <small style={{ opacity: 0.6 }}>{metric.unit}</small>}
            </div>
            {metric.history.length > 1 && <Sparkline values={metric.history} colour={accent} />}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, gap: 6, alignItems: 'center' }}>
            <small style={{ color: STATUS_COLOUR[status], fontWeight: 'var(--w-semibold)', fontSize: 12 }}>
              {statusWord(metric)}
            </small>
            {/* Direction is only meaningful with history and a range, so it
                appears only when the backend judged one. */}
            {metric.direction === 'improving' && (
              <small style={{ color: STATUS_COLOUR.good, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                <TrendingUp size={12} /> improving
              </small>
            )}
            {metric.direction === 'declining' && (
              <small style={{ color: STATUS_COLOUR.attention, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                <TrendingDown size={12} /> declining
              </small>
            )}
          </div>

          {open && metric.explanation && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(128,128,128,0.14)', fontSize: 13, opacity: 0.8 }}>
              {metric.explanation}.
              {metric.detail && <div style={{ opacity: 0.7, marginTop: 3 }}>{metric.detail}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
