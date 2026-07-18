/**
 * One biomarker, with its value placed on its reference range.
 *
 * The bar is the point. A list of numbers tells a user nothing unless they
 * already know what normal looks like for each test -- which is precisely the
 * problem AURA exists to solve. Seeing the dot sit inside or outside the shaded
 * band answers "is this okay?" without reading anything.
 *
 * Open-ended ranges ("< 200", "> 40") are common on real reports, so the bar
 * has to render sensibly when only one bound exists.
 */

import type { Biomarker } from '../lib/types';

const FLAG_COLOR: Record<string, string> = {
  high: '#f59e0b',
  low: '#f59e0b',
  normal: '#16a34a',
  unknown: '#94a3b8',
};

/**
 * Where the value sits along the bar, 0-1.
 *
 * The band is drawn across the middle 60% so an out-of-range value still has
 * room to show on either side instead of being clamped invisibly to an edge.
 */
function positions(marker: Biomarker) {
  const { value, ref_low, ref_high } = marker;
  const BAND_START = 0.2;
  const BAND_END = 0.8;

  if (ref_low !== null && ref_high !== null && ref_high > ref_low) {
    const span = ref_high - ref_low;
    const t = (value - ref_low) / span;
    return {
      bandStart: BAND_START,
      bandEnd: BAND_END,
      value: Math.max(0.02, Math.min(0.98, BAND_START + t * (BAND_END - BAND_START))),
    };
  }

  // One-sided range: put the bound at the middle and show which side of it the
  // value falls on.
  const bound = ref_high ?? ref_low;
  if (bound) {
    const ratio = value / bound;
    const t = 0.5 * Math.min(ratio, 2);
    return {
      bandStart: ref_high !== null ? 0 : 0.5,
      bandEnd: ref_high !== null ? 0.5 : 1,
      value: Math.max(0.02, Math.min(0.98, t)),
    };
  }

  return { bandStart: 0, bandEnd: 0, value: 0.5 };
}

export default function BiomarkerRow({ marker }: { marker: Biomarker }) {
  const abnormal = marker.flag === 'low' || marker.flag === 'high';
  const color = FLAG_COLOR[marker.flag] ?? FLAG_COLOR.unknown;
  const hasRange = marker.ref_low !== null || marker.ref_high !== null;
  const { bandStart, bandEnd, value } = positions(marker);

  const rangeLabel =
    marker.ref_low !== null && marker.ref_high !== null
      ? `${marker.ref_low} – ${marker.ref_high}`
      : marker.ref_high !== null
        ? `< ${marker.ref_high}`
        : marker.ref_low !== null
          ? `> ${marker.ref_low}`
          : 'no range given';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(120px,1.4fr) auto minmax(90px,1fr)',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '0.6rem 0',
        borderTop: '1px solid rgba(128,128,128,0.14)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <b style={{ fontWeight: abnormal ? 700 : 500 }}>{marker.label}</b>
        <div style={{ fontSize: 12, opacity: 0.6 }}>{rangeLabel}</div>
      </div>

      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 700, color: abnormal ? color : undefined }}>
          {marker.value}
        </span>
        {marker.unit && <small style={{ opacity: 0.6 }}> {marker.unit}</small>}
        {abnormal && (
          <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase' }}>
            {marker.flag}
          </div>
        )}
      </div>

      {hasRange ? (
        <div
          style={{ position: 'relative', height: 8, borderRadius: 4, background: 'rgba(128,128,128,0.16)' }}
          role="img"
          aria-label={`${marker.value} against a normal range of ${rangeLabel}`}
        >
          <span
            style={{
              position: 'absolute',
              left: `${bandStart * 100}%`,
              width: `${(bandEnd - bandStart) * 100}%`,
              top: 0,
              bottom: 0,
              background: 'rgba(22,163,74,0.28)',
              borderRadius: 4,
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: `calc(${value * 100}% - 5px)`,
              top: -2,
              width: 10,
              height: 12,
              borderRadius: 3,
              background: color,
              border: '2px solid var(--card-bg, #fff)',
            }}
          />
        </div>
      ) : (
        // No range printed and none in our table: show nothing rather than a
        // bar with invented bounds.
        <small style={{ opacity: 0.5 }}>not assessed</small>
      )}
    </div>
  );
}
