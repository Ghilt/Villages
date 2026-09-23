import { TILE } from '../../map/painterlyMessages';
import { classesOfTile, terrainPalette } from '../../map/terrainClasses';
import type { TerrainPalette } from '../../map/terrainClasses';
import { CELL, scatterCell } from '@villages/world';
import type { ScatteredPoint, SpriteMap } from '@villages/world';

import { spriteMap, standsHeld, standsOfTile } from './spriteMap';

/**
 * The scattered points already worked out, and the terrain they were worked out from.
 *
 * A cell is a cache and nothing more - a point's identity is its place on the grid, so throwing this
 * away and filling it again draws the very same world. What it buys is that the hashing and the
 * terrain lookup happen once for a piece of ground rather than once a frame.
 *
 * **A cell contributes nothing until its terrain is in hand.** Decision 0022 is emphatic about why:
 * ground the player is already looking at must not change under them a moment later, because the eye
 * is drawn to a thing that changes far harder than to a thing that merely arrives. Trees sprouting
 * when a tile finishes decoding is that fault exactly, and worse than the one 0022 was about, because
 * a tile at least had a coarser version to stand in for it and bare ground has none. So the ring
 * around the view is built ahead, in the pauses, the way the paint is.
 */

/** The zoom the flat tiles are cut to, where one tile pixel is one world unit. */
const FLAT = 7;
/** How many world units a zoom 7 tile covers: 256 pixels, one to a unit. */
const TILE_UNITS = TILE;

/**
 * How many cells to keep.
 *
 * A screenful at zoom 8 on a wide desktop is about a hundred, and the ring built ahead of it another
 * hundred or so. Four hundred holds that with room to pan back to where you were.
 */
const REMEMBER = 400;

/** The layer of the sprite map the scenery is drawn from. Others will join it; see decision 0054. */
const LAYER = 'biome';

const held = new Map<string, ScatteredPoint[]>();
/** Tiles being fetched, so the same one is never asked for twice at once. */
const asking = new Set<string>();
let palette: TerrainPalette | null = null;
let waiting = 0;
/** Null until asked, then the master's sprite map or null for ever if it has none. */
let map: SpriteMap | null = null;
let noMap = false;

const keyOf = (dial: number, cellX: number, cellY: number): string => `${dial}/${cellX}/${cellY}`;

/** Everything cut so far is thrown away. For a change that makes every cell wrong: a new master. */
export function forgetScenery(): void {
  held.clear();
  asking.clear();
  palette = null;
  waiting = 0;
  map = null;
  noMap = false;
}

/** What the sprite map says about this world, once it is in hand. Null before that, and null without one. */
export function sceneryMap(): SpriteMap | null {
  return map;
}

/** Whether this master simply has no sprite map, which is a state and not a failure. */
export function hasNoSpriteMap(): boolean {
  return noMap;
}

export interface SceneryTally {
  /** Cells whose points are worked out and ready to draw. */
  held: number;
  /** Cells asked for whose terrain or stands have not arrived. */
  waiting: number;
  /** Points held across every cell, which is what the scattering costs in memory. */
  points: number;
  /** Stand chunks held, and the stands in them. */
  chunks: number;
  stands: number;
}

/** What the last frame actually drew, put here by the layer so the panel has one thing to read. */
let drawn = { particles: 0, showing: 0, cells: 0, frameGapMs: 0, worstGapMs: 0, biome: '', moving: 0 };

export type SceneryDrawnTally = typeof drawn & SceneryTally;

export function noteDrawn(now: Partial<typeof drawn>): void {
  drawn = { ...drawn, ...now };
}

/** Everything the panel shows about the scenery, gathered in one call. */
export function sceneryDrawn(): SceneryDrawnTally {
  return { ...drawn, ...sceneryTally() };
}

/** Starts the worst frame gap over again, so one movement can be measured on its own. */
export function forgetWorstGap(): void {
  drawn = { ...drawn, worstGapMs: 0 };
}

export function sceneryTally(): SceneryTally {
  let points = 0;
  for (const cell of held.values()) {
    points += cell.length;
  }
  return { held: held.size, waiting, points, ...standsHeld() };
}

/**
 * The points of one cell, or null while its terrain is still coming.
 *
 * Null is not an error and not emptiness: it means *not yet*, and the caller draws nothing there
 * rather than drawing bare ground that will sprout. `whenReady` is called once the cell can be asked
 * for again, which is the renderer's cue to draw another frame.
 */
export function pointsOf(
  tilesRoot: string,
  cellX: number,
  cellY: number,
  dial: number,
  whenReady: () => void,
): ScatteredPoint[] | null {
  const key = keyOf(dial, cellX, cellY);
  const already = held.get(key);
  if (already !== undefined) {
    return already;
  }
  if (asking.has(key)) {
    return null;
  }

  asking.add(key);
  waiting += 1;
  void cut(tilesRoot, cellX, cellY, dial, key).then(() => {
    asking.delete(key);
    waiting -= 1;
    whenReady();
  });
  return null;
}

async function cut(
  tilesRoot: string,
  cellX: number,
  cellY: number,
  dial: number,
  key: string,
): Promise<void> {
  palette ??= await terrainPalette();
  if (map === null && !noMap) {
    map = await spriteMap(tilesRoot, LAYER);
    noMap = map === null;
  }
  if (map === null) {
    // No sprite map, no scenery. The cell is remembered as empty so it is never asked for again.
    held.set(key, []);
    return;
  }

  // One cell needs exactly one tile and one chunk, because a cell is 32 world units and both are 256.
  const tileX = Math.floor((cellX * CELL) / TILE_UNITS);
  const tileY = Math.floor((cellY * CELL) / TILE_UNITS);
  const classes = await classesOfTile(tilesRoot, FLAT, tileX, tileY, palette);

  // A tile that is not there is ocean, which is what the painter reads where a tile is missing. So a
  // cell past the edge of the world is empty rather than absent, and is not asked for again.
  const classAt =
    classes === null
      ? () => 0
      : (worldX: number, worldY: number) => {
          const intoX = Math.floor(worldX) - tileX * TILE_UNITS;
          const intoY = Math.floor(worldY) - tileY * TILE_UNITS;
          return classes[intoY * TILE + intoX] ?? 0;
        };

  const stands = await new Promise<ReturnType<typeof standsOfTile>>((settle) => {
    const ask = () => {
      const chunk = standsOfTile(tilesRoot, LAYER, tileX, tileY, 2 ** FLAT, ask);
      if (chunk !== null) {
        settle(chunk);
      }
    };
    ask();
  });
  if (stands === null) {
    return;
  }

  if (held.size >= REMEMBER) {
    const oldest = held.keys().next();
    if (oldest.done !== true) {
      held.delete(oldest.value);
    }
  }
  held.set(key, scatterCell(cellX, cellY, dial, classAt, map, stands));
}
