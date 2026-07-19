/**
 * The overview.
 *
 * Ordered by the questions someone opens a health app to answer, rather than by
 * the order the widgets happened to be written in:
 *
 *   1. Am I okay today?      -> the score, with how much of it is known
 *   2. What should I do?     -> the briefing and its actions
 *   3. Should I worry, why?  -> what is costing the score, with evidence
 *   4. What changed?         -> latest results, abnormal first
 *   5. How am I tracking?    -> daily habits against targets
 *
 * The first screen previously opened with a fabricated week-long chart, three
 * fixed instructions shown to every user, and a hydration figure for someone
 * who had logged nothing. All of it is gone; every number here comes from the
 * user's own records or is absent.
 */

import { useAuth } from '../../contexts/AuthContext';
import AIBriefing from './components/AIBriefing';
import HealthScoreCard from './components/HealthScoreCard';
import RecentSignals from './components/RecentSignals';
import RiskMonitor from './components/RiskMonitor';
import TodayMetrics from './components/TodayMetrics';
import { useOverview } from './useOverview';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function OverviewPage() {
  const { user } = useAuth();
  const { data, loading, error } = useOverview();

  // The part before the @ is not a name, but it is what the user typed and
  // recognises. Inventing a display name would be worse.
  const who = user?.email?.split('@')[0] ?? '';

  if (loading) {
    return (
      <main className="page">
        <div className="center"><div className="spinner" /> Building your overview…</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="page">
        <div className="error">{error || 'Could not load your overview'}</div>
      </main>
    );
  }

  return (
    <main className="page" style={{ maxWidth: 1120 }}>
      <header className="page-head">
        <div>
          <h1>{greeting()}{who && `, ${who}`}</h1>
          <p>{data.briefing.score === null
            ? 'Let us build your Digital Twin.'
            : 'Here is where your health stands today.'}</p>
        </div>
      </header>

      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <div style={{
          display: 'grid', gap: 'var(--space-5)',
          gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))',
        }}>
          <HealthScoreCard score={data.score} summary={data.summary} coverage={data.coverage} />
          <AIBriefing briefing={data.briefing} />
        </div>

        <RiskMonitor concerns={data.concerns} />
        <RecentSignals signals={data.signals} />
        <TodayMetrics metrics={data.metrics} />
      </div>
    </main>
  );
}
