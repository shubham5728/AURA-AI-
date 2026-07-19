/**
 * The score, and how much of it is actually known.
 *
 * Answers "am I okay today?" -- but only as far as the data allows. The
 * previous card showed a bare number, and a 100 built on height and weight
 * alone reads as a clean bill of health when five of six areas have never been
 * looked at.
 *
 * So coverage is not a footnote here. The ring is drawn in proportion to what
 * was assessed, and the gaps are named.
 */

import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Chip from '../../../components/ui/Chip';
import { STATUS_COLOUR } from '../../../components/ui/tokens';
import { unassessed } from '../useOverview';

interface Props {
  score: number | null;
  summary: string;
  coverage: Record<string, boolean>;
}

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function HealthScoreCard({ score, summary, coverage }: Props) {
  const nav = useNavigate();
  const gaps = unassessed(coverage);
  const assessed = Object.values(coverage).filter(Boolean).length;
  const total = Object.keys(coverage).length;

  const colour =
    score === null ? STATUS_COLOUR.unknown
      : score >= 85 ? STATUS_COLOUR.good
        : score >= 60 ? STATUS_COLOUR.attention
          : STATUS_COLOUR.urgent;

  const filled = score === null ? 0 : (score / 100) * CIRCUMFERENCE;

  return (
    <article className="card" style={{ padding: 'var(--space-5)' }}>
      <span className="card-label">TODAY'S HEALTH SCORE</span>

      <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'center', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
        <svg width={132} height={132} role="img"
          aria-label={score === null
            ? 'No score yet, not enough data'
            : `Health score ${score} out of 100, based on ${assessed} of ${total} areas`}>
          <circle cx={66} cy={66} r={RADIUS} fill="none"
            stroke="rgba(128,128,128,0.18)" strokeWidth={10} />
          <circle cx={66} cy={66} r={RADIUS} fill="none"
            stroke={colour} strokeWidth={10} strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            transform="rotate(-90 66 66)"
            style={{ transition: 'stroke-dasharray .6s ease' }} />
          <text x={66} y={68} textAnchor="middle" fontSize={30}
            fontWeight={800} fill="currentColor">
            {score ?? '—'}
          </text>
          <text x={66} y={88} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.6}>
            {score === null ? 'no score' : '/ 100'}
          </text>
        </svg>

        <div style={{ flex: 1, minWidth: 220 }}>
          <p className="t-lead" style={{ margin: 0 }}>{summary}</p>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <small style={{ opacity: 0.65 }}>
              Based on {assessed} of {total} areas
            </small>
            {/* Named rather than counted. "Five of six" tells you a number;
                "lab results, sleep" tells you what to do about it. */}
            {gaps.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {gaps.map((gap) => <Chip key={gap} muted>{gap}</Chip>)}
              </div>
            )}
          </div>

          {gaps.length > 0 && (
            <button className="btn ghost" style={{ marginTop: 'var(--space-4)' }}
              onClick={() => nav('/app/log')}>
              Fill the gaps <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
