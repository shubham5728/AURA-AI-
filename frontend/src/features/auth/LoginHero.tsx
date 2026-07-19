/**
 * The Digital Twin, as the first thing anyone sees.
 *
 * The hero was a rendered figure that appeared cropped at the ankles. The cause
 * was not layout: the source PNG is 1024x1024 and the figure's opaque pixels
 * run to row 1023 of 1024, so the feet are cut in the file. No container or
 * object-fit change can recover pixels that were never there. The figure is
 * kept, and its lower edge is masked into the platform, which turns the crop
 * into a deliberate horizon.
 *
 * What each node shows is deliberate. This is the login page: nobody is signed
 * in, so there is no status, no confidence, no last sync and no agent that
 * could be "thinking". Any of those would be theatre performed for a stranger.
 * What is true and worth showing is what each specialist is for and what it is
 * permitted to read -- which is also the more useful thing for someone deciding
 * whether to trust the product. The live version, driven by a real trace, is on
 * the Multi-Agent page after sign-in.
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
 * Shown immediately, and kept if the roster cannot be fetched.
 *
 * The backend sleeps on its free tier and takes close to a minute to wake. A
 * first screen must not sit empty waiting for a list, and these are the real
 * five with their real remits rather than placeholder text.
 */
const FALLBACK: Role[] = [
  { key: 'doctor', label: 'General Health', description: 'Symptoms, history and lab report interpretation' },
  { key: 'nutrition', label: 'Nutrition', description: 'Diet, food choices and caloric balance' },
  { key: 'fitness', label: 'Fitness', description: 'Exercise, activity and sleep' },
  { key: 'medication', label: 'Medication', description: 'Prescriptions, interactions and timing' },
  { key: 'prediction', label: 'Health Trends', description: 'Trajectories, risks and what-if projections' },
];

const SIZE = 460;
const C = SIZE / 2;
const ORBIT = 186;
const NODE = 34;

/** Fixed scatter rather than random, so the background never reflows on render. */
const MOTES = [
  [46, 88], [402, 62], [78, 372], [418, 330], [232, 34],
  [26, 226], [434, 214], [160, 430], [318, 428],
];

export default function LoginHero() {
  const [roles, setRoles] = useState<Role[]>(FALLBACK);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<Role[]>('/api/chat/roles')
      .then((live) => { if (!cancelled && live.length) setRoles(live); })
      // Keeping the fallback is the right outcome. A login page should not show
      // an error because a specialist list could not be fetched.
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const position = (i: number) => {
    const angle = ((-90 + (360 / roles.length) * i) * Math.PI) / 180;
    return { x: C + ORBIT * Math.cos(angle), y: C + ORBIT * Math.sin(angle), angle };
  };

  const selected = roles.find((r) => r.key === active) ?? null;

  return (
    <div className="login-hero">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img"
        aria-label={`AURA's Digital Twin, connected to ${roles.length} specialists`}
        style={{ display: 'block', maxHeight: 470, overflow: 'visible' }}>
        <defs>
          <radialGradient id="heroGlow">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.34" />
            <stop offset="55%" stopColor="#1d4ed8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heroBody">
            <stop offset="0%" stopColor="#bcf4ff" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#32a2de" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#32a2de" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="64%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="heroMask">
            <rect width={SIZE} height={SIZE} fill="url(#heroFade)" />
          </mask>
          <pattern id="heroGrid" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M34 0H0V34" fill="none" stroke="#7dd3fc" strokeOpacity="0.055" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width={SIZE} height={SIZE} fill="url(#heroGrid)" />
        <circle cx={C} cy={C} r={ORBIT + NODE} fill="url(#heroGlow)" />

        {MOTES.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.6} fill="#7dd3fc" opacity={0.5}
            className="hero-mote" style={{ animationDelay: `${i * 0.7}s` }} />
        ))}

        <circle cx={C} cy={C} r={ORBIT} fill="none" stroke="#38bdf8"
          strokeOpacity={0.16} strokeWidth={1} strokeDasharray="3 10" />

        {/* Spokes sit under the figure and the nodes. Only the selected one is
            drawn brightly, which is what makes selection legible at a glance. */}
        {roles.map((role, i) => {
          const { x, y, angle } = position(i);
          const on = active === role.key;
          return (
            <line key={`spoke-${role.key}`}
              x1={C + 74 * Math.cos(angle)} y1={C + 74 * Math.sin(angle)}
              x2={x - NODE * Math.cos(angle)} y2={y - NODE * Math.sin(angle)}
              stroke="#38bdf8" strokeOpacity={on ? 0.75 : 0.14}
              strokeWidth={on ? 2 : 1} strokeDasharray={on ? undefined : '4 8'}
              style={{ transition: 'stroke-opacity .3s ease, stroke-width .3s ease' }} />
          );
        })}

        <ellipse cx={C} cy={C + 6} rx={104} ry={132} fill="url(#heroBody)" className="hero-breathe" />

        <image href="/images/aura-real-digital-twin.png"
          x={C - 132} y={C - 196} width={264} height={392}
          preserveAspectRatio="xMidYMax meet"
          mask="url(#heroMask)" />

        <ellipse cx={C} cy={C + 176} rx={118} ry={20} fill="rgba(58,207,242,0.20)" />
        <ellipse cx={C} cy={C + 176} rx={118} ry={20} fill="none"
          stroke="#5be2ff" strokeOpacity={0.55} strokeWidth={1.2} />
        <ellipse cx={C} cy={C + 176} rx={74} ry={12} fill="none"
          stroke="#5be2ff" strokeOpacity={0.3} />

        {/* Rotates as one group so the browser animates a single transform
            rather than one per node. */}
        <g className="login-hero-orbit" style={{ transformOrigin: `${C}px ${C}px` }}>
          {roles.map((role, i) => {
            const { x, y } = position(i);
            const Icon = ICONS[role.key] ?? Sparkles;
            const on = active === role.key;
            return (
              <g key={role.key}
                onMouseEnter={() => setActive(role.key)}
                onMouseLeave={() => setActive(null)}
                style={{ cursor: 'pointer' }}>
                <circle cx={x} cy={y} r={NODE} fill="#0b2545"
                  stroke="#38bdf8" strokeOpacity={on ? 0.95 : 0.45}
                  strokeWidth={on ? 2.2 : 1.2}
                  style={{ transition: 'stroke-opacity .3s ease, stroke-width .3s ease' }} />
                {/* Counter-rotates so icons stay upright as the orbit turns. */}
                <g className="login-hero-counter"
                  style={{ transformOrigin: `${x}px ${y}px`, color: on ? '#bcf4ff' : '#7dd3fc' }}>
                  <g transform={`translate(${x - 9}, ${y - 9})`}>
                    <Icon size={18} />
                  </g>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Selecting from here rather than only on the moving nodes: a rotating
          hit target is a poor one, and these are keyboard reachable. */}
      <div className="login-hero-legend">
        {roles.map((role) => (
          <button key={role.key} type="button"
            className={active === role.key ? 'hero-pill on' : 'hero-pill'}
            onMouseEnter={() => setActive(role.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(role.key)}
            onBlur={() => setActive(null)}>
            {role.label}
          </button>
        ))}
      </div>

      {/* What the specialist is for, and what it may read. Not what it is doing
          -- on a login page, nothing is. */}
      <div className="login-hero-detail" aria-live="polite">
        {selected ? (
          <>
            <b>{selected.label}</b>
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
