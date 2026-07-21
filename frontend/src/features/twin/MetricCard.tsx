/**
 * One metric within a system.
 *
 * A value that has not been measured is shown as such -- greyed, "not measured
 * yet" -- never as a zero or a dash that could be mistaken for a reading of
 * zero. Computed values (BMI, BMR) are labelled as calculated, so nobody reads
 * an estimate as a lab result.
 *
 * The number counts up on mount. It is a small touch, but it makes switching
 * systems feel like a panel loading rather than text swapping -- and it only
 * ever animates toward the real value.
 */

import { useEffect, useRef, useState } from 'react';
import { STATUS_COLOUR, STATUS_TINT } from '../../components/ui/tokens';
import type { TwinMetric } from './types';

type Status = keyof typeof STATUS_COLOUR;

const STATUS_WORD: Record<string, string> = {
  good: 'Normal',
  attention: 'Out of range',
  unknown: 'No range',
  none: 'Not measured',
};

function useCountUp(target: number | null, places: number): number | null {
  const [value, setValue] = useState<number | null>(target === null ? null : 0);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (target === null) { setValue(null); return; }
    const start = performance.now();
    const from = 0;
    const duration = 600;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const factor = 10 ** places;
      setValue(Math.round((from + (target - from) * eased) * factor) / factor);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, places]);

  return value;
}

export default function MetricCard({ metric }: { metric: TwinMetric }) {
  const missing = metric.value === null;
  const status = (metric.status === 'none' ? 'unknown' : metric.status) as Status;
  const places = metric.label === 'Sleep' || metric.label === 'BMI' ? 1 : 0;
  const shown = useCountUp(metric.value, places);

  return (
    <div style={{
      padding: 'var(--space-4)',
      borderRadius: 14,
      background: missing ? 'rgba(128,128,128,0.05)' : STATUS_TINT[status],
      border: `1px solid ${missing ? 'rgba(128,128,128,0.14)' : STATUS_COLOUR[status] + '33'}`,
      opacity: missing ? 0.72 : 1,
      transition: 'background .4s ease, border-color .4s ease',
    }}>
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
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
            <b style={{ fontSize: 'var(--text-section)', color: STATUS_COLOUR[status] }}>
              {shown?.toLocaleString()}
            </b>
            {metric.unit && <small style={{ opacity: 0.6 }}>{metric.unit}</small>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, gap: 6 }}>
            <small style={{ color: STATUS_COLOUR[status], fontWeight: 'var(--w-semibold)', fontSize: 12 }}>
              {STATUS_WORD[metric.status]}
            </small>
            {metric.detail && <small style={{ opacity: 0.55, fontSize: 11 }}>{metric.detail}</small>}
          </div>
        </>
      )}
    </div>
  );
}
