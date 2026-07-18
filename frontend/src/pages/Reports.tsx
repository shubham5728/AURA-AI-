/**
 * Medical Report Analyzer.
 *
 * Replaces the version inside the single-file component, which rendered every
 * extracted value as an identical chip. Sixteen identical chips reproduce the
 * problem the feature is meant to solve -- the paper report is already a flat
 * wall of numbers.
 *
 * Here the summary leads with what needs attention, results are grouped into
 * the panels a lab prints, and each value is shown against its own reference
 * range.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ClipboardPlus, Upload } from 'lucide-react';
import BiomarkerRow from '../components/BiomarkerRow';
import { get, upload } from '../lib/api';
import { PANEL_PURPOSE } from '../lib/explanations';
import { groupIntoPanels } from '../lib/panels';
import type { Report } from '../lib/types';

const MAX_MB = 10;

function ReportCard({ report }: { report: Report }) {
  const markers = report.biomarkers || [];
  const abnormal = markers.filter((m) => m.flag === 'low' || m.flag === 'high');
  // Expanded by default when something is out of range: the findings that
  // matter should not be behind a click.
  const [open, setOpen] = useState(abnormal.length > 0);

  const measured = markers.find((m) => m.measured_at)?.measured_at;
  const failed = report.parse_status !== 'parsed';

  return (
    <article className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
      <header style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div className="file-icon"><ClipboardPlus /></div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{measured ? `Blood report · ${measured}` : `Report uploaded ${report.created_at.slice(0, 10)}`}</b>

          {failed ? (
            <p style={{ opacity: 0.8, marginTop: '0.25rem' }}>
              {report.parse_error || 'This report could not be read.'}
            </p>
          ) : (
            <p style={{ marginTop: '0.25rem' }}>
              {abnormal.length === 0 ? (
                <span style={{ color: '#16a34a', fontWeight: 600 }}>
                  <Check size={14} /> All {markers.length} results within their normal ranges
                </span>
              ) : (
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                  <AlertTriangle size={14} /> {abnormal.length} of {markers.length} results outside
                  the normal range
                </span>
              )}
            </p>
          )}

          {/* Named up front so the finding is visible without expanding. */}
          {abnormal.length > 0 && !open && (
            <p style={{ fontSize: 13, opacity: 0.75, marginTop: '0.35rem' }}>
              {abnormal.map((m) => m.label).join(' · ')}
            </p>
          )}
        </div>

        {markers.length > 0 && (
          <button className="btn ghost" onClick={() => setOpen(!open)}
            aria-expanded={open}>
            {open ? 'Hide' : 'View'} results
            <ChevronDown size={15}
              style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
          </button>
        )}
      </header>

      {open && markers.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          {groupIntoPanels(markers).map((panel) => {
            const flagged = panel.markers.filter(
              (m) => m.flag === 'low' || m.flag === 'high',
            ).length;

            return (
              <section key={panel.name} style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, fontSize: 15 }}>{panel.name}</h4>
                  {/* What the panel is for, so the grouping means something to
                      someone who does not already know these tests. */}
                  <span style={{ fontSize: 13, opacity: 0.65 }}>
                    {PANEL_PURPOSE[panel.name] || ''}
                  </span>
                  {flagged > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>
                      {flagged} need{flagged === 1 ? 's' : ''} attention
                    </span>
                  )}
                </div>

                {panel.markers.map((m) => (
                  <BiomarkerRow key={m.id} marker={m} />
                ))}
              </section>
            );
          })}

          <div style={{
            fontSize: 13,
            opacity: 0.75,
            borderTop: '1px solid rgba(128,128,128,0.14)',
            paddingTop: '0.85rem',
          }}>
            <b>How to read this.</b> "Normal" means your value falls inside the range
            printed on your report for that test. A value outside the range is not a
            diagnosis on its own — it is a reason to ask your doctor about it. AURA
            compares numbers to ranges; it does not decide what they mean for you.
          </div>
        </div>
      )}
    </article>
  );
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const list = await get<Report[]>('/api/reports');
      // The list endpoint omits biomarkers; the cards need them.
      const detailed = await Promise.all(
        list.map((r) => get<Report>(`/api/reports/${r.id}`).catch(() => r)),
      );
      setReports(detailed);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const send = async (file: File) => {
    if (file.size > MAX_MB * 1e6) {
      setError(`File must be smaller than ${MAX_MB} MB.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await upload('/api/reports', file);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Medical Report Analyzer</h1>
          <p>Upload a lab report and AURA reads the values against their reference ranges.</p>
        </div>
      </header>

      <label
        className={drag ? 'upload-zone drag' : 'upload-zone'}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files[0];
          if (file) send(file);
        }}
      >
        <input ref={inputRef} type="file" accept=".pdf,image/*"
          onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
        <div className="upload-icon"><Upload /></div>
        <h3>{busy ? 'Reading your report…' : 'Drop a health report here'}</h3>
        <p>PDF, PNG or JPG · Read by AI · Maximum {MAX_MB} MB</p>
        <span className="btn primary">Choose a file</span>
        {busy && <div className="upload-progress"><span /></div>}
      </label>

      {error && <div className="error" style={{ marginTop: '1rem' }}>{error}</div>}

      <section style={{ marginTop: '2rem' }}>
        <span className="card-label">ANALYSIS HISTORY</span>
        {loading ? (
          <p style={{ opacity: 0.7 }}>Loading…</p>
        ) : reports.length === 0 ? (
          <p style={{ opacity: 0.7 }}>
            No reports yet. Upload one and its values will appear here and in your trends.
          </p>
        ) : (
          reports.map((r) => <ReportCard key={r.id} report={r} />)
        )}
      </section>
    </main>
  );
}
