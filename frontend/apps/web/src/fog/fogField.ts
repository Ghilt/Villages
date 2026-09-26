import type { FogCircle } from './circles';

/**
 * The fog as the shader reads it: how far each piece of ground is from the edge of what the house has
 * revealed, and from the edge of what it has in vision, in world units and negative inside.
 *
 * A distance rather than a yes or no, so that one small texture draws an edge that is soft close in and
 * sharp far out, and can be made to wander, at every zoom: interpolating a distance between two texels is
 * still very nearly the right distance, where interpolating a yes and a no is a smear. It is worked out
 * here, once for every change to the house's vision points, and never while the camera moves.
 *
 * It covers the circles and a margin around them and nothing else. Everything past its edge is as far
 * outside as a distance is ever said to be, which is what unknown ground is, so a house that has seen a
 * few places costs a texture a few hundred texels across however large the world is.
 */
export interface FogField {
  /** Where the field's first texel starts, in world units. */
  originX: number;
  originY: number;
  /** How many world units one texel covers along each side. */
  unitsPerTexel: number;
  width: number;
  height: number;
  /** Two numbers a texel, rows from the north: the distance to revealed ground, then to vision. */
  distances: Float32Array;
}

/**
 * How far from an edge a distance is worth knowing, in world units. Anything further is said to be this
 * far, which is room for the edge's softness and its wander with a great deal to spare.
 */
export const REACH = 64;

/**
 * The most texels along either side. A house seeing from both ends of the world then costs a coarser
 * texture rather than a bigger one; a few places close together are one texel a world unit.
 */
export const MOST_TEXELS = 1024;

/** The field for these circles, or null for none, which is a house that sees nothing at all. */
export function fieldOf(circles: readonly FogCircle[], most = MOST_TEXELS): FogField | null {
  if (circles.length === 0) {
    return null;
  }
  let west = Number.POSITIVE_INFINITY;
  let north = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.NEGATIVE_INFINITY;
  for (const circle of circles) {
    west = Math.min(west, circle.x - circle.radius - REACH);
    north = Math.min(north, circle.y - circle.radius - REACH);
    east = Math.max(east, circle.x + circle.radius + REACH);
    south = Math.max(south, circle.y + circle.radius + REACH);
  }
  const unitsPerTexel = Math.max(1, Math.max(east - west, south - north) / most);
  const width = Math.ceil((east - west) / unitsPerTexel);
  const height = Math.ceil((south - north) / unitsPerTexel);
  const distances = new Float32Array(width * height * 2).fill(REACH);

  // Each circle only touches the texels within its radius and a reach of its edge; everything else
  // already says as far as a distance ever says.
  for (const circle of circles) {
    const around = circle.radius + REACH;
    const fromColumn = Math.max(0, Math.floor((circle.x - around - west) / unitsPerTexel));
    const toColumn = Math.min(width - 1, Math.ceil((circle.x + around - west) / unitsPerTexel));
    const fromRow = Math.max(0, Math.floor((circle.y - around - north) / unitsPerTexel));
    const toRow = Math.min(height - 1, Math.ceil((circle.y + around - north) / unitsPerTexel));
    for (let row = fromRow; row <= toRow; row += 1) {
      const dy = north + (row + 0.5) * unitsPerTexel - circle.y;
      for (let column = fromColumn; column <= toColumn; column += 1) {
        const dx = west + (column + 0.5) * unitsPerTexel - circle.x;
        const away = Math.max(-REACH, Math.hypot(dx, dy) - circle.radius);
        if (away >= REACH) {
          continue;
        }
        const at = (row * width + column) * 2;
        if (away < distances[at]!) {
          distances[at] = away;
        }
        if (circle.lasting && away < distances[at + 1]!) {
          distances[at + 1] = away;
        }
      }
    }
  }

  return { originX: west, originY: north, unitsPerTexel, width, height, distances };
}
