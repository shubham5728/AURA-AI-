/**
 * Multi-Agent Intelligence.
 *
 * The diagram is generated from the roles the backend actually returns, and its
 * geometry is computed rather than positioned by hand. The previous version
 * placed five nodes at fixed CSS offsets with decorative dotted lines behind
 * them: the spokes did not meet the nodes, one ran off into empty space, and
 * adding a sixth specialist would have required inventing a new coordinate.
 *
 * Drawn as one SVG so the layout scales with its container instead of depending
 * on a viewport width.
 *
 * The claim this page makes is that the specialisation is real. It backs that
 * up by listing each role's context slice, which comes from the server -- the
 * Fitness role genuinely never receives the medication list, and this is where
 * anyone can check.
 */

import { useEffect, useState } from 'react';
import {
  Dumbbell,
  Pill,
  Salad,
  Sparkles,
  Stethoscope,
  TrendingUp,
} from 'lucide-react';
import { get } from '../lib/api';

interface Role {
  key: string;
  label: string;
  description: string;
  reads: string[];
}

const ICONS: Record<string, typeof Pill> = {
  doctor: Stethoscope,
  nutrition: Salad,
  fitness: Dumbbell,
  medication: Pill,
  prediction: TrendingUp,
};

const READS_LABELS: Record<string, string> = {
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

// Diagram geometry. A square viewBox keeps the spokes symmetrical whatever
// width the card ends up being.
const SIZE = 560;
const CENTER = SIZE / 2;
const ORBIT = 190;
const NODE_R = 52;
const HUB_R = 62;

/** Node centre for index i, first one at the top and the rest evenly around. */
function nodePosition(i: number, total: number) {
  const angle = (-90 + (360 / total) * i) * (Math.PI / 180);
  return {
    x: CENTER + ORBIT * Math.cos(angle),
    y: CENTER + ORBIT * Math.sin(angle),
    angle,
  };
}

function Diagram({ roles }: { roles: Role[] }) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img"
      aria-label={`Digital Twin core connected to ${roles.length} specialist roles`}
      style={{ maxHeight: 520, display: 'block', margin: '0 auto' }}>
      <defs>
        <radialGradient id="hubGlow">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="70%" stopColor="#1d4ed8" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CENTER} cy={CENTER} r={ORBIT + NODE_R} fill="url(#hubGlow)" />

      {/* Spokes are drawn first and stop at each circle's edge rather than its
          centre, so no line is visible underneath a node. */}
      {roles.map((role, i) => {
        const { x, y, angle } = nodePosition(i, roles.length);
        const from = {
          x: CENTER + HUB_R * Math.cos(angle),
          y: CENTER + HUB_R * Math.sin(angle),
        };
        const to = {
          x: x - NODE_R * Math.cos(angle),
          y: y - NODE_R * Math.sin(angle),
        };
        const on = active === role.key;
        return (
          <line key={role.key} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={on ? '#38bdf8' : '#38bdf8'}
            strokeOpacity={on ? 0.9 : 0.28}
            strokeWidth={on ? 2.5 : 1.5}
            strokeDasharray={on ? undefined : '5 6'} />
        );
      })}

      <circle cx={CENTER} cy={CENTER} r={HUB_R} fill="#0b2545"
        stroke="#38bdf8" strokeOpacity={0.55} strokeWidth={1.5} />
      <g transform={`translate(${CENTER - 11}, ${CENTER - 26})`} color="#7dd3fc">
        <Sparkles size={22} />
      </g>
      <text x={CENTER} y={CENTER + 8} textAnchor="middle" fill="#e0f2fe"
        fontSize="12.5" fontWeight="700" letterSpacing="0.06em">
        DIGITAL TWIN
      </text>
      <text x={CENTER} y={CENTER + 26} textAnchor="middle" fill="#7dd3fc"
        fontSize="10.5" opacity={0.85}>
        Reasoning core
      </text>

      {roles.map((role, i) => {
        const { x, y } = nodePosition(i, roles.length);
        const Icon = ICONS[role.key] ?? Sparkles;
        const on = active === role.key;
        return (
          <g key={role.key}
            onMouseEnter={() => setActive(role.key)}
            onMouseLeave={() => setActive(null)}
            style={{ cursor: 'default' }}>
            <circle cx={x} cy={y} r={NODE_R} fill="#0b2545"
              stroke="#38bdf8" strokeOpacity={on ? 0.85 : 0.4}
              strokeWidth={on ? 2 : 1.2} />
            <g transform={`translate(${x - 9}, ${y - 24})`} color="#7dd3fc">
              <Icon size={18} />
            </g>
            {/* Two lines so longer names do not overflow the circle. */}
            {role.label.split(' ').map((word, w, all) => (
              <text key={w} x={x} y={y + 4 + w * 12 - (all.length - 1) * 5}
                textAnchor="middle" fill="#e0f2fe" fontSize="11" fontWeight="600">
                {word}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export default function AgentsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    get<Role[]>('/api/chat/roles')
      .then(setRoles)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page" style={{ maxWidth: 1100 }}>
      <header className="page-head">
        <div>
          <h1>Multi-Agent Intelligence</h1>
          <p>
            {roles.length || 'Five'} specialist roles, one reasoning core. Each receives
            a different slice of your Digital Twin.
          </p>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading…</p>
      ) : (
        <>
          <section style={{
            background: 'linear-gradient(160deg,#071a33,#0a2748)',
            borderRadius: 20, padding: '1.5rem', marginBottom: '2rem',
          }}>
            <Diagram roles={roles} />
          </section>

          {/* How a message reaches a role. Stated because it is the question
              anyone technical asks next, and the answer is specific. */}
          <section className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
            <span className="card-label">HOW A QUESTION IS ROUTED</span>
            <ol style={{ margin: '0.6rem 0 0', paddingLeft: '1.2rem', lineHeight: 1.9 }}>
              <li>
                <b>Safety screen first.</b> Emergencies are intercepted before any
                model is called, not filtered afterwards.
              </li>
              <li>
                <b>Keyword routing.</b> Resolves most questions instantly and without a
                network call.
              </li>
              <li>
                <b>Model routing</b> only when keywords are inconclusive, so the common
                path stays off the network.
              </li>
              <li>
                <b>Context is assembled for that role alone</b> — de-identified, and
                limited to the slices listed below.
              </li>
            </ol>
          </section>

          <span className="card-label">WHAT EACH ROLE RECEIVES</span>
          <div style={{
            display: 'grid', gap: '1rem', marginTop: '0.6rem',
            gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
          }}>
            {roles.map((role) => {
              const Icon = ICONS[role.key] ?? Sparkles;
              return (
                <article className="card" key={role.key} style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                    <div className="file-icon"><Icon size={18} /></div>
                    <div style={{ minWidth: 0 }}>
                      <b style={{ fontSize: 16 }}>{role.label}</b>
                      <p style={{ margin: '0.2rem 0 0', opacity: 0.75, fontSize: 14 }}>
                        {role.description}
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.9rem' }}>
                    <small style={{ opacity: 0.6, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em' }}>
                      READS
                    </small>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                      {role.reads.map((key) => (
                        <span key={key} style={{
                          padding: '4px 10px', borderRadius: 999, fontSize: 12.5,
                          background: 'rgba(56,132,232,0.10)', color: 'var(--blue)',
                          fontWeight: 600,
                        }}>
                          {READS_LABELS[key] || key.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <p style={{ marginTop: '1.5rem', fontSize: 14, opacity: 0.75 }}>
            Nothing outside a role's list reaches it. Narrower context produces sharper
            answers, sends less data to a third party, and makes an off-topic answer
            structurally harder.
          </p>
        </>
      )}
    </main>
  );
}
