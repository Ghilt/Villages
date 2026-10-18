import type { Spawnable } from '../../sprites/critters/critterSpawn';

/**
 * The renders page's world: a square of every kind of land side by side, and a square for each critter, laid out in
 * a world of the page's own, somewhere no house will ever look. Pure, so the page and its test agree on where every
 * square is and what it is.
 */

/**
 * How wide a square is, and the room between two, in world units: above each for its name, and for the crowns of the
 * trees standing at its top edge, which reach up out of it by their height.
 */
export const SQUARE = 10;
export const GAP = 5;
/** The room above the critters' row: a hawk circles this high over its square. */
export const SKY = 9;
/** The zoom the page is drawn at, where the land, the trees and the critters are all whole. */
export const ZOOM = 10;
/** The west and north edges of the page's world, in world units: inside a zoom 7 tile, a little in from its edge. */
export const ORIGIN = { x: 40 * 256 + 8, y: 20 * 256 + 8 } as const;
/** The class of the ground between the squares, the open sea, which nothing of the land layer moves. */
export const BETWEEN = 0;

/** A kind of land as the palette has it. */
export interface LandKind {
  id: number;
  name: string;
  group: string;
}

/** A critter's square: the critter, the land it is shown on, and how often one is put there, in seconds. */
export interface CritterSquareOf {
  kind: Spawnable;
  land: string;
  every: number;
}

export const CRITTER_SQUARES: readonly CritterSquareOf[] = [
  { kind: 'songbird', land: 'mixed-forest', every: 5 },
  { kind: 'squirrel', land: 'broadleaf-forest', every: 5 },
  { kind: 'hare', land: 'meadow', every: 5 },
  { kind: 'fish', land: 'lake', every: 2.5 },
  { kind: 'hawk', land: 'steppe', every: 20 },
  { kind: 'frog', land: 'marsh', every: 4 },
  { kind: 'snake', land: 'marsh', every: 7 },
  { kind: 'partridge', land: 'farmland', every: 5 },
  { kind: 'lark', land: 'meadow', every: 6 },
  { kind: 'grouse', land: 'heath', every: 5 },
  { kind: 'duck', land: 'marsh', every: 5 },
  { kind: 'ptarmigan', land: 'ice', every: 5 },
];

export interface RenderSquare {
  /** The kind of land, by its palette name and class id. */
  land: string;
  id: number;
  /** Its west and north edges, in world units. */
  x: number;
  y: number;
  /** On a critter's square, the critter put in its middle, and how often. */
  critter?: CritterSquareOf;
}

