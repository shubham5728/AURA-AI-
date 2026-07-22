/**
 * Wearable data — from the user's own export, never a fake live feed.
 *
 * AURA has no device connection, so this does not pretend a watch is streaming.
 * The user uploads the file they exported themselves (Apple Health, Fitbit,
 * Google Takeout); the backend reads it and this shows the real numbers, with
 * the source and date range named so nothing looks more connected than it is.
 * A metric the file didn't contain is left blank rather than invented.
 */

import { useEffect, useRef, useState } from 'react';
import { Activity, Footprints, HeartPulse, Moon, Trash2, Upload, Watch } from 'lucide-react';
import { del, get, upload } from '../lib/api';
import type { WearableImport, WearableSummary } from '../lib/types';

function StatTile({ icon, label, value, unit }: {
  icon: React.ReactNode; label: string; value: string; unit?: string;
}) {
  return (
    <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: 0.7, fontSize: 'var(--text-small)' }}>
        {icon} {label}
      </div>
      <div style={{ marginTop: 6, fontSize: '1.5rem', fontWeight: 700 }}>
        {value}{unit && <span style={{ fontSize: '0.9rem', fontWeight: 400, opacity: 0.6 }}> {unit}</span>}
      </div>
    </div>
  );
}

export default function WearablePage() {
  const [summary, setSummary] = useState<WearableSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justImported, setJustImported] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      setSummary(await get<WearableSummary>('/api/wearable'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load wearable data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setJustImported(null);
    try {
      const res = await upload<WearableImport>('/api/wearable/import', file);
      setSummary(res.summary);
      setJustImported(res.imported);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clear = async () => {
    await del('/api/wearable');
    setJustImported(null);
    await load();
  };

  const has = summary && summary.days > 0;

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Wearable Data</h1>
          <p>No device is connected to AURA. Upload the health data you exported from your
            own watch or phone, and AURA will read the real numbers from it.</p>
        </div>
      </header>

      <section className="card" style={{ padding: '1.5rem', maxWidth: 760 }}>
        <span className="card-label"><Upload size={14} /> IMPORT AN EXPORT</span>
        <p style={{ fontSize: 'var(--text-small)', opacity: 0.8, margin: '0.5rem 0 1rem' }}>
          Accepts an <b>Apple Health</b> <code>export.xml</code>, or a <b>CSV</b> from Fitbit,
          Google Takeout, or your own sheet (with date, steps, resting heart rate, or sleep
          columns). Files stay private to your account.
        </p>
        <input ref={fileRef} type="file" accept=".csv,.xml,text/csv,text/xml"
          onChange={(e) => onFile(e.target.files?.[0])} disabled={busy}
          style={{ display: 'block' }} />
        {busy && <p style={{ marginTop: '0.75rem', opacity: 0.7 }}>Reading your file…</p>}
        {justImported !== null && (
          <p style={{ marginTop: '0.75rem', color: 'var(--accent, #2563eb)' }}>
            Imported {justImported} day{justImported === 1 ? '' : 's'} of real data.
          </p>
        )}
      </section>

      {error && <div className="error" style={{ marginTop: '1rem' }}>{error}</div>}

      {loading ? (
        <p style={{ opacity: 0.7, marginTop: '2rem' }}>Loading…</p>
      ) : !has ? (
        <section style={{ marginTop: '2rem', maxWidth: 760, textAlign: 'center', opacity: 0.75 }}>
          <Watch size={40} style={{ opacity: 0.5 }} />
          <p style={{ marginTop: '0.75rem' }}>
            Nothing imported yet. When you upload an export, your real resting heart rate,
            sleep, and steps will show here — and only what the file actually contains.
          </p>
        </section>
      ) : (
        <>
          <section style={{ marginTop: '2rem', maxWidth: 760 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span className="card-label" style={{ margin: 0 }}>
                YOUR DATA · {summary!.days} DAY{summary!.days === 1 ? '' : 'S'} · {summary!.sources.join(', ')}
              </span>
              <button className="btn ghost" onClick={clear}><Trash2 size={14} /> Clear</button>
            </div>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
              <StatTile icon={<HeartPulse size={14} />} label="Avg resting HR"
                value={summary!.avg_resting_hr?.toString() ?? '—'} unit={summary!.avg_resting_hr ? 'bpm' : ''} />
              <StatTile icon={<Moon size={14} />} label="Avg sleep"
                value={summary!.avg_sleep_hours?.toString() ?? '—'} unit={summary!.avg_sleep_hours ? 'h/night' : ''} />
              <StatTile icon={<Footprints size={14} />} label="Avg steps"
                value={summary!.avg_steps?.toLocaleString() ?? '—'} unit={summary!.avg_steps ? '/day' : ''} />
              <StatTile icon={<Activity size={14} />} label="Date range"
                value={summary!.date_from && summary!.date_to
                  ? `${summary!.date_from} → ${summary!.date_to}` : '—'} />
            </div>
          </section>

          <section style={{ marginTop: '1.5rem', maxWidth: 760 }}>
            <span className="card-label">RECENT DAYS</span>
            <div className="card" style={{ padding: 0, marginTop: '0.75rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-small)' }}>
                <thead>
                  <tr style={{ textAlign: 'left', opacity: 0.6 }}>
                    <th style={{ padding: '0.6rem 0.9rem' }}>Date</th>
                    <th style={{ padding: '0.6rem 0.9rem' }}>Steps</th>
                    <th style={{ padding: '0.6rem 0.9rem' }}>Resting HR</th>
                    <th style={{ padding: '0.6rem 0.9rem' }}>Sleep</th>
                    <th style={{ padding: '0.6rem 0.9rem' }}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {summary!.readings.map((r) => (
                    <tr key={`${r.measured_on}-${r.source}`} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '0.6rem 0.9rem' }}>{r.measured_on}</td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>{r.steps?.toLocaleString() ?? '—'}</td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>{r.resting_hr ?? '—'}</td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>{r.sleep_hours != null ? `${r.sleep_hours} h` : '—'}</td>
                      <td style={{ padding: '0.6rem 0.9rem', opacity: 0.7 }}>{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
