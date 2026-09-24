import { wanderAt } from './biome.ts';
import type { Kind } from './biome.ts';
import { hash2 } from './painterly.ts';
import { biomeAt } from './spriteMap.ts';
import type { SpriteMap } from './spriteMap.ts';
import { pickKindIn, standsNear, thicknessAt } from './stands.ts';
import type { StandChunk } from './stands.ts';

/**
 * Where scenery stands, worked out from the world rather than stored in it.
 *
 * Nothing here is kept and nothing is sent: a pine is a pure function of the point of world space it
 * grows on and what is true of that point. That is 0032's argument, which said the same about what an
 * area encloses - an answer that changes with the camera is not a property of the world - and it is what
 * makes this affordable at all, because a carpet over the whole Earth is nobody's to store.
 *
 * **A point's identity is its place on the grid, not the cell it was generated in.** Cells are a cache
 * and nothing else. The same grid point is the same pine at every zoom, in every session, for ever, and
 * changing how the cache is cut changes nothing about what is drawn.
 *
 * What a point asks the ground, in order, and every one of them is cheap:
 *
 * 1. **Which biome**, from the sprite map's raster, sampled through a wander so the edge of one does not
 *    follow the grid it was stored on.
 * 2. **Which terrain class**, from the zoom 7 tile, as it always did. The biome never overrides this:
 *    a wood's outline is the outline Adam painted, to the master pixel.
 * 3. **How thick it is here**, from the stands covering the point. Stands add rather than one winning,
 *    so a wood is lumpy - which is the whole reason any of this exists.
 * 4. **Whether this point survives that thickness**, against its own roll. The grid is cut at the
 *    thickest the world gets, and everywhere else is a thinning of it, so a point that is drawn at one
 *    density is drawn at every higher one and nothing is ever reshuffled.
 * 5. **Which kind**, from the biome's commonality for that class, leant on by the stand's favourite.
 *
 * Pure, so the whole rule can be tested without a renderer and without a tile.
 */

/**
 * How much world space one cell covers.
 *
 * Thirty-two, and not approximately: a zoom 7 tile is 256 world units across, so an aligned cell never
 * straddles two of them and one cell needs exactly one tile of terrain and one chunk of stands. It also
 * keeps the number of cells in view sensible at both ends - about a hundred on a desktop at zoom 8,
 * about six on a phone at zoom 10.
 */
export const CELL = 32;

/** The seeds. Different numbers for different questions about the same point, so they do not agree. */
const SEED = {
  alongX: 0x5ce7,
  alongY: 0x11ab,
  rank: 0x2f93,
  kind: 0x7d41,
  size: 0x3bb9,
  thin: 0x6a15,
  gather: 0x23c9,
} as const;

/**
 * How much of a kind's arrival is decided by how big it is rather than by its own roll.
 *
 * Nought would be experiment 0006: every point arrives in a random order, so a wood's floor fades in
 * beside its trees and the count peaks at zooms where almost nothing is visible - 42,087 particles held
 * to draw 410 was the worst measured. One would be rigid: every oak before every fern, in lockstep, and
 * a wood switching on species by species. Half of each gives a wood that grows from its canopy down and
 * still gathers rather than stepping.
 */
const BY_SIZE = 0.5;

export interface ScatteredPoint {
  /** Where it stands, in world units. */
  x: number;
  y: number;
  /** Which kind it is, as an index into the sprite map's kinds. */
  kind: number;
  /**
   * How early it shows up, from nought to one, and fixed for this point for ever.
   *
   * Drawing takes the lowest ranks first, so a thinner drawing is always a subset of a fuller one and a
   * pine drawn at one zoom is drawn at every closer one. The kind's own `order` leans it, so the big
   * things arrive before the floor they stand on.
   */
  rank: number;
  /** How tall it stands, in world units, with its own jitter already in it. */
  height: number;
}

/** What the scatter needs to know about the ground: the terrain class at a point of world space. */
export type ClassAt = (worldX: number, worldY: number) => number;

/** The thickest any biome in this world asks for, which is the density the grid is cut at. */
export function thickestOf(map: SpriteMap): number {
  return map.file.density.most;
}

/**
 * Every point of scenery in one cell, in the order they are let in.
 *
 * `dial` is the debug panel's multiplier on the whole world's density: one is exactly what the sprite
 * map asked for, a half is half of it. The grid underneath is always cut at the world's thickest
 * whatever the dial says, so turning it lets points in and out without moving any of them.
 *
 * The jitter runs over the whole of a grid square rather than a fraction of it. Held to less than half
 * the spacing it could never make a clump or a clearing, and the eye finds the lattice at exactly the
 * zoom this is for; over the whole square the points gather and thin the way a scattering should.
 */
