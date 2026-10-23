import type { RuinsMapFile, ScatteredPoint, SpriteMap } from '@villages/world';

import { LAYER } from './cellCutting';
import type { TileRecords } from './cellCutting';
import { ruinTilesAround, tilesRead } from './cellTiles';
import { MOST_CELLS } from './showing';
import { RUINS_TILE, ruinsMap, withRuins } from './ruinsMap';
import { cutInWorker, cuttingIn, forgetCutting } from './sceneryCutter';
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
 *
 * **And the ruins.** A cell is furnished with the pieces of the ruined towns of 1790 whose feet stand in it, and its
 * trees thinned by them (`furnishCell`, decision record 0104), from the `ruins` layer's stands of the tiles under it
 * and the eight cells about it, which it waits for and is cut again for as it does the scenery's.
 */

/** The zoom of the tiles a cell reads, of the terrain and of the stands, which is where a stand tile ends. */
const FLAT = 7;

/**
 * How many cells to keep.
 *
 * As many as the scenery will hold in view at once (`MOST_CELLS`): the woods are built from half a zoom before they
 * arrive, where a wide desktop's view and its ring are seven hundred cells and a 2560 by 1440 one's twelve hundred,
 * and a cell let go of while it is still in view is cut again when it comes back. Four hundred held a screenful at
 * zoom 8 and a ring when the woods were built there.
 */
const REMEMBER = MOST_CELLS;

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
/** Null until asked, then the master's sprite map or null for ever if it has none. */
let map: SpriteMap | null = null;
let noMap = false;
/** The master's ruins map once the sprite map is in hand, or null where it has none; and the kinds the layer draws. */
let ruinsFile: RuinsMapFile | null = null;
let drawnMap: SpriteMap | null = null;

const keyOf = (dial: number, spacing: number, cellX: number, cellY: number): string =>
  `${dial}/${spacing}/${cellX}/${cellY}`;

onStandsArrived((tile, stands, layer) => {
  // The roads and the settlements are no cell's to grow from. See decision records 0115 and 0117.
  if (layer === 'roads' || layer === 'settlements') return;
  const at = layer === 'ruins' ? RUINS_TILE + tile : tile;
  forStands.came(at);
  let stale = false;
  for (const cut of held.values()) {
    const was = cut.from.get(at);
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
  forgetCutting();
  map = null;
  noMap = false;
}

/** What the sprite map says about this world, once it is in hand. Null before that, and null without one. */
export function sceneryMap(): SpriteMap | null {
  return drawnMap;
}

/** Whether this master simply has no sprite map, which is a state and not a failure. */
export function hasNoSpriteMap(): boolean {
  return noMap;
}

export interface SceneryTally {
  /** Cells whose points are worked out and ready to draw. */
  held: number;
  /** Cells being cut, whose terrain has not all arrived or whose points have not come back from the worker. */
  waiting: number;
  /** Where the cells are cut: in the scenery's worker, or on the page where there is none. */
  cutIn: 'in the worker' | 'on the page';
  /** Cells waiting for the gateway to send the stands of a tile they read. */
  waitingOnStands: number;
  /** Points held across every cell, which is what the scattering costs in memory. */
  points: number;
  /** Tiles of stands the gateway sent and the page holds, and the stands in them. */
  tiles: number;
  stands: number;
  /** Tiles of the ruins the gateway sent and the page holds, and the ruined towns in them. */
  ruins: { tiles: number; stands: number };
  /** The roads' tiles held, and the pieces in them. */
  roads: { tiles: number; stands: number };
  /** The settlements' tiles held, and the records in them: a settlement once in every tile its circle touches. */
  settlements: { tiles: number; stands: number };
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
    cutIn: cuttingIn(),
    waitingOnStands: forStands.cells,
    points,
    ...standsHeld(),
    ruins: standsHeld('ruins'),
    roads: standsHeld('roads'),
    settlements: standsHeld('settlements'),
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

/**
 * Whether any tile the cell reads has no stands yet, in which case it waits on each of those and is told as
 * they come. Waiting rather than asking again every frame, because a tile can take a round trip or a pan.
 */
function waitForStands(
  key: string,
  tiles: readonly { x: number; y: number }[],
  whenReady: () => void,
  layer: 'biome' | 'ruins' = 'biome',
): boolean {
  let missing = false;
  for (const { x, y } of tiles) {
    if (sentStandsOf(x, y, layer) === null) {
      forStands.on((layer === 'ruins' ? RUINS_TILE : 0) + tileKey(x, y), key, whenReady);
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
  if (map !== null) {
    const trees = waitForStands(key, tilesRead(map, cellX, cellY, spacing), whenReady);
    const ruins = ruinsFile !== null && waitForStands(key, ruinTilesAround(cellX, cellY), whenReady, 'ruins');
    if (trees || ruins) {
      return;
    }
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

/**
 * Cuts a cell, in the scenery's worker where there is one (`sceneryCutter.ts`), from the records of the stands under it
 * as they are now. False where a tile's stands had not come, and the cell waits on it instead. Stands that came while
 * it was being cut leave it stale, to be cut again when next asked.
 */
async function cut(
  tilesRoot: string,
  cellX: number,
  cellY: number,
  dial: number,
  spacing: number,
  key: string,
  whenReady: () => void,
): Promise<boolean> {
  if (map === null && !noMap) {
    map = await spriteMap(tilesRoot, LAYER);
    noMap = map === null;
    ruinsFile = map === null ? null : await ruinsMap(tilesRoot);
    drawnMap = map === null ? null : withRuins(map, ruinsFile);
  }
  if (map === null) {
    // No sprite map, no scenery. The cell is remembered as empty so it is never asked for again.
    remember(key, { points: [], from: new Map(), stale: false });
    return true;
  }
  const tiles = tilesRead(map, cellX, cellY, spacing);
  const ruinTiles = ruinsFile === null ? [] : ruinTilesAround(cellX, cellY);

  // A tile let go of since the cell was asked for leaves it waiting for it again.
  const read = (
    layer: 'biome' | 'ruins',
    from: readonly { x: number; y: number }[],
  ): TileRecords[] | null => {
    const records: TileRecords[] = [];
    for (const { x, y } of from) {
      const sent = sentStandsOf(x, y, layer);
      if (sent === null) return null;
      records.push({ x, y, records: sent.records });
    }
    return records;
  };
  const stands = read('biome', tiles);
  const ruins = read('ruins', ruinTiles);
  if (stands === null || ruins === null) {
    waitForStands(key, tiles, whenReady);
    if (ruinsFile !== null) waitForStands(key, ruinTiles, whenReady, 'ruins');
    return false;
  }
  const points = await cutInWorker({ tilesRoot, cellX, cellY, dial, spacing, stands, ruins });

  const from = new Map<number, string>();
  let stale = false;
  for (const [layer, list] of [
    ['biome', stands],
    ['ruins', ruins],
  ] as const) {
    for (const { x, y, records } of list) {
      if (y >= 0 && y < 2 ** FLAT) from.set((layer === 'ruins' ? RUINS_TILE : 0) + tileKey(x, y), records);
      if (sentStandsOf(x, y, layer)?.records !== records) stale = true;
    }
  }
  remember(key, { points, from, stale });
  return true;
}
