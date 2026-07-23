/**
 * Wearable data — imported from the user's own export.
 *
 * A browser app cannot pull live from an Apple Watch (no web API) or Fitbit
 * (developer access closed to new apps), and Google Fit's API is retiring. So
 * the honest, free, works-for-everyone path is import: the user uploads the file
 * they exported themselves and AURA reads the real numbers. Nothing here shows a
 * fake live feed or invented values. (If the server is ever given Fitbit
 * credentials, a real "Connect Fitbit" button appears too.)
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity, CheckCircle2, Footprints, HeartPulse, Link2, Moon, RefreshCw,
  Trash2, Upload, Watch,
} from 'lucide-react';
import { del, get, post, upload } from '../lib/api';
import type { FitbitStatus, WearableImport, WearableSummary } from '../lib/types';

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
  const [fitbit, setFitbit] = useState<FitbitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [params, setParams] = useSearchParams();

  const loadAll = async () => {
    try {
      const [s, f] = await Promise.all([
        get<WearableSummary>('/api/wearable'),
        get<FitbitStatus>('/api/wearable/fitbit/status'),
      ]);
      setSummary(s);
      setFitbit(f);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load wearable data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // The Fitbit callback (only reachable when configured) returns here.
  useEffect(() => {
    const outcome = params.get('fitbit');
    if (!outcome) return;
    setNotice(
      outcome === 'connected' ? 'Fitbit connected — your data has been synced.'
        : outcome === 'cancelled' ? 'Fitbit connection was cancelled.'
        : 'Could not connect Fitbit. Please try again.',
    );
    params.delete('fitbit');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectFitbit = async () => {
    setError('');
    try {
      const { url } = await get<{ url: string }>('/api/wearable/fitbit/authorize');
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the Fitbit connection');
    }
  };

  const syncFitbit = async () => {
    setSyncing(true);
    setError('');
    try {
      setSummary(await post<WearableSummary>('/api/wearable/fitbit/sync'));
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sync from Fitbit');
    } finally {
      setSyncing(false);
    }
  };

  const disconnectFitbit = async () => {
    await del('/api/wearable/fitbit');
    await loadAll();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const res = await upload<WearableImport>('/api/wearable/import', file);
      setSummary(res.summary);
      setNotice(`Imported ${res.imported} day${res.imported === 1 ? '' : 's'} from your ${res.source} export.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clear = async () => {
    await del('/api/wearable');
    await loadAll();
  };

  const has = summary && summary.days > 0;

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Wearable Data</h1>
          <p>Bring your real watch and phone data into AURA. It reads only what your export
            actually contains — never a made-up feed.</p>
        </div>
      </header>

      {notice && (
        <div className="card" style={{ padding: '0.85rem 1.1rem', maxWidth: 760, marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent, #2563eb)' }}>
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      {/* Import — the primary, free, works-for-every-device path */}
      <section className="card" style={{ padding: '1.5rem', maxWidth: 760 }}>
        <span className="card-label"><Upload size={14} /> IMPORT YOUR DATA</span>
        <p style={{ fontSize: 'var(--text-small)', opacity: 0.8, margin: '0.5rem 0 1rem' }}>
          Export from your device and drop the file here. From an iPhone: Health app → your
          profile → <b>Export All Health Data</b>. Also accepts a <b>Fitbit/Google Takeout</b>{' '}
          or plain <b>CSV</b> with date, steps, resting heart rate, or sleep columns.
        </p>

        <input ref={fileRef} type="file" accept=".csv,.xml,text/csv,text/xml"
          onChange={(e) => onFile(e.target.files?.[0])} style={{ display: 'none' }} />

        <div
          role="button" tabIndex={0}
          onClick={() => !busy && fileRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files?.[0]); }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '2rem 1rem', borderRadius: 14, cursor: busy ? 'wait' : 'pointer',
            border: `2px dashed ${dragging ? 'var(--accent, #2563eb)' : 'var(--line)'}`,
            background: dragging ? 'var(--accent-soft, rgba(37,99,235,0.08))' : 'transparent',
            transition: 'border-color .15s, background .15s', textAlign: 'center',
          }}
        >
          <Upload size={22} style={{ opacity: 0.7 }} />
          {busy ? <b>Reading your file…</b> : (
            <>
              <b><span style={{ color: 'var(--accent, #2563eb)' }}>Click to choose</span> or drag a file here</b>
              <small style={{ opacity: 0.6 }}>Apple Health .xml or a .csv export</small>
            </>
          )}
        </div>
      </section>

      {/* Honest note on live sync — with a real Fitbit button only if configured */}
      <div style={{ maxWidth: 760, marginTop: '1rem', padding: '0.25rem' }}>
        {fitbit?.connected ? (
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a' }}>
              <CheckCircle2 size={16} /> <b>Fitbit connected</b>
            </span>
            <button className="btn ghost" onClick={syncFitbit} disabled={syncing}>
              <RefreshCw size={14} /> {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <button className="btn ghost" onClick={disconnectFitbit}>Disconnect</button>
            {fitbit.last_synced_at && (
              <small style={{ opacity: 0.6 }}>Last synced {new Date(fitbit.last_synced_at).toLocaleString()}</small>
            )}
          </div>
        ) : fitbit?.configured ? (
          <button className="btn ghost" onClick={connectFitbit}>
            <Link2 size={15} /> Or connect Fitbit for automatic sync
          </button>
        ) : (
          <p style={{ fontSize: 'var(--text-small)', opacity: 0.6, margin: 0, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Watch size={15} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>Live sync isn't offered here: a browser app can't read an Apple Watch (no
              web API), and Fitbit has closed developer access to new apps. Importing your own
              export is the honest, free way to bring in real data.</span>
          </p>
        )}
      </div>

      {error && <div className="error" style={{ marginTop: '1rem', maxWidth: 760 }}>{error}</div>}

      {/* Imported / synced data */}
      {loading ? (
        <p style={{ opacity: 0.7, marginTop: '2rem' }}>Loading…</p>
      ) : !has ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 760,
          marginTop: '1.5rem', padding: '0 0.25rem', opacity: 0.6, fontSize: 'var(--text-small)' }}>
          <Watch size={16} />
          <span>Once imported, your real resting heart rate, sleep and steps appear here —
            and only what the file actually contains.</span>
        </div>
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
