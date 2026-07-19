/**
 * The last week of scores, and the direction across it.
 *
 * Points are placed by their real dates rather than spaced evenly. History
 * exists only for the days the app was opened, and evenly spacing a Monday and
 * a Friday reading would draw a week of steady progress that was never
 * observed.
 *
 * Says what it does not know. One reading is not a trend, and a change across a
 * window where coverage moved is measuring what was looked at rather than what
 * changed -- both are stated instead of being shown as a confident zero.
 */

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { STATUS_COLOUR } from '../../../components/ui/tokens';
import type { ScoreTrend } from '../types';

const W = 260;
const H = 52;

export default function ScoreTrendLine({ trend }: { trend: ScoreTrend }) {
  const { points, change, coverage_changed, days_recorded } = trend;

  if (days_recorded < 2) {
    return (
      <small style={{ opacity: 0.6 }}>
        {days_recorded === 0
          ? 'No history yet'
          : 'First reading recorded — check back tomorrow to see a trend'}
      </small>
    );
  }

  if (coverage_changed) {
    return (
      <small style={{ opacity: 0.7 }}>
        Your score now covers more areas than it did, so the two are not
        directly comparable.
      </small>
    );
  }

  const scores = points.map((p) => p.score);
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const span = hi - lo || 1;

  const times = points.map((p) => new Date(p.date).getTime());
  const first = times[0];
  const last = times[times.length - 1];
  const duration = last - first || 1;

  const x = (i: number) => ((times[i] - first) / duration) * (W - 8) + 4;
  const y = (score: number) => H - 8 - ((score - lo) / span) * (H - 20);

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`)
    .join(' ');

  const rising = (change ?? 0) > 0;
  const flat = (change ?? 0) === 0;
  const colour = flat ? STATUS_COLOUR.unknown : rising ? STATUS_COLOUR.good : STATUS_COLOUR.attention;
  const Icon = flat ? Minus : rising ? TrendingUp : TrendingDown;

  const days = Math.round((last - first) / 86_400_000);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: colour }}>
        <Icon size={15} />
        <b style={{ fontSize: 'var(--text-card)' }}>
          {flat ? 'No change' : `${rising ? '+' : ''}${change}`}
        </b>
        <small style={{ opacity: 0.7, color: 'var(--ink)' }}>
          over {days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'}`}
        </small>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
        aria-label={`Score ${flat ? 'unchanged' : rising ? 'up' : 'down'} ${Math.abs(change ?? 0)} points across ${days} days, from ${points.length} readings`}
        style={{ marginTop: 4, overflow: 'visible' }}>
        <path d={path} fill="none" stroke={colour} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.score)}
            r={i === points.length - 1 ? 3.5 : 2.5}
            fill={colour} />
        ))}
      </svg>

      {/* Each dot is a day the app was opened. Saying so stops the line being
          read as continuous monitoring. */}
      <small style={{ opacity: 0.55 }}>
        {points.length} reading{points.length === 1 ? '' : 's'} recorded
      </small>
    </div>
  );
}
