/**
 * Hereditary risk.
 *
 * This screen was "Health DNA". There is no genetic data here and there will
 * not be without a sequencing partner, so it does the honest version of the
 * same job: a condition that runs in the family tells you which of your own
 * results are worth watching.
 *
 * The rule this page is built around is that it states links, never forecasts.
 * "Your father has diabetes and your HbA1c is 6.4" is a fact worth surfacing.
 * "You will develop diabetes" is a claim nothing here supports.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Dna, Users } from 'lucide-react';
import { get } from '../lib/api';

interface Finding {
  condition_key: string;
  condition: string;
  relatives: string[];
  closest_relation: string;
  strength: 'higher' | 'some';
  watch: string;
  your_markers: Array<{
    name: string;
    label: string;
    value: number;
    unit: string | null;
    flag: string;
  }>;
}

export default function HereditaryPage() {
  const nav = useNavigate();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    get<Finding[]>('/api/family/hereditary')
      .then(setFindings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page" style={{ maxWidth: 1020 }}>
      <header className="page-head">
        <div>
          <h1>Hereditary risk</h1>
          <p>
            Conditions that run in your family, matched against your own results.
          </p>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading…</p>
      ) : findings.length === 0 ? (
        <article className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div className="upload-icon"><Dna /></div>
          <h3>Nothing to show yet</h3>
          <p style={{ opacity: 0.8 }}>
            Add a relative with a known condition and AURA will show which of your
            results relate to it.
          </p>
          <button className="btn primary" style={{ marginTop: '1.25rem' }}
            onClick={() => nav('/app/family')}>
            <Users size={16} /> Add family history <ArrowRight size={16} />
          </button>
        </article>
      ) : (
        <>
          {findings.map((f) => (
            <article className="card" key={f.condition_key}
              style={{ padding: '1.4rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>{f.condition}</h3>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: f.strength === 'higher' ? '#d97706' : '#64748b',
                }}>
                  {f.strength === 'higher' ? 'Close family link' : 'Distant family link'}
                </span>
              </div>

              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Recorded in {f.relatives.join(', ')}.
              </p>

              {f.your_markers.length > 0 ? (
                <div style={{ marginTop: '0.9rem' }}>
                  <span className="card-label">YOUR RELATED RESULTS</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.4rem' }}>
                    {f.your_markers.map((m) => {
                      const off = m.flag === 'low' || m.flag === 'high';
                      return (
                        <span key={m.name} style={{
                          padding: '6px 12px', borderRadius: 999,
                          fontSize: 13.5,
                          background: off ? 'rgba(217,119,6,0.12)' : 'rgba(22,163,74,0.10)',
                          color: off ? '#b45309' : '#15803d',
                          fontWeight: 600,
                        }}>
                          {m.label} {m.value}{m.unit ? ` ${m.unit}` : ''}
                          {off ? ` · ${m.flag}` : ' · normal'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p style={{ marginTop: '0.75rem', opacity: 0.7, fontSize: 14 }}>
                  You have no results on file for this yet.
                </p>
              )}

              <p style={{ marginTop: '0.9rem', fontSize: 14, opacity: 0.8 }}>{f.watch}</p>
            </article>
          ))}

          <div style={{ fontSize: 14, opacity: 0.8, marginTop: '1.25rem' }}>
            <b>What this is and is not.</b> A condition in your family means certain
            results are worth following more closely. It does not mean you have that
            condition or that you will develop it. Family history is one factor among
            many, and a doctor is the person to weigh it with you.
          </div>
        </>
      )}
    </main>
  );
}
