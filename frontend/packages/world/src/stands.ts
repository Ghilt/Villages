import { hash2 } from './painterly.ts';
import type { Growing, Kind, StandRule } from './biome.ts';

/**
 * Stands: the clumps a wood is actually made of, and the bytes they travel in.
 *
 * An even scatter of pines is wallpaper, and the eye says so in about two seconds. What a forest looks
 * like from above is *patches* — a stand of spruce, a thinner one of birch beside it, a clearing between
 * them — and that is the one thing a per-point hash cannot invent, because it has no idea what its
 * neighbours are doing.
 *
 * So a **stand** is a disc: a middle, a reach, a favourite kind, and how thickly things grow inside it.
 * The middles are a Poisson process modulated by the biome, and the scenery inside one is scattered
 * about it — which is a Neyman-Scott cluster process, the textbook model for exactly this, and the one
 * the perceptual study behind `docs/plans/biome-sprite-map.md` found read as most realistic from above.
 *
 * Two things it deliberately does not do.
 *
 * **It does not decide the outline.** A point inside a stand only grows if the terrain class *under that
 * point* allows it. So a wood's shape is the shape Adam painted, to the master pixel, and the stand only
 * says what the inside of it is like. That is the whole answer to wanting a forest shaped to fit pixels.
 *
 * **It does not throw darts.** Cluster middles are accepted or not and never pushed apart. Rejection
 * sampling is what AutoBiomes does for individual assets, and it is the wrong tool one level up: two
 * stands landing together is a bigger, thicker wood, which is a thing woods do.
 */

/** One stand as it is written: see the table in docs/plans/biome-sprite-map.md. */
export const STAND_BYTES = 8;

/** A stand with no favourite kind grows its biome's ordinary mix, only thicker. */
export const NO_FAVOURITE = 255;

/** How far apart stand candidates are considered, in world units. */
export const PARENT_STEP = 8;

const SEED = {
  take: 0x51ab,
  alongX: 0x2c07,
  alongY: 0x6b3d,
  reach: 0x1f77,
  favourite: 0x44e1,
  own: 0x0d29,
} as const;

/** Eighths of a world unit, so a stand's middle is written to an eighth and a tile offset fits two bytes. */
const PLACE_STEP = 8;
/** Quarters of a world unit, so a reach fits one byte up to sixty-four. */
const REACH_STEP = 4;
/**
 * Thickness is points to the square world unit in one byte. Four hundred steps to the unit puts the
 * whole usable range - nothing up to about 0.64 - inside a byte at a resolution far finer than an eye
 * could read, and experiment 0006's ceiling of 0.44 sits comfortably inside it.
 */
const THICKNESS_STEP = 400;

export interface Stand {
  /** World units, absolute. */
  x: number;
  y: number;
  reach: number;
  /** An index into the file's kinds, or `NO_FAVOURITE`. */
  dominant: number;
  /** Points to the square world unit inside this stand. */
  thickness: number;
  /** So that two stands of the same favourite are still two stands. */
  seed: number;
}

/** A tile's stands, kept as parallel arrays because the browser walks them once a point. */
export interface StandChunk {
  count: number;
  x: Float32Array;
  y: Float32Array;
  reach: Float32Array;
  dominant: Uint8Array;
  thickness: Float32Array;
  seed: Uint8Array;
}

export const NO_STANDS: StandChunk = {
  count: 0,
  x: new Float32Array(0),
  y: new Float32Array(0),
  reach: new Float32Array(0),
  dominant: new Uint8Array(0),
  thickness: new Float32Array(0),
  seed: new Uint8Array(0),
};

/**
 * A stand candidate at one point of the parent grid, or null where the biome did not want one.
 *
 * Pure and hashed from the grid point alone, so the generator can be re-run over a repainted master and
 * every stand on ground that did not change comes back identical.
 */
export function standAt(gridX: number, gridY: number, rule: StandRule, favourite: number): Stand | null {
  const wanted = (rule.per1000 / 1000) * PARENT_STEP * PARENT_STEP;
  if (wanted <= 0 || hash2(gridX, gridY, SEED.take) >= wanted) {
    return null;
  }

  const [low, high] = rule.reach;
  return {
    x: (gridX + hash2(gridX, gridY, SEED.alongX)) * PARENT_STEP,
    y: (gridY + hash2(gridX, gridY, SEED.alongY)) * PARENT_STEP,
    reach: low + (high - low) * hash2(gridX, gridY, SEED.reach),
    dominant: favourite,
    thickness: rule.inside,
    seed: Math.floor(hash2(gridX, gridY, SEED.own) * 256) & 0xff,
  };
}

/** The roll a caller uses to choose a stand's favourite kind, so the choice stays with the grid point. */
export function favouriteRoll(gridX: number, gridY: number): number {
  return hash2(gridX, gridY, SEED.favourite);
}

