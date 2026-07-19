/**
 * The Digital Twin, as the first thing anyone sees.
 *
 * The figure is the focal point: it fills most of the frame and the orbit sits
 * around it rather than dwarfing it. Its cropped lower edge -- the source PNG
 * ends at the ankles, row 1023 of 1024 -- is masked into the platform, which
 * turns a defect into a horizon.
 *
 * Motion here is ambient, not informational. The body breathes, a scan line
 * travels, motes drift, the orbit turns. None of it claims that anything is
 * being measured, because on a login page nobody is signed in and nothing is.
 *
 * That is also why the nodes carry no status, confidence or "last sync". None
 * of those exist for anyone yet, so displaying them would be a performance for
 * a stranger. What is true is what each specialist is for and what it may read,
 * which is the more useful thing for someone deciding whether to hand over
 * their medical records. The live version, driven by a real trace, is the
 * Multi-Agent page after sign-in.
 */

import { useEffect, useState } from 'react';
import {
  Dumbbell, Pill, Salad, Sparkles, Stethoscope, TrendingUp,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { get } from '../../lib/api';

interface Role {
  key: string;
  label: string;
  description?: string;
  reads?: string[];
}

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  doctor: Stethoscope,
  nutrition: Salad,
  fitness: Dumbbell,
  medication: Pill,
  prediction: TrendingUp,
};

/** A distinct accent per specialist, so selection is felt as well as read. */
const ACCENT: Record<string, string> = {
  doctor: '#7dd3fc',
  nutrition: '#4ade80',
  fitness: '#fbbf24',
  medication: '#f472b6',
  prediction: '#a78bfa',
};

const READS: Record<string, string> = {
  profile: 'profile',
  conditions: 'conditions',
  allergies: 'allergies',
  goals: 'goals',
  all_markers: 'lab results',
  metabolic_markers: 'sugar & cholesterol',
  marker_trends: 'result history',
  score: 'health score',
  medications: 'medications',
  interactions: 'drug interactions',
  recent_logs: 'daily logs',
  activity_logs: 'steps & sleep',
  diet_logs: 'hydration',
};

/**
 * Rendered immediately and kept if the roster cannot be fetched. The backend
 * sleeps on its free tier and takes close to a minute to wake; a first screen
 * must not wait on it. These are the real five with their real remits.
 */
const FALLBACK: Role[] = [
  { key: 'doctor', label: 'General Health', description: 'Symptoms, history and lab report interpretation' },
  { key: 'nutrition', label: 'Nutrition', description: 'Diet, food choices and caloric balance' },
  { key: 'fitness', label: 'Fitness', description: 'Exercise, activity and sleep' },
  { key: 'medication', label: 'Medication', description: 'Prescriptions, interactions and timing' },
  { key: 'prediction', label: 'Health Trends', description: 'Trajectories, risks and what-if projections' },
];

const SIZE = 520;
const C = SIZE / 2;
const ORBIT = 206;
const NODE = 36;
const FIGURE_W = 250;
const FIGURE_H = 404;

const MOTES = [
  [58, 104], [452, 78], [92, 420], [470, 386], [268, 40],
  [30, 262], [492, 246], [186, 486], [356, 482], [418, 152],
];

