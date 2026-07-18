/**
 * Honest empty state for features that exist in the navigation but have no
 * backend behind them.
 *
 * These screens previously rendered an empty grid under a confident heading,
 * which reads as broken rather than unbuilt. Worse, they used to be filled with
 * seeded rows that looked like the user's own data.
 *
 * Naming what is missing, and pointing at what does work, is more useful than
 * either. It also keeps the demo honest: a judge clicking through finds a clear
 * boundary between built and planned instead of a page that quietly fails.
 */

import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

interface Props {
  title: string;
  summary: string;
  /** What has to exist before this screen can show anything real. */
  needs: string;
}

export default function NotConnected({ title, summary, needs }: Props) {
  const nav = useNavigate();

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{summary}</p>
        </div>
      </header>

      <article className="card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: 640 }}>
        <div className="upload-icon"><Sparkles /></div>
        <h3>Planned, not built</h3>
        <p style={{ opacity: 0.8 }}>{needs}</p>
        <p style={{ opacity: 0.8, marginTop: '0.75rem' }}>
          AURA will not show placeholder figures here. Anything you see in this app
          comes from your own data.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => nav('/app')}>
            Back to dashboard <ArrowRight size={16} />
          </button>
          <button className="btn ghost" onClick={() => nav('/app/companion')}>
            Ask the AI companion
          </button>
        </div>
      </article>
    </main>
  );
}