const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value;

/** A tile's stands as the eight bytes each that go on the wire, positions relative to the tile's corner. */
export function encodeStands(
  stands: readonly Stand[],
  tileX: number,
  tileY: number,
  tileUnits: number,
): Uint8Array {
  const bytes = new Uint8Array(stands.length * STAND_BYTES);
  const view = new DataView(bytes.buffer);
  stands.forEach((stand, at) => {
    const offset = at * STAND_BYTES;
    view.setInt16(offset, Math.round((stand.x - tileX * tileUnits) * PLACE_STEP), true);
    view.setInt16(offset + 2, Math.round((stand.y - tileY * tileUnits) * PLACE_STEP), true);
    bytes[offset + 4] = clamp(Math.round(stand.reach * REACH_STEP), 0, 255);
    bytes[offset + 5] = stand.dominant;
    bytes[offset + 6] = clamp(Math.round(stand.thickness * THICKNESS_STEP), 0, 255);
    bytes[offset + 7] = stand.seed;
  });
  return bytes;
}

export function decodeStands(bytes: Uint8Array, tileX: number, tileY: number, tileUnits: number): StandChunk {
  const count = Math.floor(bytes.length / STAND_BYTES);
  const chunk: StandChunk = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    reach: new Float32Array(count),
    dominant: new Uint8Array(count),
    thickness: new Float32Array(count),
    seed: new Uint8Array(count),
  };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let at = 0; at < count; at += 1) {
    const offset = at * STAND_BYTES;
    chunk.x[at] = tileX * tileUnits + view.getInt16(offset, true) / PLACE_STEP;
    chunk.y[at] = tileY * tileUnits + view.getInt16(offset + 2, true) / PLACE_STEP;
    chunk.reach[at] = view.getUint8(offset + 4) / REACH_STEP;
    chunk.dominant[at] = view.getUint8(offset + 5);
    chunk.thickness[at] = view.getUint8(offset + 6) / THICKNESS_STEP;
    chunk.seed[at] = view.getUint8(offset + 7);
  }
  return chunk;
}

/**
 * The stands that could possibly reach a box, as a chunk of their own.
 *
 * A zoom 7 tile holds a few hundred stands and a scatter cell is an eighth of it across, so without this
 * every grid point in a cell would walk every stand in the tile - three hundred thousand distance checks
 * for a cell, several hundred cells in view. Filtered once a cell it is a few hundred checks and then a
 * handful a point.
 */
export function standsNear(
  chunk: StandChunk,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): StandChunk {
  const keep: number[] = [];
  for (let at = 0; at < chunk.count; at += 1) {
    const reach = chunk.reach[at]!;
    const x = chunk.x[at]!;
    const y = chunk.y[at]!;
    if (x + reach < fromX || x - reach > toX || y + reach < fromY || y - reach > toY) {
      continue;
    }
    keep.push(at);
  }
  if (keep.length === chunk.count) {
    return chunk;
  }

  const near: StandChunk = {
    count: keep.length,
    x: new Float32Array(keep.length),
    y: new Float32Array(keep.length),
    reach: new Float32Array(keep.length),
    dominant: new Uint8Array(keep.length),
    thickness: new Float32Array(keep.length),
    seed: new Uint8Array(keep.length),
  };
  keep.forEach((from, to) => {
    near.x[to] = chunk.x[from]!;
    near.y[to] = chunk.y[from]!;
    near.reach[to] = chunk.reach[from]!;
    near.dominant[to] = chunk.dominant[from]!;
    near.thickness[to] = chunk.thickness[from]!;
    near.seed[to] = chunk.seed[from]!;
  });
  return near;
}

/**
 * How thick the scenery is at a point, and which stand is speaking loudest there.
 *
 * A stand is not a flat disc. Its thickness falls off from the middle as `1 - t²`, and **stands add
 * together** rather than one winning: two overlapping stands make a thicker wood, three make a thicket,
 * and the ground between them thins to whatever the biome grows in the open. That sum is the intensity
 * function of a Neyman-Scott cluster process written out, and it is what makes a wood lumpy instead of
 * uniformly speckled - which was the whole complaint about the even scatter it replaces.
 *
 * Capped at `most`, because a pile-up of stands must not take the map past experiment 0006's ceiling.
 */
export interface Thickness {
  /** Points to the square world unit wanted here. */
  density: number;
  /**
   * Whether this point is inside any stand at all.
   *
   * Separate from `dominant` on purpose. A stand is allowed to have no favourite kind, and asking
   * `dominant === NO_FAVOURITE` would then say "out on the open ground" about the middle of a wood -
   * which would keep every gathering kind out of exactly the place it belongs.
   */
  inStand: boolean;
  /** The favourite kind of the loudest stand, or `NO_FAVOURITE` where there is none. */
  dominant: number;
  /** The seed of that stand, so two stands of the same favourite still differ. */
  seed: number;
}

