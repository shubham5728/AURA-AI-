/**
 * Biomarker trends across every uploaded report.
 *
 * This is what the reports/biomarkers table split in the backend was for: one
 * query returns every reading of every marker, ordered, so a chart is cheap.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp } from 'lucide-react';
import TrendChart from '../components/TrendChart';
import { get } from '../lib/api';
import type { Trend } from '../lib/types';

export default function TrendsPage() {
  const nav = useNavigate();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    get<Trend[]>('/api/reports/trends')
      .then(setTrends)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Markers that are out of range, and markers with real history, are the ones
  // worth looking at. Sorting by that puts the useful charts on the first screen
  // instead of alphabetically wherever they land.
  const ranked = [...trends].sort((a, b) => {
    const abnormal = (t: Trend) => {
      const last = t.points[t.points.length - 1];
      return last && (last.flag === 'low' || last.flag === 'high') ? 1 : 0;
    };
    return (
      abnormal(b) - abnormal(a) || b.points.length - a.points.length
    );
  });

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Biomarker trends</h1>
          <p>Every marker from every report you have uploaded, oldest to newest.</p>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading…</p>
      ) : ranked.length === 0 ? (
        <article className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="upload-icon"><TrendingUp /></div>
          <h3>No readings yet</h3>
          <p>Upload a lab report and its values will be charted here automatically.</p>
          <button className="btn primary" style={{ marginTop: '1rem' }}
            onClick={() => nav('/app/reports')}>
            Upload a report <ArrowRight size={16} />
          </button>
        </article>
      ) : (
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
          {ranked.map((t) => (
            <TrendChart key={t.name} trend={t} />
          ))}
        </div>
      )}
    </main>
  );
}