export interface RendersLayout {
  /** A square of every kind of land, by the palette's groups and then its order. */
  lands: RenderSquare[];
  /** A square for each critter, in rows of their own under the lands, with the sky above each row. */
  critters: RenderSquare[];
  /** The world units the layout covers, its north-west corner and its south-east. */
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** The squares of every kind of land and of every critter, so many to a row. */
export function rendersLayout(
  kinds: readonly LandKind[],
  groups: readonly string[],
  columns: number,
): RendersLayout {
  const across = Math.max(1, Math.floor(columns));
  const pitch = SQUARE + GAP;
  const rank = (group: string) => (groups.includes(group) ? groups.indexOf(group) : groups.length);
  const ordered = [...kinds].sort((one, other) => rank(one.group) - rank(other.group) || one.id - other.id);
  const lands = ordered.map((kind, at) => ({
    land: kind.name,
    id: kind.id,
    x: ORIGIN.x + (at % across) * pitch,
    y: ORIGIN.y + GAP + Math.floor(at / across) * pitch,
  }));
  const rows = Math.ceil(ordered.length / across);
  // The critters wrap as the lands do, each row of them with the sky over it a bird circles in.
  const crittersAt = ORIGIN.y + rows * pitch;
  const critterRows = Math.ceil(CRITTER_SQUARES.length / across);
  const critters = CRITTER_SQUARES.map((critter, at) => ({
    land: critter.land,
    id: kinds.find((kind) => kind.name === critter.land)?.id ?? BETWEEN,
    x: ORIGIN.x + (at % across) * pitch,
    y: crittersAt + SKY + GAP + Math.floor(at / across) * (pitch + SKY),
    critter,
  }));
  const wide = Math.min(across, Math.max(ordered.length, critters.length));
  return {
    lands,
    critters,
    from: { x: ORIGIN.x, y: ORIGIN.y },
    to: { x: ORIGIN.x + wide * pitch - GAP, y: crittersAt + critterRows * (pitch + SKY) },
  };
}

/** Every square of a layout, the lands' and the critters'. */
export function squaresOf(layout: RendersLayout): RenderSquare[] {
  return [...layout.lands, ...layout.critters];
}

/** The square a point of the page's world is in, or null between them. */
export function squareAtOf(layout: RendersLayout): (x: number, y: number) => RenderSquare | null {
  const all = squaresOf(layout);
  return (x, y) =>
    all.find((square) => x >= square.x && x < square.x + SQUARE && y >= square.y && y < square.y + SQUARE) ??
    null;
}

/**
 * The class of the ground at a point of the page's world: a square's own, or the open sea between them, which is the
 * ocean's square's own too, and moves no more than it.
 */
export function classAtOf(layout: RendersLayout): (x: number, y: number) => number {
  const squareAt = squareAtOf(layout);
  return (x, y) => squareAt(x, y)?.id ?? BETWEEN;
}

/**
 * The class of the nearest square to a point, for the paint: inside a square its own, and outside it the nearest's,
 * so the painter, which reads the ground about a pixel, never sees a shore at a square's edge and paints none.
 */
export function paintedClassAtOf(layout: RendersLayout): (x: number, y: number) => number {
  const all = squaresOf(layout);
  const fromX = Math.floor(layout.from.x) - 2;
  const fromY = Math.floor(layout.from.y) - 2;
  const wide = Math.ceil(layout.to.x) + 2 - fromX;
  const high = Math.ceil(layout.to.y) + 2 - fromY;
  const away = (square: RenderSquare, x: number, y: number) =>
    Math.hypot(
      Math.max(square.x - x, 0, x - square.x - SQUARE),
      Math.max(square.y - y, 0, y - square.y - SQUARE),
    );
  // Worked out once a world unit, since the painter reads nine of them a pixel.
  const nearest = new Uint8Array(wide * high);
  for (let y = 0; y < high; y += 1) {
    for (let x = 0; x < wide; x += 1) {
      const at = { x: fromX + x + 0.5, y: fromY + y + 0.5 };
      let best: RenderSquare | undefined;
      for (const square of all) {
        if (best === undefined || away(square, at.x, at.y) < away(best, at.x, at.y)) best = square;
      }
      nearest[y * wide + x] = best?.id ?? BETWEEN;
    }
  }
  return (x, y) => {
    const column = Math.floor(x) - fromX;
    const row = Math.floor(y) - fromY;
    if (column < 0 || row < 0 || column >= wide || row >= high) return BETWEEN;
    return nearest[row * wide + column]!;
  };
}

/** The biomes a kind of land is grown in for the page, the one most like the map's middle latitudes first. */
const BIOMES_FIRST = [
  'temperate',
  'oceanic',
  'northern-woods',
  'mediterranean',
  'steppe',
  'savanna',
  'tropical',
  'monsoon',
  'desert-margin',
  'northern-heath',
  'boreal-dense',
  'boreal-open',
  'arctic',
  'highland',
];

/**
 * Which biome grows a square's trees and bushes, by its index among the sprite map's biomes: the first of
 * `BIOMES_FIRST` that grows anything on that kind of land, then any other that does; -1 for land nothing grows on.
 */
export function biomeFor(
  land: string,
  biomes: readonly { name: string }[],
  grows: readonly Record<string, Record<string, number>>[],
): number {
  const growsOn = (at: number) => Object.values(grows[at]?.[land] ?? {}).some((weight) => weight > 0);
  const order = [
    ...BIOMES_FIRST.map((name) => biomes.findIndex((biome) => biome.name === name)),
    ...biomes.map((_biome, at) => at),
  ].filter((at) => at >= 0);
  return order.find(growsOn) ?? -1;
}
