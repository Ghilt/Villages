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
 * 6. **Whether anything that arrives earlier stands too near it**, within the two kinds' `apart`. A
 *    Matérn type II thinning: it asks about candidates and never about which of them survive, so it has
 *    no chain of consequences and stays a pure function of the ground near the point. Experiment 0012.
 *
 * Pure, so the whole rule can be tested without a renderer and without a tile.
 */

/**
 * How much world space one cell covers.
 *
 * Thirty-two, and not approximately: a zoom 7 tile is 256 world units across, so an aligned cell never
 * straddles two of them and a cell's own points need exactly one tile of terrain and one chunk of stands;
 * only the margin it spaces them against reaches the next tile, near an edge. It also
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

/**
 * The ground around a cell, which is more than the cell's own tile.
 *
 * A cell spaces its points against its neighbours' candidates, so it scatters a margin of them too, and a
 * candidate near a tile's edge may stand on the next tile. Each one is worked out from the terrain and
 * the stands of the tile it actually stands on - exactly what the cell that owns it works it out from - so
 * a candidate is the same candidate whichever cell asks. That is what keeps spacing seamless across the
 * edges of cells and of tiles.
 */
export interface Ground {
  /** The terrain class anywhere the cell and its margin reach. */
  classAt: ClassAt;
  /** The stands of one zoom 7 tile, by its column and row. Every stand overlapping a tile is in its chunk. */
  standsOf: (tileX: number, tileY: number) => StandChunk;
}

/** The thickest any biome in this world asks for, which is the density the grid is cut at. */
export function thickestOf(map: SpriteMap): number {
  return map.file.density.most;
}

/** The grid a cell is cut on: how many squares across, how wide each is, and what it offers. */
function gridOf(map: SpriteMap): { across: number; trueStep: number; gridDensity: number } {
  // A grid at the thickest density the world reaches: points per unit squared is one over the step
  // squared, so the step is the reciprocal of its root. Cutting it any denser than the thickest biome
  // asks for is pure waste - every extra point is hashed and then refused - which is why `most` in
  // world/biomes.json is the peak the file actually reaches rather than a round number above it.
  const step = 1 / Math.sqrt(thickestOf(map));
  const across = Math.max(1, Math.round(CELL / step));
  const trueStep = CELL / across;
  /** What the grid itself offers, in points to the square world unit. Everything else is a share of it. */
  return { across, trueStep, gridDensity: 1 / (trueStep * trueStep) };
}

/** How many grid squares past its edge a cell looks, so that no neighbour within the widest `apart` is missed. */
function marginOf(map: SpriteMap, spacing: number, trueStep: number): number {
  const widest = Math.max(0, ...map.kinds.map((kind) => kind.apart)) * spacing;
  return widest > 0 ? Math.ceil(widest / trueStep) : 0;
}

/**
 * How far past its own edge a cell reaches for the ground, in world units: its spacing margin and the
 * biome wander. What a caller has to have in hand - the tiles this box touches - before it cuts the cell.
 */
export function reachBeyond(map: SpriteMap, spacing = 1): number {
  const { trueStep } = gridOf(map);
  return marginOf(map, spacing, trueStep) * trueStep + map.file.boundary.wander;
}

/** One candidate: a point that would grow here if nothing earlier stood too near it. */
interface Candidate extends ScatteredPoint {
  column: number;
  row: number;
  /** Whether it grows at the dial asked for, as against at the density the competition is decided at. */
  atDial: boolean;
}

/**
 * Every point of scenery in one cell, in the order they are let in.
 *
 * `dial` is the debug panel's multiplier on the whole world's density: one is exactly what the sprite
 * map asked for, a half is half of it. The grid underneath is always cut at the world's thickest
 * whatever the dial says, so turning it lets points in and out without moving any of them.
 *
 * `spacing` is the other lever, on every kind's `apart`: one is what the file says, nought is the scatter
 * as it was before experiment 0012, where two trees could land on the same spot.
 *
 * The jitter runs over the whole of a grid square rather than a fraction of it. Held to less than half
 * the spacing it could never make a clump or a clearing, and the eye finds the lattice at exactly the
 * zoom this is for; over the whole square the points gather and thin the way a scattering should. The
 * spacing then takes out the ones that landed on top of each other, which the jitter never could.
 */
