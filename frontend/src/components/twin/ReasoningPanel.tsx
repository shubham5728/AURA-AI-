/**
 * What one specialist did, or would do.
 *
 * Opens when a node is selected. Everything it shows comes from the trace or
 * from the role definition on the server -- there is no "confidence: 87%"
 * invented for the sake of having a number. Where the system genuinely does not
 * know something, the panel says so.
 */

import { X } from 'lucide-react';
import type { ComponentType } from 'react';
import type { AgentState } from './status';
import { STATUS_META } from './status';

const SLICE_LABELS: Record<string, string> = {
  profile: 'profile',
  conditions: 'conditions',
  allergies: 'allergies',
  goals: 'goals',
  all_markers: 'all lab results',
  metabolic_markers: 'sugar & cholesterol',
  marker_trends: 'result history',
  score: 'health score',
  medications: 'medications',
  interactions: 'drug interactions',
  recent_logs: 'daily logs',
  activity_logs: 'steps & sleep',
  diet_logs: 'hydration logs',
};

const label = (key: string) => SLICE_LABELS[key] ?? key.replace(/_/g, ' ');

interface Props {
  role: { key: string; label: string; description: string; reads: string[] };
  state: AgentState;
  Icon: ComponentType<{ size?: number }>;
  onClose: () => void;
}

function Chip({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
      background: muted ? 'rgba(128,128,128,0.10)' : 'rgba(56,132,232,0.12)',
      color: muted ? 'var(--muted)' : 'var(--blue)',
      textDecoration: muted ? 'line-through' : undefined,
    }}>
      {text}
    </span>
  );
}

export default function ReasoningPanel({ role, state, Icon, onClose }: Props) {
  const meta = STATUS_META[state.status];
  const ran = state.status !== 'idle' && state.status !== 'considered';

  return (
    <article className="card" style={{ padding: '1.35rem' }}>
      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
        <div className="file-icon"><Icon size={18} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 16 }}>{role.label}</b>
          <p style={{ margin: '0.15rem 0 0', opacity: 0.75, fontSize: 14 }}>
            {role.description}
          </p>
        </div>
        <button className="btn ghost" onClick={onClose} aria-label="Close details">
          <X size={15} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1.1rem' }}>
        <div>
          <small style={{ opacity: 0.6 }}>Status</small>
          <div style={{ fontWeight: 700, color: meta.colour }}>{meta.label}</div>
        </div>

        {state.score !== undefined && (
          <div>
            <small style={{ opacity: 0.6 }}>Router score</small>
            {/* The router's actual keyword evidence, not a confidence
                percentage. Calling it a probability would dress a word count
                up as something it is not. */}
            <div style={{ fontWeight: 700 }}>{state.score}</div>
          </div>
        )}

        {state.ms !== undefined && (
          <div>
            <small style={{ opacity: 0.6 }}>Time taken</small>
            <div style={{ fontWeight: 700 }}>{Math.round(state.ms)} ms</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.1rem' }}>
        <small style={{ opacity: 0.6 }}>
          {ran ? 'Data it received' : 'Data it may read'}
        </small>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {(ran && state.sections?.length ? state.sections : role.reads).map((s) => (
            <Chip key={s} text={label(s)} />
          ))}
        </div>
      </div>

      {ran && (state.withheld?.length ?? 0) > 0 && (
        <div style={{ marginTop: '0.9rem' }}>
          <small style={{ opacity: 0.6 }}>Withheld — not permitted to this role</small>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {state.withheld!.map((s) => <Chip key={s} text={label(s)} muted />)}
          </div>
        </div>
      )}

      {!ran && (
        <p style={{ marginTop: '1rem', fontSize: 13.5, opacity: 0.7 }}>
          This specialist did not handle the last question. Ask something in its area
          and the graph will show it running.
        </p>
      )}
    </article>
  );
}
