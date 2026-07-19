/**
 * Multi-Agent Intelligence.
 *
 * The graph is driven by real work. Ask a question here and the diagram replays
 * what the server actually did to answer it -- which specialist the router
 * chose and by what margin, what data it was given, what it was refused, and
 * how long each step took.
 *
 * Nothing animates on a timer. AURA's roles are not background processes: one
 * is selected per message, it runs, it returns, and the Digital Twin Core is
 * deliberately the only layer that resolves an answer. Idle nodes are idle
 * because nothing is running, and showing them "thinking" would be inventing
 * system state on the one screen whose whole purpose is to be trustworthy.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Dumbbell, Pill, RotateCcw, Salad, Sparkles, Stethoscope, TrendingUp,
} from 'lucide-react';
import DigitalTwinGraph from '../components/twin/DigitalTwinGraph';
import type { GraphRole } from '../components/twin/DigitalTwinGraph';
import ReasoningPanel from '../components/twin/ReasoningPanel';
import { statesAt } from '../components/twin/status';
import { usePrefersReducedMotion, useTraceReplay } from '../components/twin/useTraceReplay';
import { get, post } from '../lib/api';
import type { ChatResponse, Trace } from '../lib/types';

interface Role {
  key: string;
  label: string;
  description: string;
  reads: string[];
}

const ICONS: Record<string, GraphRole['Icon']> = {
  doctor: Stethoscope,
  nutrition: Salad,
  fitness: Dumbbell,
  medication: Pill,
  prediction: TrendingUp,
};

/** One per specialist, so any of them can be made to run on demand. */
const EXAMPLES = [
  'Explain my cholesterol results',
  'What should I eat for dinner?',
  'How much should I walk each day?',
  'Can I take my medicines together?',
  'Am I on track with my health goals?',
];

export default function AgentsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [reply, setReply] = useState<ChatResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const reduceMotion = usePrefersReducedMotion();
  const { upto, running, compressed, restart } = useTraceReplay(trace, !reduceMotion);

  useEffect(() => {
    get<Role[]>('/api/chat/roles')
      .then(setRoles)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const graphRoles: GraphRole[] = useMemo(
    () => roles.map((r) => ({ key: r.key, label: r.label, Icon: ICONS[r.key] ?? Sparkles })),
    [roles],
  );

  const states = useMemo(
    () => statesAt(trace, roles.map((r) => r.key), upto),
    [trace, roles, upto],
  );

  const ask = async (text: string) => {
    if (!text.trim() || asking) return;
    setAsking(true);
    setError('');
    setSelected(null);
    try {
      const response = await post<ChatResponse>('/api/chat', { message: text });
      setReply(response);
      setTrace(response.trace);
      setQuestion('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach AURA');
    } finally {
      setAsking(false);
    }
  };

  const selectedRole = roles.find((r) => r.key === selected);

  return (
    <main className="page" style={{ maxWidth: 1180 }}>
      <header className="page-head">
        <div>
          <h1>Multi-Agent Intelligence</h1>
          <p>
            Ask something below and watch what actually happens: which specialist
            takes it, what data reaches them, and what does not.
          </p>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading…</p>
      ) : (
        <>
          <section style={{
            background: 'linear-gradient(165deg,#061529,#0b2b4d 55%,#08203c)',
            borderRadius: 22,
            padding: '1.25rem 1.25rem 1.75rem',
            boxShadow: '0 24px 60px rgba(4,20,40,.35)',
          }}>
            <DigitalTwinGraph
              roles={graphRoles}
              trace={trace}
              upto={upto}
              running={running || asking}
              reduceMotion={reduceMotion}
              selected={selected}
              onSelect={setSelected}
            />

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
              {EXAMPLES.map((example) => (
                <button key={example} className="btn ghost"
                  style={{ padding: '6px 12px', fontSize: 13 }}
                  disabled={asking}
                  onClick={() => ask(example)}>
                  {example}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); ask(question); }}
              style={{ display: 'flex', gap: '0.6rem', maxWidth: 620, margin: '1rem auto 0' }}
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Or ask your own question…"
                aria-label="Ask a question to see how it is routed"
                disabled={asking}
                style={{
                  flex: 1, padding: '11px 14px', borderRadius: 12,
                  border: '1px solid rgba(56,189,248,.3)',
                  background: 'rgba(4,20,40,.6)', color: '#e0f2fe', fontSize: 15,
                }}
              />
              <button className="btn primary" disabled={asking || !question.trim()}>
                {asking ? 'Working…' : <>Ask <ArrowRight size={16} /></>}
              </button>
            </form>

            {trace && !running && (
              <div style={{ textAlign: 'center', marginTop: '0.9rem' }}>
                <button className="btn ghost" onClick={restart}
                  style={{ padding: '6px 12px', fontSize: 13 }}>
                  <RotateCcw size={14} /> Replay
                </button>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6, color: '#7dd3fc' }}>
                  {Math.round(trace.total_ms)} ms of real work
                  {/* Said plainly rather than letting the replay imply the model
                      answered faster than it did. */}
                  {compressed && ' · replayed at reduced speed to stay watchable'}
                  {reduceMotion && ' · animation off at your system setting'}
                </div>
              </div>
            )}
          </section>

          {selectedRole && (
            <div style={{ marginTop: '1.5rem' }}>
              <ReasoningPanel
                role={selectedRole}
                state={states[selectedRole.key]}
                Icon={ICONS[selectedRole.key] ?? Sparkles}
                onClose={() => setSelected(null)}
              />
            </div>
          )}

          {reply && (
            <section className="card" style={{ padding: '1.25rem 1.5rem', marginTop: '1.5rem' }}>
              <span className="card-label">{reply.role_label.toUpperCase()} ANSWERED</span>
              <p style={{ marginTop: '0.6rem', whiteSpace: 'pre-wrap' }}>{reply.reply}</p>
            </section>
          )}

          <section className="card" style={{ padding: '1.25rem 1.5rem', marginTop: '1.5rem' }}>
            <span className="card-label">HOW A QUESTION IS ROUTED</span>
            <ol style={{ margin: '0.6rem 0 0', paddingLeft: '1.2rem', lineHeight: 1.9 }}>
              <li><b>Safety screen first.</b> Emergencies are intercepted before any model is called, not filtered afterwards.</li>
              <li><b>Keyword routing.</b> Resolves most questions instantly, without a network call.</li>
              <li><b>Model routing</b> only when keywords are inconclusive, so the common path stays off the network.</li>
              <li><b>Context is assembled for that role alone</b> — de-identified, and limited to its own slices.</li>
            </ol>
            <p style={{ marginTop: '0.9rem', fontSize: 14, opacity: 0.75 }}>
              Select any specialist above to see what it is permitted to read — and what
              it is refused.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
