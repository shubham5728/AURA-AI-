/**
 * Medical Report Analyzer.
 *
 * The page previously opened with the browser's own file control, which told a
 * user nothing about what would happen to a medical document once handed over.
 * The upload target is now the focal point, and what AURA will do with the file
 * is stated before the file is chosen rather than after.
 *
 * Nothing here claims work that does not happen. The pipeline names the three
 * things AURA actually does, and their outcomes are filled in from the real
 * response -- not from a timed animation.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, FlaskConical } from 'lucide-react';
import { get, upload } from '../../lib/api';
import type { Report } from '../../lib/types';
import AnalysisPipeline from './components/AnalysisPipeline';
import type { PipelineOutcome } from './components/AnalysisPipeline';
import ReportCard from './components/ReportCard';
import SupportedPanels from './components/SupportedPanels';
import UploadZone from './components/UploadZone';

const MAX_MB = 10;
const SAMPLE = '/sample-blood-report.png';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<PipelineOutcome | null>(null);

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
      setError(`That file is ${(file.size / 1e6).toFixed(1)} MB. The limit is ${MAX_MB} MB.`);
      return;
    }
    setBusy(true);
    setError('');
    setOutcome(null);
    try {
      const report = await upload<Report>('/api/reports', file);
      const markers = report.biomarkers ?? [];
      setOutcome({
        extracted: markers.length,
        compared: markers.filter((m) => m.ref_low !== null || m.ref_high !== null).length,
        flagged: markers.filter((m) => m.flag === 'low' || m.flag === 'high').length,
      });
      if (report.parse_status !== 'parsed') {
        setError(report.parse_error || 'That report could not be read.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  /** Fetches the bundled sample and pushes it through the real pipeline. */
  const trySample = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await (await fetch(SAMPLE)).blob();
      await send(new File([blob], 'sample-blood-report.png', { type: 'image/png' }));
    } catch {
      setError('Could not load the sample report.');
      setBusy(false);
    }
  };

  const pipelineState = busy ? 'running' : outcome ? 'done' : 'idle';

  return (
    <main className="page" style={{ maxWidth: 1020 }}>
      <header className="page-head">
        <div>
          <h1>Medical Report Analyzer</h1>
          <p>
            Upload a blood report and AURA reads every value, compares it to the range
            printed on your report, and explains what each test measures.
          </p>
        </div>
      </header>

      <div style={{
        display: 'grid', gap: 'var(--space-5)',
        gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
      }}>
        <article className="card" style={{ padding: 'var(--space-5)' }}>
          <UploadZone onFile={send} busy={busy} maxMb={MAX_MB} onSample={trySample} />
        </article>

        <article className="card" style={{ padding: 'var(--space-5)' }}>
          <span className="card-label">
            {pipelineState === 'idle' ? 'WHAT HAPPENS NEXT' : 'ANALYSIS'}
          </span>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <AnalysisPipeline state={pipelineState} outcome={outcome ?? undefined} />
          </div>

          {pipelineState === 'idle' && (
            <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid rgba(128,128,128,0.12)' }}>
              <SupportedPanels />
            </div>
          )}
        </article>
      </div>

      {error && (
        <div className="error" style={{ marginTop: 'var(--space-5)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      <section style={{ marginTop: 'var(--space-5)' }}>
        <span className="card-label">YOUR REPORTS</span>

        {loading ? (
          <p style={{ opacity: 0.7, marginTop: 'var(--space-3)' }}>Loading…</p>
        ) : reports.length === 0 ? (
          <article className="card" style={{ padding: '2rem', textAlign: 'center', marginTop: 'var(--space-3)' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, margin: '0 auto var(--space-4)',
              display: 'grid', placeItems: 'center',
              background: 'rgba(56,132,232,0.10)', color: 'var(--blue)',
            }}>
              <FlaskConical size={22} />
            </div>
            <h3 style={{ margin: '0 0 var(--space-2)' }}>No reports analysed yet</h3>
            <p style={{ opacity: 0.78, maxWidth: 460, margin: '0 auto' }}>
              Your first upload unlocks three things: every value explained in plain
              language, trend charts as more reports arrive, and lab results feeding
              your health score and every AI answer.
            </p>
          </article>
        ) : (
          <div style={{ marginTop: 'var(--space-3)' }}>
            {reports.map((r) => <ReportCard key={r.id} report={r} />)}

            <button className="btn ghost" style={{ marginTop: 'var(--space-2)' }}
              onClick={() => window.location.assign('/app/trends')}>
              See how these values are trending <ArrowRight size={15} />
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
