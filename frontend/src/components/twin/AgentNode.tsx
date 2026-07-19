/**
 * One specialist in the graph.
 *
 * Emphasis is earned rather than styled in: a node's ring brightness and glow
 * follow the router's actual keyword score, so on a question like "can I take
 * these together" the Medication node is visibly the strongest candidate and
 * the rest recede. That is the router's real reasoning made legible.
 *
 * Focusable and operable by keyboard. The graph is the primary way to inspect
 * the system, so reaching it with a pointer only would put the explanation
 * behind an ability requirement.
 */

import type { ComponentType } from 'react';
import type { GraphLayout, NodeLayout } from './geometry';
import { labelLines } from './geometry';
import type { AgentState } from './status';
import { STATUS_META } from './status';

interface Props {
  layout: GraphLayout;
  node: NodeLayout;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  state: AgentState;
  selected: boolean;
  dimmed: boolean;
  reduceMotion: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}

export default function AgentNode({
  layout, node, label, Icon, state, selected, dimmed, reduceMotion, onSelect, onHover,
}: Props) {
  const { nodeRadius } = layout;
  const meta = STATUS_META[state.status];
  const active = state.status !== 'idle';
  const busy = state.status === 'processing' || state.status === 'receiving';

  const lines = labelLines(label, nodeRadius);
  const iconSize = Math.round(nodeRadius * 0.36);

  const description = [
    label,
    meta.label,
    state.score !== undefined ? `router score ${state.score}` : null,
    state.ms ? `${Math.round(state.ms)} milliseconds` : null,
  ].filter(Boolean).join(', ');

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={description}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      style={{
        cursor: 'pointer',
        opacity: dimmed ? 0.3 : 1,
        transition: 'opacity .3s ease',
        outline: 'none',
      }}
      className="twin-node"
    >
      {/* Halo only while the node is genuinely working. */}
      {busy && !reduceMotion && (
        <circle cx={node.x} cy={node.y} r={nodeRadius}
          fill="none" stroke={meta.colour} strokeWidth={2}
          className="twin-node-pulse" />
      )}

      <circle
        cx={node.x} cy={node.y} r={nodeRadius}
        fill={active ? 'rgba(11,37,69,0.95)' : 'rgba(11,37,69,0.72)'}
        stroke={meta.colour}
        strokeOpacity={selected ? 1 : active ? 0.9 : 0.25 + state.relative * 0.4}
        strokeWidth={selected ? 2.6 : active ? 2 : 1.2}
        style={{ transition: 'stroke-opacity .3s ease, stroke-width .3s ease, fill .3s ease' }}
      />

      <g
        transform={`translate(${node.x - iconSize / 2}, ${node.y - nodeRadius * 0.46})`}
        style={{ color: active ? meta.colour : '#7dd3fc' }}
      >
        <Icon size={iconSize} />
      </g>

      {lines.map((line, i) => (
        <text
          key={i}
          x={node.x}
          y={node.y + nodeRadius * 0.1 + i * (nodeRadius * 0.26)}
          textAnchor="middle"
          fill="#e0f2fe"
          fontSize={Math.max(9.5, nodeRadius * 0.22)}
          fontWeight={600}
        >
          {line}
        </text>
      ))}

      {/* Status sits outside the circle so it never competes with the name. */}
      {active && (
        <text
          x={node.x}
          y={node.y + nodeRadius + 14}
          textAnchor="middle"
          fill={meta.colour}
          fontSize={10.5}
          fontWeight={700}
        >
          {meta.label}
        </text>
      )}
    </g>
  );
}
