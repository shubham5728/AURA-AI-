/**
 * A tiny line of a marker's real history.
 *
 * Drawn only when there are two or more readings. One point is not a trend, and
 * a flat line from a single value would imply a stability that has not been
 * observed -- the same rule the trend charts follow elsewhere.
 */

interface Props {
  values: number[];
  colour: string;
}

export default function Sparkline({ values, colour }: Props) {
  if (values.length < 2) return null;

  const W = 64;
  const H = 20;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (W - 2) + 1;
    const y = H - 2 - ((v - lo) / span) * (H - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden
      style={{ display: 'block' }}>
      <polyline points={points.join(' ')} fill="none" stroke={colour}
        strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <circle cx={points[points.length - 1].split(',')[0]}
        cy={points[points.length - 1].split(',')[1]} r={2} fill={colour} />
    </svg>
  );
}
