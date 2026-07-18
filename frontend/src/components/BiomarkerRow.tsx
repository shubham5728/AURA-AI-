/**
 * One biomarker: what it measures, your value, and where it sits in range.
 *
 * Three things a person needs, in the order they need them:
 *
 * 1. What is this test? "MCHC" means nothing to almost anyone, so the plain
 *    description carries as much weight as the name.
 * 2. What is my number, and is it okay? Stated in words, not only in colour --
 *    colour alone excludes anyone who cannot distinguish it.
 * 3. Where does it sit? The bar answers that without asking the reader to hold
 *    two numbers in their head and compare.
 *
 * Laid out to be scanned. The value sits directly beside the name rather than
 * across the full width of a wide screen, and the range shares a line with the
 * bar instead of taking one of its own -- sixteen results should not need a
 * page of scrolling.
 */

import { explain } from '../lib/explanations';
import type { Biomarker } from '../lib/types';

const STATUS = {
  high: { label: 'Above range', color: '#d97706' },
  low: { label: 'Below range', color: '#d97706' },
  normal: { label: 'Normal', color: '#16a34a' },
  unknown: { label: 'No range', color: '#94a3b8' },
} as const;

/** How close to a boundary counts as sitting near the edge of normal. */
const EDGE_FRACTION = 0.1;

function positions(marker: Biomarker) {
  const { value, ref_low, ref_high } = marker;
  const START = 0.2;
  const END = 0.8;

  if (ref_low !== null && ref_high !== null && ref_high > ref_low) {
    const t = (value - ref_low) / (ref_high - ref_low);
    return {
      bandStart: START,
      bandEnd: END,
      value: Math.max(0.02, Math.min(0.98, START + t * (END - START))),
      /** Inside the range, but within 10% of a bound. */
      nearEdge: t >= 0 && t <= 1 && (t <= EDGE_FRACTION || t >= 1 - EDGE_FRACTION),
    };
  }

  const bound = ref_high ?? ref_low;
  if (bound) {
    const t = 0.5 * Math.min(value / bound, 2);
    return {
      bandStart: ref_high !== null ? 0 : 0.5,
      bandEnd: ref_high !== null ? 0.5 : 1,
      value: Math.max(0.02, Math.min(0.98, t)),
      nearEdge: false,
    };
  }
  return { bandStart: 0, bandEnd: 0, value: 0.5, nearEdge: false };
}

export default function BiomarkerRow({ marker }: { marker: Biomarker }) {
  const status = STATUS[marker.flag as keyof typeof STATUS] ?? STATUS.unknown;
  const abnormal = marker.flag === 'low' || marker.flag === 'high';
  const hasRange = marker.ref_low !== null || marker.ref_high !== null;
  const { bandStart, bandEnd, value, nearEdge } = positions(marker);
  const description = explain(marker.name);

  const normalRange =
    marker.ref_low !== null && marker.ref_high !== null
      ? `${marker.ref_low.toLocaleString()}–${marker.ref_high.toLocaleString()}`
      : marker.ref_high !== null
        ? `under ${marker.ref_high.toLocaleString()}`
        : marker.ref_low !== null
          ? `over ${marker.ref_low.toLocaleString()}`
          : null;

  return (
    <div
      style={{
        padding: '0.85rem 0 0.85rem 0.85rem',
        borderTop: '1px solid rgba(128,128,128,0.14)',
        background: abnormal ? 'rgba(217,119,6,0.05)' : undefined,
        borderLeft: `3px solid ${abnormal ? '#d97706' : 'transparent'}`,
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
          <b className="t-card">{marker.label}</b>
          <span style={{ whiteSpace: 'nowrap' }}>
            <span className="t-num" style={{ fontSize: 'var(--text-section)', fontWeight: 'var(--w-bold)', color: abnormal ? status.color : undefined }}>
              {marker.value.toLocaleString()}
            </span>
            {marker.unit && <small style={{ opacity: 0.6 }}> {marker.unit}</small>}
          </span>
        </div>

        {description && (
          <div className="t-body" style={{ opacity: 0.75, marginTop: 'var(--space-1)' }}>{description}</div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginTop: '0.5rem' }}>
          {hasRange ? (
            <div
              style={{ position: 'relative', height: 12, borderRadius: 6, flex: 1, background: 'rgba(128,128,128,0.16)' }}
              role="img"
              aria-label={`${marker.value} ${marker.unit ?? ''}, ${status.label.toLowerCase()}${normalRange ? `, normal is ${normalRange}` : ''}`}
            >
              <span style={{
                position: 'absolute',
                left: `${bandStart * 100}%`,
                width: `${(bandEnd - bandStart) * 100}%`,
                top: 0, bottom: 0,
                background: 'rgba(22,163,74,0.25)',
                borderRadius: 6,
              }} />
              <span style={{
                position: 'absolute',
                left: `calc(${value * 100}% - 6px)`,
                top: -2, width: 12, height: 16,
                borderRadius: 4,
                background: status.color,
                boxShadow: '0 0 0 2px var(--surface, #fff)',
              }} />
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          {normalRange && (
            <small className="t-small t-num" style={{ opacity: 0.65, whiteSpace: 'nowrap' }}>
              {normalRange}
            </small>
          )}

          <span className="t-small" style={{ fontWeight: 'var(--w-bold)', color: status.color, whiteSpace: 'nowrap', minWidth: 92, textAlign: 'right' }}>
            {status.label}
          </span>
        </div>

        {/* Stated as a position in the range, never as a health verdict. The
            lab called this normal and AURA does not overrule it -- this only
            says the value sits close to a boundary. */}
        {nearEdge && !abnormal && (
          <div className="t-small" style={{ opacity: 0.7, marginTop: 'var(--space-1)' }}>
            Sits near the edge of the normal range.
          </div>
        )}
      </div>
    </div>
  );
}
