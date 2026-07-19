/**
 * A link between the Digital Twin core and one specialist.
 *
 * The direction of travel carries meaning and is not decorative: context flows
 * outward from the core to the chosen role while it is being assembled, and the
 * answer flows back inward while the model generates. Nothing moves along a
 * link belonging to a role that did not run.
 *
 * Animated in CSS rather than by re-rendering. React sets a class; the browser
 * runs the motion on the compositor, so a four-second reply does not cost sixty
 * renders a second.
 */

import type { GraphLayout, NodeLayout } from './geometry';
import { spoke, spokeLength } from './geometry';
import type { AgentStatus } from './status';
import { STATUS_META } from './status';

interface Props {
  layout: GraphLayout;
  node: NodeLayout;
  status: AgentStatus;
  /** Router evidence, 0-1. Dims links the router barely considered. */
  relative: number;
  dimmed: boolean;
  reduceMotion: boolean;
}

/** Which way information is travelling, if any. */
function flowDirection(status: AgentStatus): 'out' | 'in' | null {
  if (status === 'receiving') return 'out';
  if (status === 'processing') return 'in';
  return null;
}

export default function AgentConnection({
  layout, node, status, relative, dimmed, reduceMotion,
}: Props) {
  const { from, to } = spoke(layout, node);
  const length = spokeLength(layout, node);
  const colour = STATUS_META[status].colour;
  const direction = flowDirection(status);

  const active = status !== 'idle';
  const opacity = dimmed ? 0.08 : active ? 0.85 : 0.12 + relative * 0.22;
  const width = status === 'processing' || status === 'receiving' ? 2.4 : active ? 1.8 : 1.2;

  return (
    <g aria-hidden>
      <line
        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
        stroke={colour}
        strokeOpacity={opacity}
        strokeWidth={width}
        strokeDasharray={active ? undefined : '4 7'}
        style={{ transition: 'stroke-opacity .35s ease, stroke-width .35s ease' }}
      />

      {/* The moving packet. Its travel time is normalised by link length so a
          node on an outer ring does not appear to receive data faster. */}
      {direction && !reduceMotion && (
        <circle
          r={3.4}
          fill={colour}
          className={direction === 'out' ? 'twin-flow-out' : 'twin-flow-in'}
          style={{
            offsetPath: `path("M ${from.x} ${from.y} L ${to.x} ${to.y}")`,
            animationDuration: `${Math.max(0.7, length / 150)}s`,
          }}
        />
      )}

      {/* Reduced motion still needs to show which link is live, so the packet is
          replaced by a static marker at the midpoint. */}
      {direction && reduceMotion && (
        <circle
          cx={(from.x + to.x) / 2}
          cy={(from.y + to.y) / 2}
          r={3.4}
          fill={colour}
        />
      )}
    </g>
  );
}
