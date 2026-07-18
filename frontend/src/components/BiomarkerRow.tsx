/**
 * One biomarker: what it measures, your value, and where it sits in range.
 *
 * Three things a person needs, in the order they need them:
 *
 * 1. What is this test? "MCHC" means nothing to almost anyone, so the plain
 *    description carries as much weight as the name.
 * 2. What is my number, and is it okay? Stated in words, not only in colour --
 *    colour alone excludes anyone who cannot distinguish it.
 * 3. Where does it sit? The bar answers that without requiring the reader to
 *    hold two numbers in their head and compare.
 *
 * Open-ended ranges ("< 200", "> 40") are printed constantly by real labs, so
 * the bar has to render sensibly with only one bound.
 */

import { explain } from '../lib/explanations';
import type { Biomarker } from '../lib/types';

const STATUS = {
  high: { label: 'Above range', color: '#d97706' },
  low: { label: 'Below range', color: '#d97706' },
  normal: { label: 'Normal', color: '#16a34a' },
  unknown: { label: 'No range given', color: '#94a3b8' },
} as const;

/**
 * Where the value sits along the bar, 0-1.
 *
 * The normal band occupies the middle 60% so an out-of-range value still has
 * room to show outside it instead of being clamped invisibly to an edge.
 */
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
    };
  }

  const bound = ref_high ?? ref_low;
  if (bound) {
    const t = 0.5 * Math.min(value / bound, 2);
    return {
      bandStart: ref_high !== null ? 0 : 0.5,
      bandEnd: ref_high !== null ? 0.5 : 1,
      value: Math.max(0.02, Math.min(0.98, t)),
    };
  }
  return { bandStart: 0, bandEnd: 0, value: 0.5 };
}

export default function BiomarkerRow({ marker }: { marker: Biomarker }) {
  const status = STATUS[marker.flag as keyof typeof STATUS] ?? STATUS.unknown;
  const abnormal = marker.flag === 'low' || marker.flag === 'high';
  const hasRange = marker.ref_low !== null || marker.ref_high !== null;
  const { bandStart, bandEnd, value } = positions(marker);
  const description = explain(marker.name);

  const normalRange =
    marker.ref_low !== null && marker.ref_high !== null
      ? `${marker.ref_low} – ${marker.ref_high}`
      : marker.ref_high !== null
        ? `under ${marker.ref_high}`
        : marker.ref_low !== null
          ? `over ${marker.ref_low}`
          : null;

  return (
    <div
      style={{
        padding: '0.9rem 0',
        borderTop: '1px solid rgba(128,128,128,0.14)',
        // A tinted strip makes an out-of-range result findable while scanning,
        // instead of relying on the reader noticing one coloured word.
        background: abnormal ? 'rgba(217,119,6,0.05)' : undefined,
        borderLeft: abnormal ? '3px solid #d97706' : '3px solid transparent',
        paddingLeft: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
        <b style={{ fontSize: 15 }}>{marker.label}</b>
        <div style={{ whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: abnormal ? status.color : undefined }}>
            {marker.value.toLocaleString()}
          </span>
          {marker.unit && <small style={{ opacity: 0.6 }}> {marker.unit}</small>}
        </div>
      </div>

      {description && (
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>{description}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.55rem' }}>
        {hasRange ? (
          <div
            style={{ position: 'relative', height: 8, borderRadius: 4, flex: 1, background: 'rgba(128,128,128,0.16)' }}
            role="img"
            aria-label={`${marker.value} ${marker.unit ?? ''}, ${status.label.toLowerCase()}${normalRange ? `, normal is ${normalRange}` : ''}`}
          >
            <span style={{
              position: 'absolute',
              left: `${bandStart * 100}%`,
              width: `${(bandEnd - bandStart) * 100}%`,
              top: 0, bottom: 0,
              background: 'rgba(22,163,74,0.25)',
              borderRadius: 4,
            }} />
            <span style={{
              position: 'absolute',
              left: `calc(${value * 100}% - 5px)`,
              top: -3, width: 10, height: 14,
              borderRadius: 3,
              background: status.color,
              boxShadow: '0 0 0 2px var(--surface, #fff)',
            }} />
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {/* Stated in words as well as colour. */}
        <span style={{ fontSize: 12, fontWeight: 700, color: status.color, whiteSpace: 'nowrap' }}>
          {status.label}
        </span>
      </div>

      {normalRange && (
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 3 }}>
          Normal: {normalRange}
          {marker.unit ? ` ${marker.unit}` : ''}
        </div>
      )}
    </div>
  );
}
