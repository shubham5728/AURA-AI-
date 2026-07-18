/**
 * Biomarker trend with its reference range shaded behind the line.
 *
 * The shaded band is the point of the chart. It lets someone see that a value
 * is out of range without reading a number or knowing what the number means --
 * which is the whole problem AURA is trying to solve for lab reports.
 *
 * Plain SVG rather than a charting library: this is the only chart in the app,
 * it needs one uncommon feature, and the codebase already draws its sparklines
 * by hand.
 */

import type { Trend } from '../lib/types';

const W = 520;
const H = 150;
const PAD = { top: 12, right: 14, bottom: 22, left: 40 };

// Matches the report card: green means inside the reference range, amber means
// outside it. The same colour must mean the same thing on both screens.
const COLOR = {
  normal: '#16a34a',
  out: '#d97706',
  band: 'rgba(22, 163, 74, 0.18)',
};

export default function TrendChart({ trend }: { trend: Trend }) {
  const points = trend.points;
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const bounds = [trend.ref_low, trend.ref_high].filter(
    (v): v is number => v !== null,
  );

  // The band must be visible even when every reading sits inside it, so the
  // scale covers the data and the reference range together.
  const lo = Math.min(...values, ...bounds);
  const hi = Math.max(...values, ...bounds);
  const pad = (hi - lo) * 0.15 || Math.abs(hi * 0.1) || 1;
  const min = lo - pad;
  const max = hi + pad;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;

  const bandTop = trend.ref_high != null ? y(trend.ref_high) : PAD.top;
  const bandBottom = trend.ref_low != null ? y(trend.ref_low) : PAD.top + plotH;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const latest = points[points.length - 1];
  const outOfRange = latest.flag === 'low' || latest.flag === 'high';

  return (
    <article className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <b>{trend.label}</b>
          {trend.unit && <small style={{ opacity: 0.65 }}> · {trend.unit}</small>}
        </div>
        <strong style={{ color: outOfRange ? COLOR.out : undefined }}>
          {latest.value}
          {outOfRange && <small> {latest.flag}</small>}
        </strong>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label={`${trend.label} across ${points.length} readings`}>
        {/* Reference range */}
        {bounds.length > 0 && (
          <rect x={PAD.left} y={Math.min(bandTop, bandBottom)} width={plotW}
            height={Math.abs(bandBottom - bandTop)} fill={COLOR.band} />
        )}

        {[trend.ref_low, trend.ref_high].map((bound, i) =>
          bound == null ? null : (
            <g key={i}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(bound)} y2={y(bound)}
                stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
              <text x={PAD.left - 6} y={y(bound) + 4} textAnchor="end"
                fontSize="10" fill="currentColor" fillOpacity={0.5}>
                {bound}
              </text>
            </g>
          ),
        )}

        <path d={path} fill="none" stroke={outOfRange ? COLOR.out : COLOR.normal} strokeWidth={2} />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={4}
              fill={p.flag === 'low' || p.flag === 'high' ? COLOR.out : COLOR.normal} />
            {p.measured_at && (
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="9"
                fill="currentColor" fillOpacity={0.5}>
                {p.measured_at.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* One reading is a data point, not a trend. Saying so prevents the chart
          from implying a direction it cannot show. */}
      {points.length === 1 && (
        <small style={{ opacity: 0.65 }}>
          Only one reading so far — upload another report to see a trend.
        </small>
      )}
    </article>
  );
}
