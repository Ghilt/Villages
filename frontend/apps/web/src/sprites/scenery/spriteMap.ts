import { growingTable } from '@villages/world';
import type { BoundaryRule, Growing, Kind, Palette } from '@villages/world';
import { NO_STANDS, decodeStands } from '@villages/world';
import type { StandChunk } from '@villages/world';

import { TILE } from '../../map/painterlyMessages';
import { paintFile } from '../../map/terrainClasses';

/**
 * Reading the sprite map a master was generated with: what kind of place the ground is, and where the
 * scenery clumps.
 *
 * The scenery itself is not in here and never will be. Every pine is still a pure function of the world
 * space point it grows on, hashed with `hash2`, stored nowhere - decision record 0052, unchanged. What
 * this adds is what that function is allowed to ask: the **biome** of the ground, which says what may
 * grow and how commonly, and the **stands**, which say where it clumps. Both are generated offline by
 * `npm run world:sprites` because both need to see more of the world at once than a browser ever holds.
 *
 * **A master with no sprite map grows nothing.** That is the rule rather than a failure: the reader
 * answers `null` for ever after one missing manifest, the scatter draws nothing, and the map is a map.
 *
 * Modelled on `terrainClasses.ts`, including its two habits worth keeping: one memoised promise per
 * thing that never changes, and an error that names the command to run.
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

const maps = new Map<string, Promise<SpriteMap | null>>();

/**
 * The sprite map for a master, or null where there is none.
 *
 * Kept per tiles root rather than globally, because switching master reloads the page today but will
 * not always, and a biome raster belonging to the wrong world is worse than none.
 */
export function spriteMap(tilesRoot: string, layer = 'biome'): Promise<SpriteMap | null> {
  const key = `${tilesRoot}/${layer}`;
  let already = maps.get(key);
  if (already === undefined) {
    already = load(tilesRoot, layer);
    maps.set(key, already);
  }
  return already;
}

/** Everything read is thrown away. For a change that makes all of it wrong: a regenerated sprite map. */
export function forgetSpriteMap(): void {
  maps.clear();
  chunks.clear();
  asking.clear();
}

async function load(tilesRoot: string, layer: string): Promise<SpriteMap | null> {
  const root = `${tilesRoot}/sprites/${layer}`;
  let file: SpriteMapFile;
  try {
    const response = await fetch(`${root}/map.json`);
    if (!response.ok) {
      return null;
    }
    file = (await response.json()) as SpriteMapFile;
  } catch {
    return null;
  }

  const biomeOf = await readBiomes(`${root}/biomes.png`, file);
  if (biomeOf === null) {
    throw new Error(`${root}/biomes.png is missing; run npm run world:sprites --prefix frontend`);
  }

  // The generator wrote `grows` per biome keyed by terrain class name, so the running totals are built
  // here with the very same function it used - one definition of what a weight means, as terrainClasses
  // is one definition of what a colour means.
  const paint = await paintFile();
  const palette: Palette = paint.palette;
  const growing = growingTable(
    {
      ceiling: file.density.ceiling,
      most: file.density.most,
      region: {
        coarse: { cellsX: 1, cellsY: 1, seed: 0 },
        fine: { cellsX: 1, cellsY: 1, seed: 0 },
        fineWeight: 0,
      },
      boundary: file.boundary,
      kinds: file.kinds,
      biomes: file.biomes.map((biome, index) => ({
        name: biome.name,
        colour: biome.colour,
        where: {},
        stands: { per1000: 0, reach: [0, 0], inside: 0, outside: biome.outside },
        grows: file.grows[index] ?? {},
      })),
    },
    palette,
  );

  return {
    file,
    biomeOf,
    cellUnits: file.world.side / file.world.biomeSide,
    growing,
    kinds: file.kinds,
    colours: file.biomes.map((biome) => biome.colour),
    names: file.biomes.map((biome) => biome.name),
  };
}

