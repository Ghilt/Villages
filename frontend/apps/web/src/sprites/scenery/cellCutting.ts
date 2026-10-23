import { NO_STANDS, furnishCell } from '@villages/world';
import type { RuinsMapFile, ScatteredPoint, SpriteMap, StandChunk } from '@villages/world';

import { classesOfTile, terrainPalette } from '../../geometry/terrainClasses';
import type { TerrainPalette } from '../../geometry/terrainClasses';
import { TILE } from '../../geometry/world';
import { standsOfRecords } from '../../net/stands';
import { asScenery, ruinsAround, ruinsMap } from './ruinsMap';
import { spriteMap } from './spriteMap';

/**
 * Cutting one cell of the scenery: the trees `furnishCell` scatters over its ground and the pieces of the ruins whose
 * feet stand in it, from the terrain under it, the stands the gateway sent for the tiles it reads, the sprite map and
 * the ruins map. The same function wherever it runs: in the scenery's worker (`sceneryWorker.ts`), off the page's
 * thread, where scattering a busy wood no longer takes a frame from the page (decision record 0118), and on the page
 * where there is no worker to run it in. `sceneryCells.ts` asks for it through `sceneryCutter.ts`.
 */

/** The zoom the flat tiles are cut to, where one tile pixel is one world unit. */
const FLAT = 7;

/** The layer of the sprite map the scenery is drawn from. Others will join it; see decision 0054. */
export const LAYER = 'biome';

/** What a cell is cut by that is the same for every cell of a master. */
export interface CuttingWorld {
  readonly map: SpriteMap;
  readonly ruins: RuinsMapFile | null;
  readonly palette: TerrainPalette;
}

/** One tile's stands as the gateway sent them, by its records: short text, cheap to hand to a worker. */
export interface TileRecords {
  readonly x: number;
  readonly y: number;
  readonly records: string;
}

/** A cell to cut, with the records of every tile it reads, and of the ruins' tiles about it where there are ruins. */
export interface CutRequest {
  readonly id: number;
  readonly tilesRoot: string;
  readonly cellX: number;
  readonly cellY: number;
  readonly dial: number;
  readonly spacing: number;
  readonly stands: readonly TileRecords[];
  readonly ruins: readonly TileRecords[];
}

export type CutReply =
  | { readonly id: number; readonly points: ScatteredPoint[] }
  | { readonly id: number; readonly error: string };

/** The ground under a cell, by tile: its terrain classes, its stands and the ruins' stands about it. */
export interface CellGround {
  readonly classesOf: (tileX: number, tileY: number) => Uint8Array | null | undefined;
  readonly standsOf: (tileX: number, tileY: number) => StandChunk | undefined;
  readonly ruinsOf: ReadonlyMap<string, StandChunk>;
}

/** The points of one cell, the earliest ranks first. */
export function cutCell(
  world: CuttingWorld,
  cellX: number,
  cellY: number,
  dial: number,
  spacing: number,
  under: CellGround,
): ScatteredPoint[] {
  const tileOf = (at: number): number => Math.floor(at / TILE);
  // A tile that is not there is ocean, which is what the painter reads where a tile is missing. So a
  // cell past the edge of the world is empty rather than absent, and is not asked for again.
  const classAt = (worldX: number, worldY: number): number => {
    const tileX = tileOf(worldX);
    const tileY = tileOf(worldY);
    const classes = under.classesOf(tileX, tileY);
    if (classes === null || classes === undefined) {
      return 0;
    }
    return classes[(Math.floor(worldY) - tileY * TILE) * TILE + Math.floor(worldX) - tileX * TILE] ?? 0;
  };
  const ground = {
    classAt,
    standsOf: (tileX: number, tileY: number): StandChunk => under.standsOf(tileX, tileY) ?? NO_STANDS,
  };
  const around =
    world.ruins === null ? null : ruinsAround(world.ruins, classAt, world.palette.classes, under.ruinsOf);
  const furnished = furnishCell(cellX, cellY, dial, ground, world.map, around, spacing);
  const points = [...furnished.trees, ...furnished.ruins.map((piece) => asScenery(world.map, piece))];
  points.sort((one, other) => one.rank - other.rank);
  return points;
}

/** The master's palette, sprite map and ruins map, fetched once; null where it has no sprite map. */
export async function cuttingWorldOf(tilesRoot: string): Promise<CuttingWorld | null> {
  const [palette, map, ruins] = await Promise.all([
    terrainPalette(),
    spriteMap(tilesRoot, LAYER),
    ruinsMap(tilesRoot),
  ]);
  return map === null ? null : { map, ruins, palette };
}

/** How many tiles of decoded stands a cutting keeps: enough for every tile under the cells it is asked for at once. */
const KEPT_TILES = 512;

/**
 * Cuts cells from requests, as the worker is asked: fetching the terrain under each and decoding its stands from their
 * records, the decoded ones kept by their records so a tile is decoded once while it does not change.
 */
export function createCutting(): { answer: (request: CutRequest) => Promise<CutReply>; forget: () => void } {
  const worlds = new Map<string, Promise<CuttingWorld | null>>();
  const decoded = new Map<string, { records: string; chunk: StandChunk }>();

  const chunkOf = (layer: string, tile: TileRecords): StandChunk => {
    const key = `${layer}/${tile.x}/${tile.y}`;
    const kept = decoded.get(key);
    if (kept?.records === tile.records) return kept.chunk;
    const chunk = standsOfRecords(tile.records, tile.x, tile.y);
    decoded.delete(key);
    if (decoded.size >= KEPT_TILES) decoded.delete(decoded.keys().next().value!);
    decoded.set(key, { records: tile.records, chunk });
    return chunk;
  };

  const answer = async (request: CutRequest): Promise<CutReply> => {
    try {
      let world = worlds.get(request.tilesRoot);
      if (world === undefined) {
        world = cuttingWorldOf(request.tilesRoot);
        worlds.set(request.tilesRoot, world);
      }
      const known = await world;
      if (known === null) return { id: request.id, points: [] };
      const classes = new Map<string, Uint8Array | null>();
      const wanted = new Map([...request.stands, ...request.ruins].map((one) => [`${one.x}/${one.y}`, one]));
      await Promise.all(
        [...wanted].map(async ([key, { x, y }]) => {
          classes.set(key, await classesOfTile(request.tilesRoot, FLAT, x, y, known.palette));
        }),
      );
      const stands = new Map(request.stands.map((one) => [`${one.x}/${one.y}`, chunkOf('biome', one)]));
      const ruinsOf = new Map(request.ruins.map((one) => [`${one.x}/${one.y}`, chunkOf('ruins', one)]));
      const points = cutCell(known, request.cellX, request.cellY, request.dial, request.spacing, {
        classesOf: (x, y) => classes.get(`${x}/${y}`),
        standsOf: (x, y) => stands.get(`${x}/${y}`),
        ruinsOf,
      });
      return { id: request.id, points };
    } catch (problem) {
      return { id: request.id, error: String(problem) };
    }
  };

  return {
    answer,
    forget: () => {
      worlds.clear();
      decoded.clear();
    },
  };
}
