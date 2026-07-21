/**
 * The figure, with the selected system's region highlighted.
 *
 * The highlight is an indicator over the body, not an anatomical render. The
 * source image is a plain figure; drawing glowing "organs" on it would claim a
 * precision the picture does not have. A soft region glow says "this system
 * relates to roughly here" honestly, and moves as the tab changes so switching
 * systems is felt on the body rather than only in the text.
 *
 * The figure's cropped lower edge -- the PNG ends at the ankles -- is masked
 * into the platform, the same treatment as the login hero.
 */

import type { BodyRegion } from './types';

const SIZE = 360;
const C = SIZE / 2;

/** Approximate vertical centre of each region on the figure, 0 (head) to 1 (feet). */
const REGION_Y: Record<BodyRegion, number> = {
  chest: 0.40,
  torso: 0.46,
  core: 0.54,
  abdomen: 0.58,
  legs: 0.78,
};

interface Props {
  accent: string;
  region: BodyRegion;
  /** null on the overview, where the whole body glows evenly. */
  whole?: boolean;
}

export default function TwinAvatar({ accent, region, whole = false }: Props) {
  const figureTop = 40;
  const figureH = 320;
  const glowY = whole ? C : figureTop + REGION_Y[region] * figureH;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img"
      aria-label={whole ? 'Digital Twin, whole body' : `Digital Twin, ${region} highlighted`}
      style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id="twinRegionGlow">
          <stop offset="0%" stopColor={accent} stopOpacity={whole ? 0.34 : 0.6} />
          <stop offset="60%" stopColor={accent} stopOpacity="0.12" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="twinFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="66%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="twinMask">
          <rect width={SIZE} height={SIZE} fill="url(#twinFade)" />
        </mask>
      </defs>

      {/* Whole-body ambient glow, always present but faint. */}
      <ellipse cx={C} cy={C} rx={116} ry={150} fill={`${accent}14`}
        className="twin-breathe" style={{ transition: 'fill .5s ease' }} />

      {/* The region highlight travels to the selected system. */}
      <ellipse cx={C} cy={glowY}
        rx={whole ? 120 : 74} ry={whole ? 150 : 58}
        fill="url(#twinRegionGlow)"
        style={{ transition: 'cy .5s cubic-bezier(.4,0,.2,1), rx .5s ease, ry .5s ease' }} />

      <image href="/images/aura-real-digital-twin.png"
        x={C - figureH / 2} y={figureTop}
        width={figureH} height={figureH}
        preserveAspectRatio="xMidYMid meet"
        mask="url(#twinMask)" />

      {/* A ring marks the highlighted region on the body edge. */}
      {!whole && (
        <ellipse cx={C} cy={glowY} rx={78} ry={16} fill="none"
          stroke={accent} strokeOpacity={0.6} strokeWidth={1.4}
          className="twin-region-pulse"
          style={{ transition: 'cy .5s cubic-bezier(.4,0,.2,1)' }} />
      )}

      {/* Scanning platform, the concentric-ring treatment from the login hero. */}
      {[0, 1, 2].map((ring) => (
        <ellipse key={ring} cx={C} cy={figureTop + figureH - 6}
          rx={44 + ring * 26} ry={7 + ring * 4}
          fill="none" stroke={accent} strokeOpacity={0.4 - ring * 0.1}
          strokeWidth={1} className="twin-ring"
          style={{ animationDelay: `${ring * 0.5}s`, transition: 'stroke .5s ease' }} />
      ))}
    </svg>
  );
}
