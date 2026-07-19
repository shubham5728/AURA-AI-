/**
 * A small labelled pill.
 *
 * Written three times before this -- in TracePanel, ReasoningPanel and
 * Hereditary -- each with its own padding, radius and colour. This is the one
 * copy.
 *
 * `muted` strikes the label through, which is used for data a role was refused.
 * That reading only works if it looks identical everywhere it appears, which is
 * the argument for having a single component rather than three near-copies.
 */

import type { HealthStatus } from './tokens';
import { STATUS_COLOUR, STATUS_TINT } from './tokens';

interface Props {
  children: React.ReactNode;
  status?: HealthStatus;
  muted?: boolean;
  title?: string;
}

export default function Chip({ children, status, muted = false, title }: Props) {
  const colour = muted
    ? 'var(--muted)'
    : status
      ? STATUS_COLOUR[status]
      : 'var(--blue)';

  const background = muted
    ? 'rgba(128,128,128,0.10)'
    : status
      ? STATUS_TINT[status]
      : 'rgba(56,132,232,0.12)';

  return (
    <span
      title={title}
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 'var(--text-caption)',
        fontWeight: 'var(--w-semibold)',
        background,
        color: colour,
        textDecoration: muted ? 'line-through' : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