export function scatterCell(
  cellX: number,
  cellY: number,
  dial: number,
  ground: Ground,
  map: SpriteMap,
  spacing = 1,
): ScatteredPoint[] {
  const { across, trueStep, gridDensity } = gridOf(map);
  const margin = marginOf(map, spacing, trueStep);
  const kinds = map.kinds;
  const most = map.file.density.most;
  const { boundary, world } = map.file;
  const tileUnits = world.tileUnits;

  // The competition is decided at the density the sprite map asked for, or at the dial's when it asks for
  // more; the dial below one then only thins what survived it. So a thinner drawing is still a subset of
  // a fuller one, which is what makes turning the dial watchable rather than a reshuffle.
  const contest = Math.max(1, dial);

  const firstColumn = cellX * across - margin;
  const firstRow = cellY * across - margin;
  const span = across + margin * 2;
  const fromX = firstColumn * trueStep;
  const fromY = firstRow * trueStep;
  const toX = fromX + span * trueStep;
  const toY = fromY + span * trueStep;

  /**
   * What each tile the cell reaches offers, worked out once: its stands near the cell, and the most any
   * point on it could possibly want.
   *
   * The second is what makes cutting a cell affordable. A grid point costs one hash to roll against it,
   * and everything after - two wanders for the biome, a lookup, a walk over the stands - only happens for
   * the points that survive. On open ground the bound is a fortieth of the grid's own density, so
   * thirty-nine points in forty are refused for the price of one hash. The bound is never *under* what a
   * point can want, so nothing is refused that should have grown: the exact test still follows.
   */
  const tiles = new Map<string, { near: StandChunk; ceiling: number }>();
  const tileAt = (x: number, y: number) => {
    const tileX = Math.floor(x / tileUnits);
    const tileY = Math.floor(y / tileUnits);
    const key = `${tileX}/${tileY}`;
    let held = tiles.get(key);
    if (held === undefined) {
      const near = standsNear(
        ground.standsOf(tileX, tileY),
        fromX - boundary.wander,
        fromY - boundary.wander,
        toX + boundary.wander,
        toY + boundary.wander,
      );
      let couldWant = 0;
      for (const biome of map.file.biomes) {
        couldWant = Math.max(couldWant, biome.outside);
      }
      for (let at = 0; at < near.count; at += 1) {
        couldWant += near.thickness[at]!;
      }
      held = { near, ceiling: Math.min(most, couldWant) };
      tiles.set(key, held);
    }
    return held;
  };

  /** The candidate on one grid square, or null where nothing would grow there at the contest's density. */
  const candidateAt = (column: number, row: number): Candidate | null => {
    // The grid point is in world space, not in the cell, so the cell's own address never reaches the
    // hash and cutting the cache differently would produce the very same scenery.
    const x = (column + hash2(column, row, SEED.alongX)) * trueStep;
    const y = (row + hash2(column, row, SEED.alongY)) * trueStep;
    const tile = tileAt(x, y);

    // The cheap refusal, before anything is looked up. See `tiles` above.
    const thin = hash2(column, row, SEED.thin);
    if (thin >= (tile.ceiling * contest) / gridDensity) {
      return null;
    }

    const terrain = ground.classAt(x, y);
    const biome = biomeAt(
      map,
      x + wanderAt(x, y, boundary.scale, boundary.seed, world.side) * boundary.wander,
      y + wanderAt(x, y, boundary.scale, boundary.seed ^ 0x5bd1, world.side) * boundary.wander,
    );
    const growing = map.growing[biome * 256 + terrain];
    if (growing === undefined || growing.total === 0) {
      return null;
    }

    const here = thicknessAt(tile.near, x, y, map.file.biomes[biome]?.outside ?? 0, most);
    // The grid offers `gridDensity`; what is wanted here is `here.density`. Keeping that share of the
    // grid points is the thinning, and it is the roll already made above - never the rank, or density
    // and arrival would be the same dial and a thinned wood would be all canopy and no floor.
    if (thin >= (here.density * contest) / gridDensity) {
      return null;
    }

    const kind = pickKindIn(growing, kinds, here.dominant, hash2(column, row, SEED.kind));
    const of: Kind | undefined = kinds[kind];
    if (of === undefined) {
      return null;
    }
    // A kind that gathers refuses to grow out on the open ground, which is what makes a fern a find
    // in a meadow and a carpet in a wood.
    if (!here.inStand && hash2(column, row, SEED.gather) < of.gather) {
      return null;
    }

    const vary = (hash2(column, row, SEED.size) * 2 - 1) * of.vary;
    const own = hash2(column, row, SEED.rank);
    return {
      x,
      y,
      kind,
      rank: own * (1 - BY_SIZE) + (1 - of.order / 10) * BY_SIZE,
      height: of.groundHeight * (1 + vary),
      column,
      row,
      atDial: thin < (here.density * dial) / gridDensity,
    };
  };

  // Every candidate the cell and its margin hold, one grid square each, so a neighbour is found by
  // looking at the squares around a point rather than at every other point.
  const candidates: (Candidate | null)[] = new Array<Candidate | null>(span * span);
  for (let row = 0; row < span; row += 1) {
    for (let column = 0; column < span; column += 1) {
      candidates[row * span + column] = candidateAt(firstColumn + column, firstRow + row);
    }
  }

  /** Whether `other` arrives before `point`: the lower rank, and the grid's own order to break a tie. */
  const before = (other: Candidate, point: Candidate): boolean =>
    other.rank < point.rank ||
    (other.rank === point.rank &&
      (other.row < point.row || (other.row === point.row && other.column < point.column)));

  const points: ScatteredPoint[] = [];
  for (let row = margin; row < margin + across; row += 1) {
    for (let column = margin; column < margin + across; column += 1) {
      const point = candidates[row * span + column];
      if (point === null || point === undefined || !point.atDial) {
        continue;
      }
      const reach = (kinds[point.kind]?.apart ?? 0) * spacing;
      let crowded = false;
      for (let dy = -margin; dy <= margin && !crowded; dy += 1) {
        for (let dx = -margin; dx <= margin; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }
          const other = candidates[(row + dy) * span + column + dx];
          if (other === null || other === undefined || !before(other, point)) {
            continue;
          }
          // The pair's distance is the mean of the two kinds' `apart`, so two pines keep a pine's apart
          // and a bush may stand nearer a tree than another tree may.
          const apart = (reach + (kinds[other.kind]?.apart ?? 0) * spacing) / 2;
          if ((other.x - point.x) ** 2 + (other.y - point.y) ** 2 < apart * apart) {
            crowded = true;
            break;
          }
        }
      }
      if (!crowded) {
        points.push({ x: point.x, y: point.y, kind: point.kind, rank: point.rank, height: point.height });
      }
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