export function thicknessAt(
  chunk: StandChunk,
  x: number,
  y: number,
  outside: number,
  most: number,
): Thickness {
  let density = outside;
  let loudest = -1;
  let dominant = NO_FAVOURITE;
  let seed = 0;

  for (let at = 0; at < chunk.count; at += 1) {
    const reach = chunk.reach[at]!;
    const dx = x - chunk.x[at]!;
    if (dx < -reach || dx > reach) {
      continue;
    }
    const dy = y - chunk.y[at]!;
    if (dy < -reach || dy > reach) {
      continue;
    }
    const away = (dx * dx + dy * dy) / (reach * reach);
    if (away >= 1) {
      continue;
    }
    const here = chunk.thickness[at]! * (1 - away);
    density += here;
    if (here > loudest) {
      loudest = here;
      dominant = chunk.dominant[at]!;
      seed = chunk.seed[at]!;
    }
  }

  return { density: density > most ? most : density, inStand: loudest >= 0, dominant, seed };
}

/** What a stand of a given reach contributes to the world's average, once its falloff is counted. */
export function standWeight(reach: number): number {
  // The integral of 1 - t² over a disc, which is half its area. The reason the peak is twice the mean.
  return (Math.PI * reach * reach) / 2;
}

/** A dominant kind at least this tall counts as a canopy, and shades what stands under it. */
export const CANOPY_HEIGHT = 1.3;
/** What a stand does to its own favourite kind. */
export const FAVOURED = 4;
/** And to everything else, under a canopy: the shade-tolerant thrive and the rival trees do not. */
export const UNDER_CANOPY = 1.6;
export const SHADED_OUT = 0.45;

/**
 * Which kind grows at a point, given what the biome and the terrain allow and which stand it is in.
 *
 * The weights are walked rather than precomputed because a stand changes them: a mix of two to five
 * entries costs a handful of multiplies, where a table for every (biome, class, favourite) triple would
 * be eight thousand of them built to answer a question asked once.
 *
 * `-1` where nothing grows, which is how ocean, ice and bare rock stay empty.
 */
export function pickKindIn(growing: Growing, kinds: readonly Kind[], dominant: number, roll: number): number {
  if (growing.total <= 0) {
    return -1;
  }
  if (dominant === NO_FAVOURITE || dominant >= kinds.length) {
    return walk(growing, roll * growing.total, null);
  }

  const canopy = kinds[dominant]!.groundHeight >= CANOPY_HEIGHT;
  const weigh = (kind: number): number => {
    if (kind === dominant) {
      return FAVOURED;
    }
    if (!canopy) {
      return 1;
    }
    return kinds[kind]!.underCanopy ? UNDER_CANOPY : SHADED_OUT;
  };

  let total = 0;
  for (let at = 0; at < growing.kinds.length; at += 1) {
    total += weightOf(growing, at) * weigh(growing.kinds[at]!);
  }
  return walk(growing, roll * total, weigh);
}

const weightOf = (growing: Growing, at: number): number =>
  growing.upTo[at]! - (at === 0 ? 0 : growing.upTo[at - 1]!);

function walk(growing: Growing, want: number, weigh: ((kind: number) => number) | null): number {
  let running = 0;
  for (let at = 0; at < growing.kinds.length; at += 1) {
    const kind = growing.kinds[at]!;
    running += weightOf(growing, at) * (weigh === null ? 1 : weigh(kind));
    if (want < running) {
      return kind;
    }
  }
  return growing.kinds[growing.kinds.length - 1]!;
}

/**
 * The most commonly wanted kinds of a biome, so a stand can pick a favourite without knowing which class
 * it happens to have landed on. Running totals, in the same shape a `Growing` uses.
 */
export function favouritesOf(
  grows: Record<string, Record<string, number>>,
  kindIndex: Map<string, number>,
): {
  kinds: Int32Array;
  upTo: Float64Array;
  total: number;
} {
  const summed = new Map<number, number>();
  for (const mix of Object.values(grows)) {
    for (const [name, weight] of Object.entries(mix)) {
      const index = kindIndex.get(name);
      if (index !== undefined) {
        summed.set(index, (summed.get(index) ?? 0) + weight);
      }
    }
  }
  const entries = [...summed.entries()].sort((a, b) => a[0] - b[0]);
  const kinds = new Int32Array(entries.length);
  const upTo = new Float64Array(entries.length);
  let running = 0;
  entries.forEach(([index, weight], at) => {
    running += weight;
    kinds[at] = index;
    upTo[at] = running;
  });
  return { kinds, upTo, total: running };
}