export default function LoginHero() {
  const [roles, setRoles] = useState<Role[]>(FALLBACK);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<Role[]>('/api/chat/roles')
      .then((live) => { if (!cancelled && live.length) setRoles(live); })
      // A login page should not surface an error because a specialist list
      // failed to load. The fallback is accurate, so keeping it is correct.
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const position = (i: number) => {
    const angle = ((-90 + (360 / roles.length) * i) * Math.PI) / 180;
    return { x: C + ORBIT * Math.cos(angle), y: C + ORBIT * Math.sin(angle), angle };
  };

  const selected = roles.find((r) => r.key === active) ?? null;
  const accent = selected ? ACCENT[selected.key] ?? '#7dd3fc' : '#7dd3fc';

  return (
    <div className="login-hero">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img"
        aria-label={`AURA's Digital Twin, connected to ${roles.length} specialists`}
        className="login-hero-svg">
        <defs>
          <radialGradient id="heroGlow">
            <stop offset="0%" stopColor={accent} stopOpacity="0.30" />
            <stop offset="55%" stopColor="#1d4ed8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heroBody">
            <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
            <stop offset="58%" stopColor={accent} stopOpacity="0.14" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="66%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="heroMask">
            <rect width={SIZE} height={SIZE} fill="url(#heroFade)" />
          </mask>
          <linearGradient id="heroScan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity="0" />
            <stop offset="50%" stopColor={accent} stopOpacity="0.85" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
          <pattern id="heroGrid" width="38" height="38" patternUnits="userSpaceOnUse">
            <path d="M38 0H0V38" fill="none" stroke="#7dd3fc" strokeOpacity="0.05" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width={SIZE} height={SIZE} fill="url(#heroGrid)" />
        <circle cx={C} cy={C} r={ORBIT + NODE} fill="url(#heroGlow)"
          style={{ transition: 'all .6s ease' }} />

        {MOTES.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.7} fill="#7dd3fc"
            className="hero-mote" style={{ animationDelay: `${i * 0.6}s` }} />
        ))}

        <circle cx={C} cy={C} r={ORBIT} fill="none" stroke="#38bdf8"
          strokeOpacity={0.14} strokeWidth={1} strokeDasharray="3 11" />

        {/* Spokes run under the figure. Only the selected one is drawn brightly
            and carries a travelling point -- an affordance for "this is the one
            you picked", not a claim that data is moving. */}
        {roles.map((role, i) => {
          const { x, y, angle } = position(i);
          const on = active === role.key;
          const from = { x: C + 92 * Math.cos(angle), y: C + 92 * Math.sin(angle) };
          const to = { x: x - NODE * Math.cos(angle), y: y - NODE * Math.sin(angle) };
          return (
            <g key={`spoke-${role.key}`}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={on ? ACCENT[role.key] ?? '#38bdf8' : '#38bdf8'}
                strokeOpacity={on ? 0.8 : 0.12}
                strokeWidth={on ? 2 : 1}
                strokeDasharray={on ? undefined : '4 9'}
                style={{ transition: 'stroke-opacity .3s ease, stroke-width .3s ease' }} />
              {on && (
                <circle r={3.2} fill={ACCENT[role.key] ?? '#38bdf8'} className="hero-packet"
                  style={{ offsetPath: `path("M ${from.x} ${from.y} L ${to.x} ${to.y}")` }} />
              )}
            </g>
          );
        })}

        <ellipse cx={C} cy={C + 4} rx={126} ry={162} fill="url(#heroBody)"
          className="hero-breathe" style={{ transition: 'all .6s ease' }} />

        <image href="/images/aura-real-digital-twin.png"
          x={C - FIGURE_W / 2} y={C - FIGURE_H / 2 + 14}
          width={FIGURE_W} height={FIGURE_H}
          preserveAspectRatio="xMidYMax meet"
          mask="url(#heroMask)" />

        <rect x={C - 96} width={192} height={2} fill="url(#heroScan)"
          className="hero-scan" rx={1} />

        <ellipse cx={C} cy={C + 194} rx={136} ry={23} fill={`${accent}22`}
          style={{ transition: 'fill .6s ease' }} />
        <ellipse cx={C} cy={C + 194} rx={136} ry={23} fill="none"
          stroke={accent} strokeOpacity={0.55} strokeWidth={1.3}
          style={{ transition: 'stroke .6s ease' }} />
        <ellipse cx={C} cy={C + 194} rx={86} ry={14} fill="none"
          stroke={accent} strokeOpacity={0.28} />

        <g className="login-hero-orbit" style={{ transformOrigin: `${C}px ${C}px` }}>
          {roles.map((role, i) => {
            const { x, y } = position(i);
            const Icon = ICONS[role.key] ?? Sparkles;
            const on = active === role.key;
            const colour = ACCENT[role.key] ?? '#7dd3fc';
            return (
              <g key={role.key}
                onMouseEnter={() => setActive(role.key)}
                onMouseLeave={() => setActive(null)}
                style={{ cursor: 'pointer' }}>
                {on && (
                  <circle cx={x} cy={y} r={NODE} fill="none" stroke={colour}
                    strokeWidth={2} className="hero-node-pulse" />
                )}
                <circle cx={x} cy={y} r={NODE} fill="#0b2545"
                  stroke={on ? colour : '#38bdf8'}
                  strokeOpacity={on ? 1 : 0.42}
                  strokeWidth={on ? 2.4 : 1.2}
                  style={{ transition: 'stroke .3s ease, stroke-opacity .3s ease, stroke-width .3s ease' }} />
                {/* Counter-rotated so icons stay upright as their circles travel. */}
                <g className="login-hero-counter"
                  style={{ transformOrigin: `${x}px ${y}px`, color: on ? colour : '#7dd3fc' }}>
                  <g transform={`translate(${x - 10}, ${y - 10})`}>
                    <Icon size={20} />
                  </g>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Selection also lives here: a rotating node is a poor hit target, and
          these are reachable by keyboard. */}
      <div className="login-hero-legend">
        {roles.map((role) => (
          <button key={role.key} type="button"
            className={active === role.key ? 'hero-pill on' : 'hero-pill'}
            style={active === role.key
              ? { borderColor: ACCENT[role.key], color: '#e8f7ff', background: `${ACCENT[role.key]}22` }
              : undefined}
            onMouseEnter={() => setActive(role.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(role.key)}
            onBlur={() => setActive(null)}>
            {role.label}
          </button>
        ))}
      </div>

      <div className="login-hero-detail" aria-live="polite">
        {selected ? (
          <>
            <b style={{ color: accent }}>{selected.label}</b>
            <span>{selected.description}</span>
            {selected.reads?.length ? (
              <small>Reads {selected.reads.map((k) => READS[k] ?? k).join(' · ')}</small>
            ) : null}
          </>
        ) : (
          <span className="hero-hint">
            Five specialists, one reasoning core. Hover any of them.
          </span>
        )}
      </div>
    </div>
  );
}
