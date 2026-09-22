import { hash2, smoothstep } from './painterly.ts';
import { noiseAt } from './noise.ts';
import type { NoiseField } from './noise.ts';
import { toRgb } from './palette.ts';
import type { Palette } from './palette.ts';

/**
 * What kind of place a part of the world is, and what grows there.
 *
 * The terrain class says what the ground *is*: Adam painted it, one of thirty-two, one per master pixel.
 * It does not say what the ground is *like*. Two mixed forests four thousand kilometres apart are the
 * same class and should not be the same forest, and a fern that is everywhere in one of them should be
 * a find in the other. A **biome** is that difference: a region with a character, which never overrides
 * the class but chooses which kinds grow on it here and how numerous each one is.
 *
 * Four axes, each nought to a hundred, each cheap and each something the class genuinely does not carry:
 *
 * - **warmth**, from the latitude of the master row, because the master is equirectangular and a row
 *   *is* a latitude. The one axis that is free.
 * - **wet**, how near open water this is. Not how wet the ground is — the class already says that, and
 *   `grows` is keyed by the class — but whether this is a shore or an interior, which nothing else knows.
 * - **high**, how much of the ground about here is the palette's `high` group. A mountain range is far
 *   larger than a biome cell, so this is honest at the resolution it is measured at.
 * - **region**, a slow noise field, which is the only reason two places at the same latitude differ.
 *
 * A biome is matched by walking the list and taking the **first one that accepts all four**, so the order
 * in `world/biomes.json` is the rule and the last entry is the catch-all. That is a firewall rather than
 * a grid: a grid over four axes is fifteen thousand cells nobody can hold in their head, and an ordered
 * list of fifteen is read top to bottom and argued with.
 *
 * Nothing here touches a file. The generator calls it over the whole master, the browser calls it per
 * point, and they must agree exactly or the scenery would move when the page reloaded.
 */

/** One kind of scenery. The five properties past the first two are what the prior art converged on. */
export interface Kind {
  name: string;
  /** Height in world units, as decision record 0051 means it: a map convention, not a measurement. */
  groundHeight: number;
  /** How much the height varies either side, as a fraction. */
  vary: number;
  /** Nought to ten, biggest last to go: biases rank, so a wood's trees arrive before its floor does. */
  order: number;
  /** Nought loose over the ground, one only ever inside a stand. */
  gather: number;
  /** How near another of its own kind may stand, in world units. */
  apart: number;
  /** Whether it may stand under a taller kind. */
  underCanopy: boolean;
}

/** A range on one axis. Both ends inclusive, because a hundred has to be reachable. */
export type Band = readonly [number, number];

/** An axis left out accepts anything, which is what makes the catch-all `{}`. */
export interface Where {
  warmth?: Band;
  wet?: Band;
  high?: Band;
  region?: Band;
}

export interface StandRule {
  /** Stands per thousand square world units. */
  per1000: number;
  reach: Band;
  /** Points to the square world unit inside a stand, and out on the ground between them. */
  inside: number;
  outside: number;
}

export interface Biome {
  name: string;
  colour: string;
  where: Where;
  stands: StandRule;
  /** Terrain class name to kind name to commonality: a weight, not a probability. */
  grows: Record<string, Record<string, number>>;
}

export interface RegionField {
  coarse: NoiseField;
  fine: NoiseField;
  fineWeight: number;
}

/** How far a biome edge is allowed to stray from the grid it was stored on, and at what wavelength. */
export interface BoundaryRule {
  wander: number;
  scale: number;
  seed: number;
}

export interface BiomeFile {
  /**
   * The most points to the square world unit anything may ask for, whatever the stands pile up to.
   * Experiment 0006 found it by Adam's hand at 0.44; it lives here rather than in code because it is a
   * fact about his machine and his eye, and both are allowed to change.
   */
  ceiling: number;
  /**
   * The most any single point may ask for, however many stands pile up on it.
   *
   * It has a second job that makes it the more important of the two numbers: **the browser cuts its grid
   * at exactly this density**, and then keeps a share of the points. So a `most` above what any biome
   * actually reaches is not merely harmless slack - it is grid points hashed and then refused, on every
   * cell, for ever. It belongs just above the largest `inside` in the file and nowhere higher.
   *
   * Unrelated to `ceiling`, and allowed to be under it: the ceiling is what a whole screenful may
   * average, and a peak over a patch a few units across is not a screenful.
   */
  most: number;
  region: RegionField;
  boundary: BoundaryRule;
  kinds: Kind[];
  biomes: Biome[];
}

