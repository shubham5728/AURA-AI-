/**
 * What AURA did to answer the last question.
 *
 * Most health assistants are a box: a question goes in, an answer comes out,
 * and the person is asked to trust everything in between. This shows the
 * between.
 *
 * Every number here is measured server-side. Stages reveal in sequence because
 * that reads better than five rows appearing at once, but the durations, the
 * routing scores, the slices withheld and the context text are all exactly what
 * happened -- nothing here is illustrative.
 *
 * The most important element is the withheld list. Any product can claim its
 * agents are specialised; this names the data each one was refused.
 */

import { useEffect, useState } from 'react';
import {
  Brain,
  ChevronDown,
  Database,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type { Trace, TraceStage } from '../lib/types';

const STAGE_ICON: Record<string, typeof Brain> = {
  safety_in: ShieldCheck,
  routing: Brain,
  context: Database,
  generation: Sparkles,
  safety_out: ShieldAlert,
};

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

const label = (key: string) => SLICE_LABELS[key] || key.replace(/_/g, ' ');

function Chip({ text, muted = false }: { text: string; muted?: boolean }) {
  return (
    <span style={{
      padding: '3px 9px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: muted ? 'rgba(128,128,128,0.10)' : 'rgba(56,132,232,0.12)',
      color: muted ? 'var(--muted)' : 'var(--blue)',
      textDecoration: muted ? 'line-through' : undefined,
      opacity: muted ? 0.7 : 1,
    }}>
      {text}
    </span>
  );
}

function StageRow({ stage, slowest, index, revealed }: {
  stage: TraceStage;
  slowest: number;
  index: number;
  revealed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const Icon = STAGE_ICON[stage.name] ?? Brain;
  const blocked = stage.data.blocked === true;
  const flagged = (stage.data.warnings?.length ?? 0) > 0;
  const colour = blocked ? '#dc2626' : flagged ? '#d97706' : '#16a34a';

  return (
    <div style={{
      opacity: revealed ? 1 : 0,
      transform: revealed ? 'translateY(0)' : 'translateY(6px)',
      transition: `opacity .35s ease ${index * 0.05}s, transform .35s ease ${index * 0.05}s`,
      borderTop: index === 0 ? undefined : '1px solid rgba(128,128,128,0.12)',
      padding: '0.7rem 0',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
          width: '100%', background: 'none', border: 0, padding: 0,
          textAlign: 'left', cursor: 'pointer', color: 'inherit',
        }}
      >
        <span style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          display: 'grid', placeItems: 'center',
          background: `${colour}1a`, color: colour,
        }}>
          <Icon size={14} />
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <b style={{ fontSize: 14 }}>{stage.label}</b>
            <small style={{ opacity: 0.6, whiteSpace: 'nowrap' }}>
              {stage.ms < 1 ? '<1' : Math.round(stage.ms)} ms
            </small>
          </span>
          <span style={{ display: 'block', fontSize: 13, opacity: 0.75, marginTop: 1 }}>
            {stage.detail}
          </span>

          {/* Bar length is the share of total time, so the model call visibly
              dominates and the local steps read as near-free. */}
          <span style={{
            display: 'block', height: 3, borderRadius: 2, marginTop: 6,
            width: `${Math.max(2, (stage.ms / slowest) * 100)}%`,
            background: colour, opacity: 0.5,
          }} />
        </span>

        <ChevronDown size={14} style={{
          flexShrink: 0, opacity: 0.5, marginTop: 6,
          transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s',
        }} />
      </button>

      {open && (
        <div style={{ paddingLeft: '2.1rem', marginTop: '0.6rem', fontSize: 13 }}>
          {stage.name === 'routing' && stage.data.scores && (
            <>
              <small style={{ opacity: 0.6 }}>Keyword score per role</small>
              <div style={{ marginTop: 6 }}>
                {Object.entries(stage.data.scores)
                  .sort((a, b) => b[1] - a[1])
                  .map(([role, score]) => {
                    const won = role === stage.data.chosen;
                    const max = Math.max(...Object.values(stage.data.scores!), 1);
                    return (
                      <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ width: 90, fontSize: 12, fontWeight: won ? 700 : 400, opacity: won ? 1 : 0.65 }}>
                          {role}
                        </span>
                        <span style={{
                          height: 6, borderRadius: 3, flex: `0 0 ${(score / max) * 60}%`,
                          minWidth: 2,
                          background: won ? 'var(--blue)' : 'rgba(128,128,128,0.35)',
                        }} />
                        <small style={{ opacity: 0.55 }}>{score}</small>
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {stage.name === 'context' && (
            <>
              <small style={{ opacity: 0.6 }}>Sent to this specialist</small>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '5px 0 10px' }}>
                {(stage.data.sections ?? []).map((s) => <Chip key={s} text={label(s)} />)}
              </div>
              {(stage.data.withheld?.length ?? 0) > 0 && (
                <>
                  {/* The claim other products only assert. */}
                  <small style={{ opacity: 0.6 }}>Withheld — this specialist is not permitted it</small>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '5px 0 10px' }}>
                    {stage.data.withheld!.map((s) => <Chip key={s} text={label(s)} muted />)}
                  </div>
                </>
              )}

              {/* Kept separate from "withheld": this specialist may read these,
                  the user just has no such data yet. Merging the two would
                  claim a restriction that is not being applied. */}
              {(stage.data.empty?.length ?? 0) > 0 && (
                <>
                  <small style={{ opacity: 0.6 }}>Permitted, but you have no data yet</small>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                    {stage.data.empty!.map((s) => <Chip key={s} text={label(s)} muted />)}
                  </div>
                </>
              )}
            </>
          )}

          {stage.name === 'safety_out' && (
            <div style={{ opacity: 0.75 }}>
              {stage.data.numbers_checked ?? 0} figures from your records were available;
              every number in the reply was checked against them.
            </div>
          )}

          {stage.name === 'safety_in' && (
            <div style={{ opacity: 0.75 }}>
              {blocked
                ? 'The model was never called. This reply came from the safety layer.'
                : 'Screened before any model call, so an emergency can never wait on a generated answer.'}
            </div>
          )}

          {stage.name === 'generation' && (
            <div style={{ opacity: 0.75 }}>
              {stage.data.history_turns ?? 0} earlier turns included for context.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TracePanel({ trace, thinking }: {
  trace: Trace | null;
  thinking: boolean;
}) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!trace) return;
    setRevealed(0);
    const timers = trace.stages.map((_, i) =>
      setTimeout(() => setRevealed((n) => Math.max(n, i + 1)), 120 * i),
    );
    return () => timers.forEach(clearTimeout);
  }, [trace]);

  const [showContext, setShowContext] = useState(false);

  if (thinking) {
    return (
      <aside className="card" style={{ padding: '1.25rem' }}>
        <span className="card-label">AURA IS WORKING</span>
        <p style={{ opacity: 0.7, fontSize: 14, marginTop: '0.5rem' }}>
          Screening, routing, gathering your data…
        </p>
      </aside>
    );
  }

  if (!trace || trace.stages.length === 0) {
    return (
      <aside className="card" style={{ padding: '1.25rem' }}>
        <span className="card-label">HOW AURA ANSWERS</span>
        <p style={{ opacity: 0.75, fontSize: 14, marginTop: '0.5rem' }}>
          Ask a question and this panel will show exactly what happened: which
          specialist handled it, what data was sent, what was withheld, and how
          long each step took.
        </p>
      </aside>
    );
  }

  const slowest = Math.max(...trace.stages.map((s) => s.ms), 1);

  return (
    <aside className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="card-label">HOW THIS ANSWER WAS PRODUCED</span>
        <small style={{ opacity: 0.6 }}>{Math.round(trace.total_ms)} ms total</small>
      </div>

      <div style={{ marginTop: '0.6rem' }}>
        {trace.stages.map((stage, i) => (
          <StageRow key={stage.name} stage={stage} index={i} slowest={slowest}
            revealed={i < revealed} />
        ))}
      </div>

      {trace.context_sent && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(128,128,128,0.12)', paddingTop: '0.9rem' }}>
          <button onClick={() => setShowContext(!showContext)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none',
              border: 0, padding: 0, cursor: 'pointer', color: 'var(--blue)',
              fontWeight: 600, fontSize: 13,
            }}>
            <MessageSquare size={14} />
            {showContext ? 'Hide' : 'Show'} the exact data sent
          </button>

          {showContext && (
            <>
              <pre style={{
                marginTop: '0.7rem', padding: '0.8rem', borderRadius: 10,
                background: 'rgba(128,128,128,0.08)', fontSize: 12,
                whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto',
              }}>
                {trace.context_sent}
              </pre>
              {/* The point of showing it: the reader can check for themselves. */}
              <small style={{ opacity: 0.7, display: 'block', marginTop: '0.5rem' }}>
                This is the complete text the model received. Your name, email and date
                of birth are not in it — only an age, a sex and the values themselves.
              </small>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