export function scatterCell(
  cellX: number,
  cellY: number,
  dial: number,
  classAt: ClassAt,
  map: SpriteMap,
  stands: StandChunk,
): ScatteredPoint[] {
  const thickest = thickestOf(map);
  // A grid at the thickest density the world reaches: points per unit squared is one over the step
  // squared, so the step is the reciprocal of its root. Cutting it any denser than the thickest biome
  // asks for is pure waste - every extra point is hashed and then refused - which is why `most` in
  // world/biomes.json is the peak the file actually reaches rather than a round number above it.
  const step = 1 / Math.sqrt(thickest);
  const across = Math.max(1, Math.round(CELL / step));
  const trueStep = CELL / across;
  /** What the grid itself offers, in points to the square world unit. Everything else is a share of it. */
  const gridDensity = 1 / (trueStep * trueStep);

  const fromX = cellX * CELL;
  const fromY = cellY * CELL;
  const points: ScatteredPoint[] = [];

  const { boundary, world } = map.file;
  // Filtered once for the whole cell, plus the wander, so a point walks a handful rather than the tile.
  const near = standsNear(
    stands,
    fromX - boundary.wander,
    fromY - boundary.wander,
    fromX + CELL + boundary.wander,
    fromY + CELL + boundary.wander,
  );
  const kinds = map.kinds;
  const most = map.file.density.most;

  /**
   * The most any point in this cell could possibly want, worked out once.
   *
   * This is what makes cutting a cell affordable. A grid point costs one hash to roll against this, and
   * everything after it - two wanders for the biome, a lookup, a walk over the stands - only happens for
   * the points that survive. On open ground the bound is a fortieth of the grid's own density, so
   * thirty-nine points in forty are refused for the price of one hash. The bound is never *under* what a
   * point can want, so nothing is refused that should have grown: the exact test still follows.
   */
  let couldWant = 0;
  for (const biome of map.file.biomes) {
    couldWant = Math.max(couldWant, biome.outside);
  }
  for (let at = 0; at < near.count; at += 1) {
    couldWant += near.thickness[at]!;
  }
  const ceiling = Math.min(most, couldWant);

  for (let row = 0; row < across; row += 1) {
    for (let column = 0; column < across; column += 1) {
      // The grid point is in world space, not in the cell, so the cell's own address never reaches the
      // hash and cutting the cache differently would produce the very same scenery.
      const gx = cellX * across + column;
      const gy = cellY * across + row;
      const x = fromX + (column + hash2(gx, gy, SEED.alongX)) * trueStep;
      const y = fromY + (row + hash2(gx, gy, SEED.alongY)) * trueStep;

      // The cheap refusal, before anything is looked up. See `couldWant` above.
      const thin = hash2(gx, gy, SEED.thin);
      if (thin >= (ceiling * dial) / gridDensity) {
        continue;
      }

      const terrain = classAt(x, y);
      const biome = biomeAt(
        map,
        x + wanderAt(x, y, boundary.scale, boundary.seed, world.side) * boundary.wander,
        y + wanderAt(x, y, boundary.scale, boundary.seed ^ 0x5bd1, world.side) * boundary.wander,
      );
      const growing = map.growing[biome * 256 + terrain];
      if (growing === undefined || growing.total === 0) {
        continue;
      }

      const here = thicknessAt(near, x, y, map.file.biomes[biome]?.outside ?? 0, most);
      // The grid offers `gridDensity`; what is wanted here is `here.density`. Keeping that share of the
      // grid points is the thinning, and it is the roll already made above - never the rank, or density
      // and arrival would be the same dial and a thinned wood would be all canopy and no floor.
      if (thin >= (here.density * dial) / gridDensity) {
        continue;
      }

      const kind = pickKindIn(growing, kinds, here.dominant, hash2(gx, gy, SEED.kind));
      const of: Kind | undefined = kinds[kind];
      if (of === undefined) {
        continue;
      }
      // A kind that gathers refuses to grow out on the open ground, which is what makes a fern a find
      // in a meadow and a carpet in a wood.
      if (!here.inStand && hash2(gx, gy, SEED.gather) < of.gather) {
        continue;
      }

      const vary = (hash2(gx, gy, SEED.size) * 2 - 1) * of.vary;
      const own = hash2(gx, gy, SEED.rank);
      points.push({
        x,
        y,
        kind,
        rank: own * (1 - BY_SIZE) + (1 - of.order / 10) * BY_SIZE,
        height: of.groundHeight * (1 + vary),
      });
    }
  }

  // Sorted so that taking the first so many is taking the lowest ranks, which is what makes a thinner
  // drawing a subset of a fuller one. It also makes drawing a fraction of a cell a prefix walk rather
  // than a test on every point.
  points.sort((left, right) => left.rank - right.rank);
  return points;
}

/** Which cell a point of world space falls in. */
export function cellOf(world: number): number {
  return Math.floor(world / CELL);
}