export interface BiomeAxes {
  warmth: number;
  wet: number;
  high: number;
  region: number;
}

export interface BiomeProblem {
  kind:
    | 'duplicate-name'
    | 'bad-colour'
    | 'bad-band'
    | 'bad-number'
    | 'unknown-kind'
    | 'unknown-class'
    | 'no-catch-all'
    | 'unreachable';
  detail: string;
}

const inOrder = (band: Band | undefined, what: string, problems: BiomeProblem[]): void => {
  if (band === undefined) {
    return;
  }
  const [low, high] = band;
  if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) {
    problems.push({ kind: 'bad-band', detail: `${what} is [${String(low)}, ${String(high)}]` });
  }
};

/**
 * Everything that would make the file unusable, reported together rather than one throw at a time.
 *
 * This is the same bargain `paletteProblems` and `preparePainterly` already make, and for the reason
 * `painterly.test.ts` states: a hand-edited JSON that nothing typechecks costs a run of the generator or
 * an empty world in the browser, and either is worse than a failing test. The generator calls it before
 * it reads a single pixel.
 */
export function biomeProblems(file: BiomeFile, palette: Palette): BiomeProblem[] {
  const problems: BiomeProblem[] = [];
  const kindNames = new Set<string>();
  const classNames = new Set(palette.classes.map((terrain) => terrain.name));

  for (const kind of file.kinds) {
    if (kindNames.has(kind.name)) {
      problems.push({ kind: 'duplicate-name', detail: `kind ${kind.name} is listed twice` });
    }
    kindNames.add(kind.name);
    for (const [what, value] of [
      ['groundHeight', kind.groundHeight],
      ['vary', kind.vary],
      ['order', kind.order],
      ['gather', kind.gather],
      ['apart', kind.apart],
    ] as const) {
      if (!Number.isFinite(value) || value < 0) {
        problems.push({ kind: 'bad-number', detail: `${kind.name}.${what} is ${String(value)}` });
      }
    }
  }

  const biomeNames = new Set<string>();
  for (const biome of file.biomes) {
    if (biomeNames.has(biome.name)) {
      problems.push({ kind: 'duplicate-name', detail: `biome ${biome.name} is listed twice` });
    }
    biomeNames.add(biome.name);

    try {
      toRgb(biome.colour);
    } catch {
      problems.push({ kind: 'bad-colour', detail: `${biome.name} has colour ${biome.colour}` });
    }

    inOrder(biome.where.warmth, `${biome.name}.where.warmth`, problems);
    inOrder(biome.where.wet, `${biome.name}.where.wet`, problems);
    inOrder(biome.where.high, `${biome.name}.where.high`, problems);
    inOrder(biome.where.region, `${biome.name}.where.region`, problems);
    inOrder(biome.stands.reach, `${biome.name}.stands.reach`, problems);

    for (const [className, mix] of Object.entries(biome.grows)) {
      if (!classNames.has(className)) {
        problems.push({ kind: 'unknown-class', detail: `${biome.name} grows on ${className}` });
      }
      for (const [kindName, weight] of Object.entries(mix)) {
        if (!kindNames.has(kindName)) {
          problems.push({ kind: 'unknown-kind', detail: `${biome.name}.${className} wants ${kindName}` });
        }
        if (!Number.isFinite(weight) || weight <= 0) {
          problems.push({
            kind: 'bad-number',
            detail: `${biome.name}.${className}.${kindName} is ${String(weight)}`,
          });
        }
      }
    }
  }

  // The list is walked in order and something must always answer, or a patch of the world would have no
  // biome at all and the generator would have to invent one at the worst possible moment.
  if (!Number.isFinite(file.ceiling) || file.ceiling <= 0) {
    problems.push({ kind: 'bad-number', detail: `ceiling is ${String(file.ceiling)}` });
  }
  const peak = Math.max(0, ...file.biomes.map((biome) => biome.stands.inside));
  if (!Number.isFinite(file.most) || file.most < peak) {
    problems.push({
      kind: 'bad-number',
      detail: `most is ${String(file.most)}, under the thickest stand at ${peak.toFixed(3)}`,
    });
  }
  // Well above it and every cell pays for grid points it will only refuse. Twice is already wasteful.
  if (Number.isFinite(file.most) && peak > 0 && file.most > peak * 2) {
    problems.push({
      kind: 'bad-number',
      detail: `most is ${String(file.most)}, far above the thickest stand at ${peak.toFixed(3)}`,
    });
  }

  const last = file.biomes.at(-1);
  if (last === undefined || Object.keys(last.where).length > 0) {
    problems.push({ kind: 'no-catch-all', detail: 'the last biome must have an empty where' });
  }

  // A biome an earlier one already covers entirely can never be reached, which is a silent edit rather
  // than a broken file: the numbers get tuned and nothing changes.
  for (let later = 1; later < file.biomes.length; later += 1) {
    const mine = file.biomes[later]!;
    for (let earlier = 0; earlier < later; earlier += 1) {
      if (covers(file.biomes[earlier]!.where, mine.where)) {
        problems.push({
          kind: 'unreachable',
          detail: `${mine.name} is never reached: ${file.biomes[earlier]!.name} already takes all of it`,
        });
        break;
      }
    }
  }

  return problems;
}

