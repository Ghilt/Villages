import { squaredDistances } from '../fog/fogField';

/**
 * WIP SPIKE: the water as the shader reads it, one flat tile at a time.
 *
 * Four bytes a texel. Red is how far the texel lies from the shore, in world units, positive out on the water
 * and negative inland; green is the same for the edge of the deep ocean, positive out over it; blue is whether
 * it is a lake, and alpha whether it is a river. Distances rather than yes and no, for the reason the fog's field is one: filtered between two
 * texels a distance is still very nearly a distance, so the shore is a smooth line at every zoom, and the foam
 * and the shallows can be drawn at so many units from it.
 *
 * A tile is worked out with a margin of its neighbours, so a distance near its edge sees the coast across it
 * and two tiles agree where they meet.
 */

/** The flat tiles' side, in texels. */
export const SIDE = 256;
/** How many texels of each neighbour are read around a tile. Distances further than this may be short. */
export const PAD = 32;

/** What red and green can say, in world units: red from -8 to 56, green from -32 to 32. */
export const SHORE_RANGE = { from: -8, to: 56 } as const;
export const DEEP_RANGE = { from: -32, to: 32 } as const;

/** Land, shallow water (the shelf, the lakes and the rivers), deep water. */
const LAND = 0;
const SHALLOW = 1;
const DEEP = 2;

export interface WaterKinds {
  /** Class ids of the open ocean beyond the shelf. */
  deep: ReadonlySet<number>;
  /** Class ids of the other water: the shelf, the lakes and the rivers. */
  shallow: ReadonlySet<number>;
  lake: ReadonlySet<number>;
  river: ReadonlySet<number>;
}

const FAR = 1e20;

/**
 * The mask for the tile in the middle of `around`, which is its neighbourhood as class ids, three by three from
 * the north-west; a neighbour that is not there (past the top or bottom of the world) repeats the middle tile's
 * edge. `unitsPerTexel` is how many world units a texel of this zoom's tiles covers. Null for a tile with no
 * water in it or near it.
 */
export function maskOf(
  around: readonly (Uint8Array | null)[],
  unitsPerTexel: number,
  kinds: WaterKinds,
): Uint8Array | null {
  const middle = around[4];
  if (middle === undefined || middle === null) {
    return null;
  }
  const wide = SIDE + 2 * PAD;
  const kind = new Uint8Array(wide * wide);
  const lake = new Uint8Array(wide * wide);
  const river = new Uint8Array(wide * wide);
  const counts = [0, 0, 0];
  for (let row = 0; row < wide; row += 1) {
    const y = row - PAD;
    const tileRow = y < 0 ? 0 : y >= SIDE ? 2 : 1;
    for (let column = 0; column < wide; column += 1) {
      const x = column - PAD;
      const tileColumn = x < 0 ? 0 : x >= SIDE ? 2 : 1;
      let tile = around[tileRow * 3 + tileColumn] ?? null;
      let localX = x - (tileColumn - 1) * SIDE;
      let localY = y - (tileRow - 1) * SIDE;
      if (tile === null) {
        tile = middle;
        localX = Math.min(SIDE - 1, Math.max(0, x));
        localY = Math.min(SIDE - 1, Math.max(0, y));
      }
      const id = tile[localY * SIDE + localX]!;
      const at = row * wide + column;
      const which = kinds.deep.has(id) ? DEEP : kinds.shallow.has(id) ? SHALLOW : LAND;
      kind[at] = which;
      lake[at] = kinds.lake.has(id) ? 1 : 0;
      river[at] = kinds.river.has(id) ? 1 : 0;
      counts[which]! += 1;
    }
  }
  if (counts[SHALLOW] === 0 && counts[DEEP] === 0) {
    return null;
  }

  const mask = new Uint8Array(SIDE * SIDE * 4);
  const encode = (value: number, range: { from: number; to: number }) =>
    Math.round(
      ((Math.min(range.to, Math.max(range.from, value)) - range.from) / (range.to - range.from)) * 255,
    );

  // Open ocean all round: no shore and no shelf within reach, which is most of the sea.
  if (counts[DEEP] === wide * wide) {
    const shore = encode(SHORE_RANGE.to, SHORE_RANGE);
    const deep = encode(DEEP_RANGE.to, DEEP_RANGE);
    for (let at = 0; at < SIDE * SIDE; at += 1) {
      mask[at * 4] = shore;
      mask[at * 4 + 1] = deep;
    }
    return mask;
  }

  const shore = signedDistances(kind, wide, (which) => which !== LAND);
  const shelf = signedDistances(kind, wide, (which) => which === DEEP);
  for (let row = 0; row < SIDE; row += 1) {
    for (let column = 0; column < SIDE; column += 1) {
      const from = (row + PAD) * wide + column + PAD;
      const to = (row * SIDE + column) * 4;
      mask[to] = encode(shore[from]! * unitsPerTexel, SHORE_RANGE);
      mask[to + 1] = encode(shelf[from]! * unitsPerTexel, DEEP_RANGE);
      mask[to + 2] = lake[from]! * 255;
      mask[to + 3] = river[from]! * 255;
    }
  }
  return mask;
}

/**
 * How far each texel lies from the edge of a region, in texels, positive inside it: from middle to middle, less
 * half a texel, because the edge lies between two texels.
 */
function signedDistances(kind: Uint8Array, wide: number, inside: (which: number) => boolean): Float32Array {
  const toOutside = new Float64Array(kind.length);
  const toInside = new Float64Array(kind.length);
  let any = false;
  let all = true;
  for (let at = 0; at < kind.length; at += 1) {
    const isIn = inside(kind[at]!);
    toOutside[at] = isIn ? FAR : 0;
    toInside[at] = isIn ? 0 : FAR;
    any ||= isIn;
    all &&= isIn;
  }
  const distances = new Float32Array(kind.length);
  if (!any || all) {
    return distances.fill(any ? 1e6 : -1e6);
  }
  squaredDistances(toOutside, wide, wide);
  squaredDistances(toInside, wide, wide);
  for (let at = 0; at < kind.length; at += 1) {
    distances[at] = inside(kind[at]!) ? Math.sqrt(toOutside[at]!) - 0.5 : 0.5 - Math.sqrt(toInside[at]!);
  }
  return distances;
}
