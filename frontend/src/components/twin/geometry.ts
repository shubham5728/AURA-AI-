/**
 * Layout maths for the Digital Twin graph.
 *
 * Positions are computed, never listed. The previous diagram hard-coded five
 * coordinates, so a sixth specialist meant inventing a new one by eye and a
 * renamed role could silently land on the wrong spot.
 *
 * Beyond eight nodes a single ring stops working: circles either overlap or
 * shrink past readability. The layout adds rings instead, keeping node size
 * constant and the drawing balanced at any count.
 */

export interface Point {
  x: number;
  y: number;
}

export interface NodeLayout extends Point {
  angle: number;
  /** 0 for the inner ring, 1 for the next, and so on. */
  ring: number;
  radius: number;
}

export interface GraphLayout {
  size: number;
  center: Point;
  hubRadius: number;
  nodeRadius: number;
  nodes: NodeLayout[];
}

/** Nodes per ring before a new one is started. */
const RING_CAPACITY = 8;

/**
 * Node radius shrinks as the graph grows, but only to a floor -- below roughly
 * 34px a two-word label stops fitting, and an unreadable node is worse than a
 * larger drawing.
 */
function nodeRadiusFor(count: number): number {
  if (count <= 5) return 52;
  if (count <= 8) return 46;
  if (count <= 14) return 40;
  return 34;
}

export function computeLayout(count: number, size = 560): GraphLayout {
  const center = { x: size / 2, y: size / 2 };
  const nodeRadius = nodeRadiusFor(count);
  const hubRadius = Math.max(54, nodeRadius + 8);

  const rings = Math.ceil(count / RING_CAPACITY);
  const nodes: NodeLayout[] = [];

  // The outermost ring has to fit inside the canvas with room for the node and
  // a little breathing space, so orbits are derived from the space available
  // rather than from a fixed constant.
  const outerOrbit = size / 2 - nodeRadius - 14;
  const innerOrbit = hubRadius + nodeRadius + 34;
  const step = rings > 1 ? (outerOrbit - innerOrbit) / (rings - 1) : 0;

  let placed = 0;
  for (let ring = 0; ring < rings; ring += 1) {
    const remaining = count - placed;
    const inRing = Math.min(remaining, RING_CAPACITY);
    const orbit = rings === 1 ? (innerOrbit + outerOrbit) / 2 : innerOrbit + step * ring;

    for (let i = 0; i < inRing; i += 1) {
      // Start at the top. Odd rings are offset by half a step so nodes on
      // different rings do not line up and hide each other's spokes.
      const offset = ring % 2 === 1 ? 180 / inRing : 0;
      const deg = -90 + (360 / inRing) * i + offset;
      const angle = (deg * Math.PI) / 180;

      nodes.push({
        x: center.x + orbit * Math.cos(angle),
        y: center.y + orbit * Math.sin(angle),
        angle,
        ring,
        radius: orbit,
      });
    }
    placed += inRing;
  }

  return { size, center, hubRadius, nodeRadius, nodes };
}

/**
 * The visible segment of a spoke: from the hub's edge to the node's edge.
 *
 * Drawing centre-to-centre put a line underneath every circle, which is what
 * made the old diagram look like clip art.
 */
export function spoke(layout: GraphLayout, node: NodeLayout) {
  const { center, hubRadius, nodeRadius } = layout;
  return {
    from: {
      x: center.x + hubRadius * Math.cos(node.angle),
      y: center.y + hubRadius * Math.sin(node.angle),
    },
    to: {
      x: node.x - nodeRadius * Math.cos(node.angle),
      y: node.y - nodeRadius * Math.sin(node.angle),
    },
  };
}

/** Straight-line length, used to keep travel speed constant across rings. */
export function spokeLength(layout: GraphLayout, node: NodeLayout): number {
  const { from, to } = spoke(layout, node);
  return Math.hypot(to.x - from.x, to.y - from.y);
}

/** Splits a label into at most two lines that fit inside a node. */
export function labelLines(label: string, nodeRadius: number): string[] {
  const words = label.split(' ');
  if (words.length === 1) return words;

  // Roughly six characters fit per 30px of radius at the sizes used here.
  const perLine = Math.floor(nodeRadius / 4.5);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > perLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  // Anything longer than two lines is truncated rather than allowed to spill
  // outside the circle.
  return lines.slice(0, 2);
}
