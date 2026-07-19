/**
 * The Digital Twin, as the first thing anyone sees.
 *
 * The hero was a rendered figure that appeared cropped at the ankles. The cause
 * was not layout: the source PNG is 1024x1024 and the figure's opaque pixels
 * run to row 1023 of 1024, so the feet are cut in the file. No container or
 * object-fit change can recover pixels that were never there.
 *
 * Rather than swapping in another stock render, the hero is now the thing the
 * product actually is. The specialists are fetched from the same public
 * endpoint the app uses, so this is the real roster -- add one on the server
 * and it appears here, before anyone has signed in.
 *
 * The figure is kept, smaller, inside the orbit, with its lower edge faded into
 * the platform. That turns the crop from a defect into a deliberate horizon.
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
}

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  doctor: Stethoscope,
  nutrition: Salad,
  fitness: Dumbbell,
  medication: Pill,
  prediction: TrendingUp,
};

/**
 * Shown while the roster loads, and kept if it cannot.
 *
 * The backend sleeps on its free tier and takes the best part of a minute to
 * wake, and the first screen must not sit empty waiting for it. These are the
 * real five, so the fallback is accurate rather than a placeholder.
 */
const FALLBACK: Role[] = [
  { key: 'doctor', label: 'General Health' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'medication', label: 'Medication' },
  { key: 'prediction', label: 'Health Trends' },
];

const SIZE = 420;
const CENTRE = SIZE / 2;
const ORBIT = 168;
const NODE = 30;

export default function LoginHero() {
  const [roles, setRoles] = useState<Role[]>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    get<Role[]>('/api/chat/roles')
      .then((live) => {
        if (!cancelled && live.length) setRoles(live);
      })
      .catch(() => {
        // Keeping the fallback is the right outcome: the login page should not
        // show an error because a specialist list could not be fetched.
      });
    return () => { cancelled = true; };
  }, []);

  const position = (i: number) => {
    const angle = ((-90 + (360 / roles.length) * i) * Math.PI) / 180;
    return {
      x: CENTRE + ORBIT * Math.cos(angle),
      y: CENTRE + ORBIT * Math.sin(angle),
    };
  };

  return (
    <div className="login-hero" aria-hidden>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%"
        style={{ display: 'block', maxHeight: 440, overflow: 'visible' }}>
        <defs>
          <radialGradient id="heroGlow">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.32" />
            <stop offset="60%" stopColor="#1d4ed8" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
          </radialGradient>
          {/* Fades the lower third of the figure into the platform, so the
              cropped edge reads as a horizon rather than a mistake. */}
          <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="62%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="heroMask">
            <rect x="0" y="0" width={SIZE} height={SIZE} fill="url(#heroFade)" />
          </mask>
        </defs>

        <circle cx={CENTRE} cy={CENTRE} r={ORBIT + NODE} fill="url(#heroGlow)" />

        <circle cx={CENTRE} cy={CENTRE} r={ORBIT} fill="none"
          stroke="#38bdf8" strokeOpacity={0.18} strokeWidth={1}
          strokeDasharray="3 9" />

        <image
          href="/images/aura-real-digital-twin.png"
          x={CENTRE - 96} y={CENTRE - 150}
          width={192} height={300}
          preserveAspectRatio="xMidYMax meet"
          mask="url(#heroMask)"
          opacity={0.92}
        />

        <ellipse cx={CENTRE} cy={CENTRE + 132} rx={78} ry={13}
          fill="none" stroke="#5be2ff" strokeOpacity={0.45} />
        <ellipse cx={CENTRE} cy={CENTRE + 132} rx={78} ry={13}
          fill="rgba(58,207,242,0.16)" />

        {/* The orbit rotates as one group, so the nodes keep their spacing and
            the browser animates a single transform rather than five. */}
        <g className="login-hero-orbit" style={{ transformOrigin: `${CENTRE}px ${CENTRE}px` }}>
          {roles.map((role, i) => {
            const { x, y } = position(i);
            const Icon = ICONS[role.key] ?? Sparkles;
            return (
              <g key={role.key}>
                <circle cx={x} cy={y} r={NODE} fill="#0b2545"
                  stroke="#38bdf8" strokeOpacity={0.5} strokeWidth={1.2} />
                <g transform={`translate(${x - 8}, ${y - 8})`} style={{ color: '#7dd3fc' }}>
                  <Icon size={16} />
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Named outside the SVG so the labels stay upright while the orbit turns,
          and so they are selectable text rather than paths. */}
      <div className="login-hero-legend">
        {roles.map((role) => (
          <span key={role.key}>{role.label}</span>
        ))}
      </div>
    </div>
  );
}
