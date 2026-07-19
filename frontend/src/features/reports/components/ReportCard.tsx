/**
 * One analysed report.
 *
 * Moved out of the page unchanged in behaviour: results grouped into the panels
 * a lab prints, each value drawn on its own reference range, findings named
 * before the detail, and the card expanded automatically when something is out
 * of range.
 */

import { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ClipboardPlus } from 'lucide-react';
import BiomarkerRow from '../../../components/BiomarkerRow';
import { PANEL_PURPOSE } from '../../../lib/explanations';
import { groupIntoPanels } from '../../../lib/panels';
import type { Report } from '../../../lib/types';

export default function ReportCard({ report }: { report: Report }) {
  const markers = report.biomarkers || [];
  const abnormal = markers.filter((m) => m.flag === 'low' || m.flag === 'high');
  // Expanded by default when something is out of range: the findings that
  // matter should not be behind a click.
  const [open, setOpen] = useState(abnormal.length > 0);
  const [onlyAbnormal, setOnlyAbnormal] = useState(false);

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
            <p className="t-small" style={{ opacity: 0.75, marginTop: 'var(--space-1)' }}>
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
          {/* Counts at a glance, so the whole report does not have to be read
              to know whether anything needs attention.

              Deliberately no score here. AURA's Health Score combines labs,
              lifestyle and medications; putting a number on a single report
              would look like the same thing and mean something different. */}
          <div style={{
            display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
            padding: '0.9rem 1rem', marginBottom: '1rem',
            borderRadius: 12, background: 'rgba(128,128,128,0.07)',
          }}>
            <div>
              <div className="t-num" style={{ fontSize: 'var(--text-section)', fontWeight: 'var(--w-black)', color: '#16a34a' }}>
                {markers.length - abnormal.length}
              </div>
              <small style={{ opacity: 0.7 }}>within range</small>
            </div>
            <div>
              <div className="t-num" style={{ fontSize: 'var(--text-section)', fontWeight: 'var(--w-black)', color: abnormal.length ? '#d97706' : undefined, opacity: abnormal.length ? 1 : 0.4 }}>
                {abnormal.length}
              </div>
              <small style={{ opacity: 0.7 }}>need attention</small>
            </div>
            <div>
              <div className="t-num" style={{ fontSize: 'var(--text-section)', fontWeight: 'var(--w-black)', opacity: 0.75 }}>{markers.length}</div>
              <small style={{ opacity: 0.7 }}>tests read</small>
            </div>

            {abnormal.length > 0 && (
              <label className="t-small" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input type="checkbox" checked={onlyAbnormal}
                  onChange={(e) => setOnlyAbnormal(e.target.checked)} />
                Show only results needing attention
              </label>
            )}
          </div>

          {groupIntoPanels(onlyAbnormal ? abnormal : markers).map((panel) => {
            const flagged = panel.markers.filter(
              (m) => m.flag === 'low' || m.flag === 'high',
            ).length;

            return (
              <section key={panel.name} style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h4 className="t-card" style={{ margin: 0 }}>{panel.name}</h4>
                  {/* What the panel is for, so the grouping means something to
                      someone who does not already know these tests. */}
                  <span className="t-body" style={{ opacity: 0.7 }}>
                    {PANEL_PURPOSE[panel.name] || ''}
                  </span>
                  {flagged > 0 && (
                    <span className="t-small" style={{ fontWeight: 'var(--w-bold)', color: '#d97706' }}>
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

          <div className="t-body" style={{
            opacity: 0.8,
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
