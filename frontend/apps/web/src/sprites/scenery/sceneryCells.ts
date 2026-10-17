import { TILE } from '../../geometry/world';
import { classesOfTile, terrainPalette } from '../../geometry/terrainClasses';
import type { TerrainPalette } from '../../geometry/terrainClasses';
import { CELL, NO_STANDS, reachBeyond, scatterCell } from '@villages/world';
import type { ScatteredPoint, SpriteMap, StandChunk } from '@villages/world';

import { spriteMap } from './spriteMap';
import {
  onStandsArrived,
  onStandsFollowed,
  sentStandsOf,
  standsComing,
  standsHeld,
  tileKey,
} from '../../net/stands';
import { Waiting } from './waiting';

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
 *
 * **Nor until its stands are.** They are the gateway's to send, a zoom 7 tile at a time as far as the fog lets
 * them through, so a cell waits for every tile it reads and is told as each comes; see decision 0067. When the
 * fog moves, the gateway sends a tile again with what now gets through, and every cell cut from the old
 * records is cut again. One on the screen keeps its old points until the new ones are ready, and on ground the
 * house had already revealed they are the same points: the gateway sends every stand that could change what
 * grows there.
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

/** One cell's points, and enough about how they were cut to cut them again. */
interface Cut {
  points: ScatteredPoint[];
  /** The records of every tile it read its stands from, by tile, so a tile sent again says whether this is stale. */
  from: Map<number, string>;
  /** Some tile it read has been sent again differently since, and the next ask cuts it again. */
  stale: boolean;
}

const held = new Map<string, Cut>();
/** Cells being cut, so the same one is never cut twice at once. */
const asking = new Set<string>();
/** Cells whose stands have not all come, by the tile they wait on. */
const forStands = new Waiting();
/** Whoever last asked for a cell, to be told when a cell has gone stale and wants cutting again. */
let asker: (() => void) | null = null;
let palette: TerrainPalette | null = null;
/** Null until asked, then the master's sprite map or null for ever if it has none. */
let map: SpriteMap | null = null;
let noMap = false;

const keyOf = (dial: number, spacing: number, cellX: number, cellY: number): string =>
  `${dial}/${spacing}/${cellX}/${cellY}`;

onStandsArrived((tile, stands, layer) => {
  if (layer !== 'biome') {
    return;
  }
  forStands.came(tile);
  let stale = false;
  for (const cut of held.values()) {
    const was = cut.from.get(tile);
    if (was !== undefined && was !== stands.records) {
      cut.stale = true;
      stale = true;
    }
  }
  if (stale) {
    asker?.();
  }
});

onStandsFollowed(() => forStands.keepOnly(standsComing));

/** Everything cut so far is thrown away. For a change that makes every cell wrong: a new master. */
export function forgetScenery(): void {
  held.clear();
  asking.clear();
  forStands.clear();
  palette = null;
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
  /** Cells being cut, whose terrain has not all arrived. */
  waiting: number;
  /** Cells waiting for the gateway to send the stands of a tile they read. */
  waitingOnStands: number;
  /** Points held across every cell, which is what the scattering costs in memory. */
  points: number;
  /** Tiles of stands the gateway sent and the page holds, and the stands in them. */
  tiles: number;
  stands: number;
  /** Tiles of the ruins the gateway sent and the page holds, and the ruined towns in them. */
  ruins: { tiles: number; stands: number };
}

/** What the last frame actually drew, put here by the layer so the panel has one thing to read. */
let drawn = {
  particles: 0,
  shadows: 0,
  showing: 0,
  cells: 0,
  frameGapMs: 0,
  worstGapMs: 0,
  biome: '',
  moving: 0,
};

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
    points += cell.points.length;
  }
  return {
    held: held.size,
    waiting: asking.size,
    waitingOnStands: forStands.cells,
    points,
    ...standsHeld(),
    ruins: standsHeld('ruins'),
  };
}

/**
 * The points of one cell, or null while its terrain or its stands are still coming.
 *
 * Null is not an error and not emptiness: it means *not yet*, and the caller draws nothing there
 * rather than drawing bare ground that will sprout. `whenReady` is called once the cell can be asked
 * for again, which is the renderer's cue to draw another frame. A cell whose stands have changed since it
 * was cut is not yet too, coming into view: it waits for its new points rather than showing the old ones and
 * changing a moment later. One already on the screen asks `currentPointsOf` instead.
 */
export function pointsOf(
  tilesRoot: string,
  cellX: number,
  cellY: number,
  dial: number,
  spacing: number,
  whenReady: () => void,
): ScatteredPoint[] | null {
  asker = whenReady;
  const key = keyOf(dial, spacing, cellX, cellY);
  const already = held.get(key);
  if (already !== undefined && !already.stale) {
    return already.points;
  }
  if (!asking.has(key)) {
    start(key, tilesRoot, cellX, cellY, dial, spacing, whenReady);
  }
  return null;
}

/**
 * The points a cell already on the screen shows now: the ones it was cut with, and once the stands under it
 * have changed and it has been cut again, the new ones. Never *not yet* for a cell it has cut, because the old
 * points stay until the new are ready, so a wood does not blink while the fog moves. Undefined for a cell no
 * longer kept, which the screen goes on showing as it was.
 */
