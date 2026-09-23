import { hash2 } from '@villages/world';

import { KINDS, kindFor, whatGrows } from './kinds';
import type { Growing } from './kinds';

/**
 * **This is experiment 0006, not a finished part of the game.** It was built to answer one question -
 * how much scenery the browser will draw before it lags - and it answers it. What it is *not* is a
 * world worth looking at: three kinds of the ten Adam named, drawn as a triangle, an ellipse and three
 * blades, scattered by one weight table nobody has tuned. Do not build on the look of it, and do not
 * take the numbers in it for settled. What replaces it is the **world-generator**, in
 * `docs/plans/world-generator.md`.
 */

/**
 * Where scenery stands, worked out from the world rather than stored in it.
 *
 * Nothing here is kept and nothing is sent: a pine is a pure function of the point of world space it
 * grows on and the terrain there. That is 0032's argument, which said the same about what an area
 * encloses - an answer that changes with the camera is not a property of the world - and it is what
 * makes this affordable at all, because a carpet over the whole Earth is nobody's to store.
 *
 * Pure, so it can be tested without a renderer and without a tile.
 *
 * **A point's identity is its place on the grid, not the cell it was generated in.** Cells are a cache
 * and nothing else. The same grid point is the same pine at every zoom, in every session, for ever, and
 * changing how the cache is cut changes nothing about what is drawn.
 */

/**
 * How much world space one cell covers.
 *
 * Thirty-two, and not approximately: a zoom 7 tile is 256 world units across, so an aligned cell never
 * straddles two of them and one cell needs exactly one tile of terrain. It also keeps the number of
 * cells in view sensible at both ends - about a hundred on a desktop at zoom 8, about six on a phone
 * at zoom 10.
 */
export const CELL = 32;

/** The seeds. Different numbers for different questions about the same point, so they do not agree. */
const SEED = { alongX: 0x5ce7, alongY: 0x11ab, rank: 0x2f93, kind: 0x7d41, size: 0x3bb9 } as const;

export interface ScatteredPoint {
  /** Where it stands, in world units. */
  x: number;
  y: number;
  /** Which kind it is, as an index into `KINDS`. */
  kind: number;
  /**
   * How early it shows up, from nought to one, and fixed for this point for ever.
   *
   * Thinning takes the lowest ranks, so a thinner scattering is always a subset of a denser one and a
   * pine that is drawn at one density is drawn at every higher one. That is what keeps changing the
   * density from making the whole carpet flicker: nothing is reshuffled, only more is let in.
   */
  rank: number;
  /** How tall it stands, in world units, with its own jitter already in it. */
  height: number;
}

/** What the scatter needs to know about the ground: the terrain class at a point of world space. */
export type ClassAt = (worldX: number, worldY: number) => number;

/**
 * Every point of scenery in one cell, in the order they are let in.
 *
 * The jitter runs over the whole of a grid square rather than a fraction of it. Held to less than half
 * the spacing it could never make a clump or a clearing, and the eye finds the lattice at exactly the
 * zoom this is for; over the whole square the points gather and thin the way a scattering should.
 */
export function scatterCell(
  cellX: number,
  cellY: number,
  spacing: number,
  classAt: ClassAt,
  growing: readonly Growing[] = whatGrows(),
): ScatteredPoint[] {
  const across = Math.max(1, Math.round(CELL / spacing));
  const step = CELL / across;
  const fromX = cellX * CELL;
  const fromY = cellY * CELL;
  const points: ScatteredPoint[] = [];

  for (let row = 0; row < across; row += 1) {
    for (let column = 0; column < across; column += 1) {
      // The grid point is in world space, not in the cell, so the cell's own address never reaches the
      // hash and cutting the cache differently would produce the very same scenery.
      const gx = cellX * across + column;
      const gy = cellY * across + row;
      const x = fromX + (column + hash2(gx, gy, SEED.alongX)) * step;
      const y = fromY + (row + hash2(gx, gy, SEED.alongY)) * step;

      const grows = growing[classAt(x, y)];
      if (grows === undefined || grows.total === 0) {
        continue;
      }
      const kind = kindFor(grows, hash2(gx, gy, SEED.kind));
      const of = KINDS[kind];
      if (of === undefined) {
        continue;
      }
      const vary = (hash2(gx, gy, SEED.size) * 2 - 1) * of.vary;
      points.push({
        x,
        y,
        kind,
        rank: hash2(gx, gy, SEED.rank),
        height: of.groundHeight * (1 + vary),
      });
    }
  }

  // Sorted so that taking the first so many is taking the lowest ranks, which is what makes a thinner
  // scattering a subset of a denser one. It also makes drawing a fraction of a cell a prefix walk
  // rather than a test on every point.
  points.sort((left, right) => left.rank - right.rank);
  return points;
}

/** Which cell a point of world space falls in. */
export function cellOf(world: number): number {
  return Math.floor(world / CELL);
}