const widerThan = (outer: Band | undefined, inner: Band | undefined): boolean => {
  if (outer === undefined) {
    return true;
  }
  if (inner === undefined) {
    return false;
  }
  return outer[0] <= inner[0] && outer[1] >= inner[1];
};

/** Whether everything `inner` accepts, `outer` accepts too. */
function covers(outer: Where, inner: Where): boolean {
  return (
    widerThan(outer.warmth, inner.warmth) &&
    widerThan(outer.wet, inner.wet) &&
    widerThan(outer.high, inner.high) &&
    widerThan(outer.region, inner.region)
  );
}

const within = (band: Band | undefined, value: number): boolean =>
  band === undefined || (value >= band[0] && value <= band[1]);

/**
 * The first biome that accepts all four axes. Never null, because `biomeProblems` refuses a file whose
 * last entry is not the catch-all.
 */
export function chooseBiome(axes: BiomeAxes, biomes: readonly Biome[]): number {
  for (let index = 0; index < biomes.length; index += 1) {
    const where = biomes[index]!.where;
    if (
      within(where.warmth, axes.warmth) &&
      within(where.wet, axes.wet) &&
      within(where.high, axes.high) &&
      within(where.region, axes.region)
    ) {
      return index;
    }
  }
  return Math.max(0, biomes.length - 1);
}

/**
 * Warmth from latitude: a hundred on the equator, nothing at the poles.
 *
 * `cos(latitude)` to the power of 1.4 rather than anything derived from real climate data, because
 * importing real climate would bind the world to Earth's coastline, which is the thing
 * `docs/plans/world-generator.md` says to avoid while the map is still moving. The exponent is what puts
 * the treeline near sixty-six degrees rather than near forty-five, and it is a number to taste.
 */
export function warmthOfLatitude(latitude: number): number {
  // Clamped at the pole itself rather than short of it: past ninety the cosine goes negative and a
  // negative base to a fractional power is NaN, which would furnish the world with nothing and say why
  // nowhere. Clamping short of it instead would make two different latitudes the same warmth.
  const from = Math.min(90, Math.abs(latitude)) * (Math.PI / 180);
  return 100 * Math.max(0, Math.cos(from)) ** 1.4;
}

/**
 * How near open water this is, as a hundred on the shore falling to nothing well inland.
 *
 * Forty world units is about fifty kilometres at the equator, which is roughly where a coast stops
 * telling you what the weather is like.
 */
export function wetnessOfDistance(unitsToWater: number): number {
  return 100 * (1 - smoothstep(0, 40, unitsToWater));
}

