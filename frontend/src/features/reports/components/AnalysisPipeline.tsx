/**
 * What AURA does to a report.
 *
 * Two honest departures from how these are usually built.
 *
 * There is no OCR step, because AURA does not use OCR. A multimodal model reads
 * the page directly -- generic OCR flattens a lab table and loses which number
 * belongs to which test, which is the reason that approach was rejected.
 * Listing it would advertise a pipeline the product does not have.
 *
 * And the steps do not tick off one by one while waiting. Parsing is a single
 * request; the server does not report sub-step progress, so staged ticks would
 * be a timed animation pretending to be telemetry. Instead every step shows as
 * in-flight together, and each one is filled in with its real outcome once the
 * response lands -- 16 values found, 16 compared, 0 outside range.
 */

import { Check, Database, Loader2, ScanLine, Scale } from 'lucide-react';
import type { ComponentType } from 'react';
import { STATUS_COLOUR } from '../../../components/ui/tokens';

export interface PipelineOutcome {
  extracted: number;
  compared: number;
  flagged: number;
}

interface Props {
  state: 'idle' | 'running' | 'done' | 'failed';
  outcome?: PipelineOutcome;
}

interface Step {
  key: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  idle: string;
  result: (o: PipelineOutcome) => string;
}

const STEPS: Step[] = [
  {
    key: 'read',
    label: 'Read the page',
    Icon: ScanLine,
    idle: 'A multimodal model reads the image directly, keeping the table intact',
    result: (o) => `${o.extracted} value${o.extracted === 1 ? '' : 's'} found`,
  },
  {
    key: 'compare',
    label: 'Compare to reference ranges',
    Icon: Scale,
    idle: 'Done in AURA’s own code, never by the model',
    result: (o) => `${o.compared} compared · ${o.flagged} outside range`,
  },
  {
    key: 'store',
    label: 'Add to your Digital Twin',
    Icon: Database,
    idle: 'Values join your trends, score and AI context',
    result: () => 'Saved to your record',
  },
];

export default function AnalysisPipeline({ state, outcome }: Props) {
  if (state === 'idle') {
    return (
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {STEPS.map((step, i) => (
          <div key={step.key} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <span style={{
              width: 28, height: 28, borderRadius: 9, flexShrink: 0,
              display: 'grid', placeItems: 'center',
              background: 'rgba(128,128,128,0.10)', opacity: 0.8,
            }}>
              <step.Icon size={14} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 'var(--w-semibold)' }}>
                {i + 1}. {step.label}
              </div>
              <small style={{ opacity: 0.7 }}>{step.idle}</small>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const running = state === 'running';

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      {STEPS.map((step) => {
        const colour = running ? 'var(--blue)' : STATUS_COLOUR.good;
        return (
          <div key={step.key} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <span style={{
              width: 28, height: 28, borderRadius: 9, flexShrink: 0,
              display: 'grid', placeItems: 'center',
              background: running ? 'rgba(56,132,232,0.12)' : 'rgba(22,163,74,0.12)',
              color: colour,
            }}>
              {running ? <Loader2 size={14} className="twin-spin" /> : <Check size={14} />}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 'var(--w-semibold)' }}>{step.label}</div>
              <small style={{ opacity: 0.75 }}>
                {running || !outcome ? 'Working…' : step.result(outcome)}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}
