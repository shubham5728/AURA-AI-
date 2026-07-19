/**
 * The Digital Twin graph: core, specialists, and the links between them.
 *
 * Composes the pieces and owns only interaction state. Layout comes from
 * geometry.ts, agent state from status.ts, and timing from useTraceReplay --
 * so adding a specialist means adding a role on the server, and nothing here
 * changes.
 *
 * Hovering or focusing a node isolates its path by dimming every other link and
 * node, which is the only way to read a single specialist's route once the
 * graph has more than a handful of members.
 */

import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import AgentConnection from './AgentConnection';
import AgentNode from './AgentNode';
import DigitalTwinCore from './DigitalTwinCore';
import { computeLayout } from './geometry';
import { statesAt } from './status';
import type { AgentState } from './status';
import type { Trace } from '../../lib/types';

export interface GraphRole {
  key: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
}

interface Props {
  roles: GraphRole[];
  trace: Trace | null;
  upto: number;
  running: boolean;
  reduceMotion: boolean;
  selected: string | null;
  onSelect: (key: string | null) => void;
}

export default function DigitalTwinGraph({
  roles, trace, upto, running, reduceMotion, selected, onSelect,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const layout = useMemo(() => computeLayout(roles.length), [roles.length]);
  const states = useMemo(
    () => statesAt(trace, roles.map((r) => r.key), upto),
    [trace, roles, upto],
  );

  // Hover isolates; selection persists. Hover wins so the graph stays
  // explorable without losing the panel you opened.
  const focus = hovered ?? selected;
  const stage = trace && upto >= 0 ? trace.stages[upto] ?? null : null;

  return (
    <svg
      viewBox={`0 0 ${layout.size} ${layout.size}`}
      width="100%"
      role="group"
      aria-label={`Digital Twin core connected to ${roles.length} specialist roles`}
      style={{ maxHeight: 560, display: 'block', margin: '0 auto', overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="twinGlow">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
          <stop offset="55%" stopColor="#1d4ed8" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="twinCore">
          <stop offset="0%" stopColor="#123a68" />
          <stop offset="100%" stopColor="#0a1f3c" />
        </radialGradient>
      </defs>

      {/* Links first so no line is drawn over a circle. */}
      {roles.map((role, i) => {
        const state: AgentState = states[role.key];
        return (
          <AgentConnection
            key={`link-${role.key}`}
            layout={layout}
            node={layout.nodes[i]}
            status={state.status}
            relative={state.relative}
            dimmed={focus !== null && focus !== role.key}
            reduceMotion={reduceMotion}
          />
        );
      })}

      <DigitalTwinCore layout={layout} stage={stage} running={running}
        reduceMotion={reduceMotion} />

      {roles.map((role, i) => (
        <AgentNode
          key={role.key}
          layout={layout}
          node={layout.nodes[i]}
          label={role.label}
          Icon={role.Icon}
          state={states[role.key]}
          selected={selected === role.key}
          dimmed={focus !== null && focus !== role.key}
          reduceMotion={reduceMotion}
          onSelect={() => onSelect(selected === role.key ? null : role.key)}
          onHover={(on) => setHovered(on ? role.key : null)}
        />
      ))}
    </svg>
  );
}
