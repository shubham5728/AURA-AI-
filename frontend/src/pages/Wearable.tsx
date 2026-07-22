/**
 * Connect a device — honestly.
 *
 * A browser app can only sync from one smartwatch platform for real: Fitbit,
 * via OAuth. Apple Health has no web API and Google Fit's is retiring, so those
 * devices route to importing an export file instead. Nothing here shows a fake
 * connected state or invented numbers: Fitbit reads "connected" only when tokens
 * exist, and if the server has no Fitbit credentials it says setup is needed.
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

  // The Fitbit callback sends the browser back with ?fitbit=connected|cancelled|error.
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
      window.location.href = url; // full-page redirect into Fitbit's consent screen
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
          <h1>Connect a Device</h1>
          <p>Link Fitbit to sync automatically, or import an export from any other device.
            AURA only ever shows the real numbers from your account — never a fake feed.</p>
        </div>
      </header>

      {notice && (
        <div className="card" style={{ padding: '0.85rem 1.1rem', maxWidth: 760, marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent, #2563eb)' }}>
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      {/* Fitbit — the real device connection */}
      <section className="card" style={{ padding: '1.5rem', maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center',
            background: 'rgba(0,178,169,0.14)', color: '#00b2a9' }}><Watch size={18} /></span>
          <div style={{ flex: 1 }}>
            <b>Fitbit</b>
            <div style={{ fontSize: 'var(--text-small)', opacity: 0.7 }}>Automatic sync over your Fitbit account</div>
          </div>
          {fitbit?.connected && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a', fontSize: 'var(--text-small)' }}>
              <CheckCircle2 size={15} /> Connected
            </span>
          )}
        </div>

        <div style={{ marginTop: '1rem' }}>
          {!fitbit ? (
            <p style={{ opacity: 0.7 }}>Checking…</p>
          ) : !fitbit.configured ? (
            <p style={{ fontSize: 'var(--text-small)', opacity: 0.7 }}>
              Fitbit sync isn't set up on this server yet. Once Fitbit API credentials are
              added, a <b>Connect Fitbit</b> button appears here.
            </p>
          ) : fitbit.connected ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn primary" onClick={syncFitbit} disabled={syncing}>
                <RefreshCw size={15} /> {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button className="btn ghost" onClick={disconnectFitbit}>Disconnect</button>
              {fitbit.last_synced_at && (
                <small style={{ opacity: 0.6 }}>
                  Last synced {new Date(fitbit.last_synced_at).toLocaleString()}
                </small>
              )}
            </div>
          ) : (
            <button className="btn primary" onClick={connectFitbit}>
              <Link2 size={16} /> Connect Fitbit
            </button>
          )}
        </div>
      </section>

      {/* Everything else — import fallback */}
      <section className="card" style={{ padding: '1.5rem', maxWidth: 760, marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.35rem' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center',
            background: 'var(--surface2, rgba(128,128,128,0.1))' }}><Upload size={17} /></span>
          <div>
            <b>Apple Watch &amp; other devices</b>
            <div style={{ fontSize: 'var(--text-small)', opacity: 0.7 }}>Import an export — no browser sync exists for these</div>
          </div>
        </div>
        <p style={{ fontSize: 'var(--text-small)', opacity: 0.8, margin: '0.5rem 0 1rem' }}>
          Apple Health has no web connection, so export your data from the Health app (or
          Fitbit/Google Takeout) and drop it here. Accepts an <b>Apple Health</b>{' '}
          <code>export.xml</code> or a <b>CSV</b> with date, steps, resting heart rate, or
          sleep columns.
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
            padding: '1.75rem 1rem', borderRadius: 14, cursor: busy ? 'wait' : 'pointer',
            border: `2px dashed ${dragging ? 'var(--accent, #2563eb)' : 'var(--line)'}`,
            background: dragging ? 'var(--accent-soft, rgba(37,99,235,0.08))' : 'transparent',
            transition: 'border-color .15s, background .15s', textAlign: 'center',
          }}
        >
          <Upload size={20} style={{ opacity: 0.7 }} />
          {busy ? <b>Reading your file…</b> : (
            <>
              <b><span style={{ color: 'var(--accent, #2563eb)' }}>Click to choose</span> or drag a file here</b>
              <small style={{ opacity: 0.6 }}>Apple Health .xml or a .csv export</small>
            </>
          )}
        </div>
      </section>

      {error && <div className="error" style={{ marginTop: '1rem', maxWidth: 760 }}>{error}</div>}

      {/* Synced / imported data */}
      {loading ? (
        <p style={{ opacity: 0.7, marginTop: '2rem' }}>Loading…</p>
      ) : !has ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 760,
          marginTop: '1.25rem', padding: '0 0.25rem', opacity: 0.6, fontSize: 'var(--text-small)' }}>
          <Watch size={16} />
          <span>Once connected or imported, your real resting heart rate, sleep and steps
            appear here — and only what your data actually contains.</span>
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
