import type { LatticePoint, Ring } from './trace.ts';

/**
 * Turning a staircase into a coastline.
 *
 * A traced ring runs along the lattice between pixels, so every step is a right angle. Two passes fix
 * that: drop the vertices that say nothing, then round off the corners that remain. The result is smooth
 * at any size, and smooth is what a stylised world wants. It is not more detailed than what was painted,
 * and it does not pretend to be.
 */

/** Perpendicular distance from a point to the line through two others. */
function distanceToLine(point: LatticePoint, from: LatticePoint, to: LatticePoint): number {
  const run = to.x - from.x;
  const rise = to.y - from.y;
  const length = Math.hypot(run, rise);
  if (length === 0) {
    return Math.hypot(point.x - from.x, point.y - from.y);
  }
  return Math.abs(rise * (point.x - from.x) - run * (point.y - from.y)) / length;
}

/**
 * Drops every vertex that lies within `tolerance` of the line its neighbours already describe. A staircase
 * along a straight coast collapses to two points; a bay keeps its shape.
 */
export function simplify(ring: Ring, tolerance: number): Ring {
  if (ring.length < 3 || tolerance <= 0) {
    return ring;
  }

  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;

  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let worst = 0;
    let at = -1;

    for (let index = first + 1; index < last; index += 1) {
      const distance = distanceToLine(ring[index]!, ring[first]!, ring[last]!);
      if (distance > worst) {
        worst = distance;
        at = index;
      }
    }

    if (at >= 0 && worst > tolerance) {
      keep[at] = 1;
      stack.push([first, at], [at, last]);
    }
  }

  const kept: Ring = [];
  for (let index = 0; index < ring.length; index += 1) {
    if (keep[index] === 1) {
      kept.push(ring[index]!);
    }
  }
  return kept;
}

/**
 * Rounds off the corners, once per pass, by replacing each with two points a quarter and three quarters
 * along its edges. The ring shrinks slightly towards its own middle, which on a coastline reads as
 * weathering rather than as error.
 */
export function smooth(ring: Ring, passes = 1): Ring {
  let current = ring;

  for (let pass = 0; pass < passes; pass += 1) {
    if (current.length < 4) {
      return current;
    }
    // The ring is closed, so the last point repeats the first and is left to the wrap-around.
    const open = current.slice(0, -1);
    const next: Ring = [];

    for (let index = 0; index < open.length; index += 1) {
      const from = open[index]!;
      const to = open[(index + 1) % open.length]!;
      next.push(
        { x: from.x * 0.75 + to.x * 0.25, y: from.y * 0.75 + to.y * 0.25 },
        { x: from.x * 0.25 + to.x * 0.75, y: from.y * 0.25 + to.y * 0.75 },
      );
    }

    next.push({ x: next[0]!.x, y: next[0]!.y });
    current = next;
  }

  return current;
}

/** Twice the signed area. Its sign tells an outline from a hole; its size tells what is worth drawing. */
export function doubleSignedArea(ring: Ring): number {
  let sum = 0;
  for (let index = 0; index + 1 < ring.length; index += 1) {
    sum += ring[index]!.x * ring[index + 1]!.y - ring[index + 1]!.x * ring[index]!.y;
  }
  return sum;
}
