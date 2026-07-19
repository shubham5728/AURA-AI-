/**
 * The reasoning core at the centre of the graph.
 *
 * It is the focal point by construction rather than by decoration: it is the
 * largest element, the only one with a gradient behind it, and the only one
 * that shows what the system as a whole is doing right now. Every specialist
 * reads as subordinate to it, which matches the architecture -- the core is the
 * single layer that resolves an answer, and the roles never talk to each other.
 *
 * Its label reports the current pipeline stage. When nothing is running it says
 * so, rather than idling with a caption that implies activity.
 */

import { Sparkles } from 'lucide-react';
import type { GraphLayout } from './geometry';
import type { TraceStage } from '../../lib/types';

interface Props {
  layout: GraphLayout;
  /** The stage currently revealed, or null when idle. */
  stage: TraceStage | null;
  running: boolean;
  reduceMotion: boolean;
}

const STAGE_CAPTION: Record<string, string> = {
  safety_in: 'Screening for emergencies',
  routing: 'Choosing a specialist',
  context: 'Gathering your data',
  generation: 'Reasoning',
  safety_out: 'Checking the reply',
};

export default function DigitalTwinCore({ layout, stage, running, reduceMotion }: Props) {
  const { center, hubRadius } = layout;
  const caption = stage ? STAGE_CAPTION[stage.name] ?? stage.label : 'Ready';
  const iconSize = Math.round(hubRadius * 0.4);

  return (
    <g aria-live="polite" aria-label={`Digital Twin core: ${caption}`}>
      <circle cx={center.x} cy={center.y} r={hubRadius * 3.6} fill="url(#twinGlow)" />

      {/* One ring, expanding outward, only while work is in flight. A permanent
          animation would say "busy" during the ninety-nine percent of the time
          nothing is happening. */}
      {running && !reduceMotion && (
        <circle cx={center.x} cy={center.y} r={hubRadius}
          fill="none" stroke="#38bdf8" strokeWidth={1.5}
          className="twin-core-ripple" />
      )}

      <circle
        cx={center.x} cy={center.y} r={hubRadius}
        fill="url(#twinCore)"
        stroke="#38bdf8"
        strokeOpacity={running ? 0.95 : 0.5}
        strokeWidth={running ? 2.2 : 1.5}
        style={{ transition: 'stroke-opacity .4s ease, stroke-width .4s ease' }}
      />

      <g transform={`translate(${center.x - iconSize / 2}, ${center.y - hubRadius * 0.52})`}
        style={{ color: '#7dd3fc' }}>
        <Sparkles size={iconSize} />
      </g>

      <text x={center.x} y={center.y + hubRadius * 0.14} textAnchor="middle"
        fill="#e0f2fe" fontSize={12} fontWeight={700} letterSpacing="0.06em">
        DIGITAL TWIN
      </text>

      <text x={center.x} y={center.y + hubRadius * 0.46} textAnchor="middle"
        fill="#7dd3fc" fontSize={10} opacity={0.9}>
        {caption}
      </text>
    </g>
  );
}