/**
 * The biome raster, mapped back from the colours it was written in.
 *
 * Indexed PNG of at most a couple of dozen colours we chose, so a canvas hands the bytes back unchanged
 * and the colour is the biome - exactly the bargain the flat tiles make. Two thousand square is four
 * megapixels, one fetch, kept for the session.
 */
async function readBiomes(url: string, file: SpriteMapFile): Promise<Uint8Array | null> {
  const side = file.world.biomeSide;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(side, side);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) {
      throw new Error('no 2d context to read the biome raster with');
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const { data } = context.getImageData(0, 0, side, side);

    const byColour = new Map<number, number>();
    file.biomes.forEach((biome, index) => {
      byColour.set(Number.parseInt(biome.colour.slice(1), 16), index);
    });
    const fallback = file.biomes.length - 1;

    const biomeOf = new Uint8Array(side * side);
    for (let at = 0; at < biomeOf.length; at += 1) {
      const packed = (data[at * 4]! << 16) | (data[at * 4 + 1]! << 8) | data[at * 4 + 2]!;
      biomeOf[at] = byColour.get(packed) ?? fallback;
    }
    return biomeOf;
  } catch {
    return null;
  }
}

/** Which biome a point of world space is in. The wander that keeps the edge off the grid is the caller's. */
export function biomeAt(map: SpriteMap, worldX: number, worldY: number): number {
  const side = map.file.world.biomeSide;
  const cellX = ((Math.floor(worldX / map.cellUnits) % side) + side) % side;
  const cellY = Math.min(side - 1, Math.max(0, Math.floor(worldY / map.cellUnits)));
  return map.biomeOf[cellY * side + cellX]!;
}

const chunks = new Map<string, StandChunk>();
const asking = new Set<string>();
/**
 * How many stand chunks to keep. One a zoom 7 tile, a few hundred stands each, which is a few kilobytes
 * held per entry - so this is cheap next to the four hundred decoded terrain tiles beside it.
 */
const CHUNK_CAP = 400;

/**
 * One tile's stands, or null while they are still coming.
 *
 * Null means *not yet*, exactly as a missing terrain tile does, and for the same reason: 0022 says
 * ground already on the screen must not change under the player, and a wood thickening when its stands
 * land is that fault. A tile with no chunk on disk has no stands and is remembered as such, because
 * most of the world is sea.
 */
export function standsOfTile(
  tilesRoot: string,
  layer: string,
  tileX: number,
  tileY: number,
  across: number,
  whenReady: () => void,
): StandChunk | null {
  if (tileY < 0 || tileY >= across) {
    return NO_STANDS;
  }
  const wrapped = ((tileX % across) + across) % across;
  const key = `${tilesRoot}/${layer}/${wrapped}/${tileY}`;
  const held = chunks.get(key);
  if (held !== undefined) {
    return held;
  }
  if (asking.has(key)) {
    return null;
  }

  asking.add(key);
  void (async () => {
    let chunk: StandChunk = NO_STANDS;
    try {
      const response = await fetch(`${tilesRoot}/sprites/${layer}/stands/${wrapped}/${tileY}.bin`);
      if (response.ok) {
        chunk = decodeStands(new Uint8Array(await response.arrayBuffer()), wrapped, tileY, TILE);
      }
    } catch {
      chunk = NO_STANDS;
    }
    if (chunks.size >= CHUNK_CAP) {
      const oldest = chunks.keys().next();
      if (oldest.done !== true) {
        chunks.delete(oldest.value);
      }
    }
    chunks.set(key, chunk);
    asking.delete(key);
    whenReady();
  })();
  return null;
}

/** How many stands are held, for the panel. */
export function standsHeld(): { chunks: number; stands: number } {
  let stands = 0;
  for (const chunk of chunks.values()) {
    stands += chunk.count;
  }
  return { chunks: chunks.size, stands };
}