export function currentPointsOf(
  tilesRoot: string,
  cellX: number,
  cellY: number,
  dial: number,
  spacing: number,
  whenReady: () => void,
): ScatteredPoint[] | undefined {
  asker = whenReady;
  const key = keyOf(dial, spacing, cellX, cellY);
  const cut = held.get(key);
  if (cut?.stale === true && !asking.has(key)) {
    start(key, tilesRoot, cellX, cellY, dial, spacing, whenReady);
  }
  return cut?.points;
}

/** The zoom 7 tiles a cell reads: its own, and any its spacing and the biome's wander reach into. */
function tilesRead(
  known: SpriteMap,
  cellX: number,
  cellY: number,
  spacing: number,
): { x: number; y: number }[] {
  // A cell spaces its points against its neighbours' candidates, so it reads the ground a little way past
  // its own edge, and near a tile's edge that is the next tile over: one, two or four tiles, each with its
  // terrain and its stands. Every candidate is then worked out from the tile it stands on, exactly as the
  // cell that owns it would, which is what keeps the spacing seamless. See experiment 0012.
  const reach = reachBeyond(known, spacing);
  const tileOf = (world: number): number => Math.floor(world / TILE_UNITS);
  const tiles: { x: number; y: number }[] = [];
  for (let y = tileOf(cellY * CELL - reach); y <= tileOf((cellY + 1) * CELL + reach - 1e-6); y += 1) {
    for (let x = tileOf(cellX * CELL - reach); x <= tileOf((cellX + 1) * CELL + reach - 1e-6); x += 1) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/**
 * Whether any tile the cell reads has no stands yet, in which case it waits on each of those and is told as
 * they come. Waiting rather than asking again every frame, because a tile can take a round trip or a pan.
 */
function waitForStands(
  key: string,
  tiles: readonly { x: number; y: number }[],
  whenReady: () => void,
): boolean {
  let missing = false;
  for (const { x, y } of tiles) {
    if (sentStandsOf(x, y) === null) {
      forStands.on(tileKey(x, y), key, whenReady);
      missing = true;
    }
  }
  return missing;
}

function start(
  key: string,
  tilesRoot: string,
  cellX: number,
  cellY: number,
  dial: number,
  spacing: number,
  whenReady: () => void,
): void {
  if (map !== null && waitForStands(key, tilesRead(map, cellX, cellY, spacing), whenReady)) {
    return;
  }
  asking.add(key);
  void cut(tilesRoot, cellX, cellY, dial, spacing, key, whenReady).then((done) => {
    asking.delete(key);
    if (done) {
      whenReady();
    }
  });
}

/** Keeps a cell, making room for it if it is new. */
function remember(key: string, cut: Cut): void {
  if (!held.has(key) && held.size >= REMEMBER) {
    const oldest = held.keys().next();
    if (oldest.done !== true) {
      held.delete(oldest.value);
    }
  }
  held.set(key, cut);
}

/** Cuts a cell. False where a tile's stands had not come, and the cell waits on it instead. */
async function cut(
  tilesRoot: string,
  cellX: number,
  cellY: number,
  dial: number,
  spacing: number,
  key: string,
  whenReady: () => void,
): Promise<boolean> {
  palette ??= await terrainPalette();
  if (map === null && !noMap) {
    map = await spriteMap(tilesRoot, LAYER);
    noMap = map === null;
  }
  if (map === null) {
    // No sprite map, no scenery. The cell is remembered as empty so it is never asked for again.
    remember(key, { points: [], from: new Map(), stale: false });
    return true;
  }
  const known = map;
  const colours = palette;
  const tiles = tilesRead(known, cellX, cellY, spacing);

  const classesOf = new Map<string, Uint8Array | null>();
  await Promise.all(
    tiles.map(async ({ x, y }) => {
      classesOf.set(`${x}/${y}`, await classesOfTile(tilesRoot, FLAT, x, y, colours));
    }),
  );

  // The stands are read once the terrain is in hand, so they are the latest the gateway sent. A tile let go of
  // in the meantime leaves the cell waiting for it again.
  const standsOf = new Map<string, StandChunk>();
  const from = new Map<number, string>();
  for (const { x, y } of tiles) {
    const sent = sentStandsOf(x, y);
    if (sent === null) {
      waitForStands(key, tiles, whenReady);
      return false;
    }
    standsOf.set(`${x}/${y}`, sent.chunk);
    if (y >= 0 && y < 2 ** FLAT) {
      from.set(tileKey(x, y), sent.records);
    }
  }

  const tileOf = (world: number): number => Math.floor(world / TILE_UNITS);
  // A tile that is not there is ocean, which is what the painter reads where a tile is missing. So a
  // cell past the edge of the world is empty rather than absent, and is not asked for again.
  const classAt = (worldX: number, worldY: number): number => {
    const tileX = tileOf(worldX);
    const tileY = tileOf(worldY);
    const classes = classesOf.get(`${tileX}/${tileY}`);
    if (classes === null || classes === undefined) {
      return 0;
    }
    const intoX = Math.floor(worldX) - tileX * TILE_UNITS;
    const intoY = Math.floor(worldY) - tileY * TILE_UNITS;
    return classes[intoY * TILE + intoX] ?? 0;
  };
  const ground = {
    classAt,
    standsOf: (tileX: number, tileY: number): StandChunk => standsOf.get(`${tileX}/${tileY}`) ?? NO_STANDS,
  };

  remember(key, { points: scatterCell(cellX, cellY, dial, ground, known, spacing), from, stale: false });
  return true;
}
