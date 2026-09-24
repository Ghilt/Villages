import type { BoundaryRule, Growing, Kind } from './biome.ts';

/**
 * What a sprite map is, once it has been read: what kind of place the ground is, and where the scenery
 * clumps.
 *
 * The scenery itself is not in here and never will be. Every pine is still a pure function of the world
 * space point it grows on, hashed with `hash2`, stored nowhere - decision record 0052, unchanged. What
 * this adds is what that function is allowed to ask: the **biome** of the ground, which says what may
 * grow and how commonly, and the **stands**, which say where it clumps.
 *
 * The shape lives here rather than in the app because two things read a sprite map now: the browser,
 * which fetches it a piece at a time, and `bin/renderScenery.ts`, which reads the whole of one off the
 * disk to paint a still. Getting it from a disk or from a network is the difference between them, and it
 * is the only difference: what a sprite map *means* is here, and the scatter that reads it is beside it.
 */

/** The manifest, as `bin/generateSpriteMap.ts` writes it. */
export interface SpriteMapFile {
  master: string;
  layer: string;
  at: string;
  world: { side: number; tileUnits: number; biomeSide: number };
  boundary: BoundaryRule;
  biomes: { name: string; colour: string; outside: number }[];
  kinds: Kind[];
  grows: Record<string, Record<string, number>>[];
  stands: number;
  chunks: number;
  bytes: number;
  density: { worst: string; perUnit: number; ceiling: number; most: number };
}

/** The manifest, the biome raster decoded, and everything derived from them worked out once. */
export interface SpriteMap {
  file: SpriteMapFile;
  /** One biome index per cell of a `biomeSide` square, in world space. */
  biomeOf: Uint8Array;
  /** How many world units one cell of that square covers. */
  cellUnits: number;
  /** Running totals for every (biome, terrain class), indexed `biome * 256 + class`. */
  growing: Growing[];
  kinds: Kind[];
  /** The colour each biome is drawn in, for the debug renderer and the panel. */
  colours: string[];
  names: string[];
}

/** Which biome a point of world space is in. The wander that keeps the edge off the grid is the caller's. */
export function biomeAt(map: SpriteMap, worldX: number, worldY: number): number {
  const side = map.file.world.biomeSide;
  const cellX = ((Math.floor(worldX / map.cellUnits) % side) + side) % side;
  const cellY = Math.min(side - 1, Math.max(0, Math.floor(worldY / map.cellUnits)));
  return map.biomeOf[cellY * side + cellX]!;
}

/**
 * The biome index each colour of the raster stands for, and what an unknown colour falls back to.
 *
 * Both readers decode the same indexed PNG: the browser through a canvas, the still renderer through
 * pngjs. Neither of them decides what a colour means.
 */
export function biomesByColour(file: SpriteMapFile): { byColour: Map<number, number>; fallback: number } {
  const byColour = new Map<number, number>();
  file.biomes.forEach((biome, index) => {
    byColour.set(Number.parseInt(biome.colour.slice(1), 16), index);
  });
  return { byColour, fallback: file.biomes.length - 1 };
}