/** The region field: one slow octave with a faster one folded in, mapped from [-1, 1] onto [0, 100]. */
export function regionAt(lng: number, lat: number, field: RegionField): number {
  const coarse = noiseAt(lng, lat, field.coarse, 0);
  const fine = noiseAt(lng, lat, field.fine, 1);
  const mixed = (coarse + fine * field.fineWeight) / (1 + field.fineWeight);
  return Math.min(100, Math.max(0, (mixed + 1) * 50));
}

/**
 * Value noise in world space, in [-1, 1], used to push a biome sample sideways so that a biome edge
 * wanders rather than following the grid the biome raster was stored on.
 *
 * `hash2` rather than `noiseAt` because this is asked per scenery point, in the browser, on a world
 * coordinate — and because it is the hash the scatter and the painterly treatment already share, so
 * three things that look at the same ground cannot disagree about it. `period` wraps it at the
 * antimeridian.
 */
export function wanderAt(x: number, y: number, scale: number, seed: number, period: number): number {
  // The cell is sized from the period rather than from `scale`, so that a whole number of them fits the
  // world exactly. Dividing by `scale` directly leaves a remainder at the antimeridian, and the two
  // sides of the seam then sample different points of the same cell - a visible line down the map that
  // is in neither the terrain nor the paint.
  const cells = Math.max(1, Math.round(period / scale));
  const step = period / cells;

  const u = x / step;
  const v = y / step;
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const fx = smoothstep(0, 1, u - x0);
  const fy = smoothstep(0, 1, v - y0);

  const wrap = (at: number): number => ((at % cells) + cells) % cells;

  const c00 = hash2(wrap(x0), y0, seed);
  const c10 = hash2(wrap(x0 + 1), y0, seed);
  const c01 = hash2(wrap(x0), y0 + 1, seed);
  const c11 = hash2(wrap(x0 + 1), y0 + 1, seed);

  const top = c00 + (c10 - c00) * fx;
  const bottom = c01 + (c11 - c01) * fx;
  return (top + (bottom - top) * fy) * 2 - 1;
}

/** The running totals a weighted pick needs, worked out once per biome and class rather than per point. */
export interface Growing {
  /** Index into the file's `kinds`, in the order the weights were given. */
  kinds: Int32Array;
  /** Running totals, so a pick is one roll against `total` and a walk. */
  upTo: Float64Array;
  total: number;
}

const NOTHING: Growing = { kinds: new Int32Array(0), upTo: new Float64Array(0), total: 0 };

/**
 * Every (biome, terrain class) pair flattened into running totals, indexed
 * `biomeIndex * 256 + classId`. A class a biome does not list grows nothing, which is how ocean, ice and
 * bare sand stay empty without a rule saying so anywhere.
 */
export function growingTable(file: BiomeFile, palette: Palette): Growing[] {
  const classId = new Map(palette.classes.map((terrain) => [terrain.name, terrain.id]));
  const kindIndex = new Map(file.kinds.map((kind, index) => [kind.name, index]));
  const table: Growing[] = new Array<Growing>(file.biomes.length * 256).fill(NOTHING);

  file.biomes.forEach((biome, biomeIndex) => {
    for (const [className, mix] of Object.entries(biome.grows)) {
      const id = classId.get(className);
      if (id === undefined) {
        continue;
      }
      const entries = Object.entries(mix).filter(([name]) => kindIndex.has(name));
      if (entries.length === 0) {
        continue;
      }
      const kinds = new Int32Array(entries.length);
      const upTo = new Float64Array(entries.length);
      let running = 0;
      entries.forEach(([name, weight], at) => {
        running += weight;
        kinds[at] = kindIndex.get(name)!;
        upTo[at] = running;
      });
      table[biomeIndex * 256 + id] = { kinds, upTo, total: running };
    }
  });

  return table;
}

/** Which kind a roll in [0, 1) lands on, or -1 where nothing grows. */
export function pickKind(growing: Growing, roll: number): number {
  if (growing.total <= 0) {
    return -1;
  }
  const want = roll * growing.total;
  for (let at = 0; at < growing.upTo.length; at += 1) {
    if (want < growing.upTo[at]!) {
      return growing.kinds[at]!;
    }
  }
  return growing.kinds[growing.kinds.length - 1]!;
}
