import { CELL, reachBeyond } from '@villages/world';
import type { SpriteMap } from '@villages/world';

import { TILE } from '../../geometry/world';

/**
 * Which zoom 7 tiles a scenery cell reads, each `{x, y}`: the tiles of its scenery's stands and terrain, and the tiles
 * of the ruins that may stand in it or near enough to clear its trees. Apart from `sceneryCells.ts`, which keeps the
 * cells, so that file stays a cache. See decision records 0067 and 0104.
 */

/** How many world units a zoom 7 tile covers: 256 pixels, one to a unit. */
const TILE_UNITS = TILE;

/** The zoom 7 tiles a cell reads: its own, and any its spacing and the biome's wander reach into. */
export function tilesRead(
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

/** The zoom 7 tiles whose ruins a cell reads: those under it and the eight cells about it, whose ruins may clear its trees. */
export function ruinTilesAround(
  cellX: number,
  cellY: number,
  tileUnits = TILE_UNITS,
): { x: number; y: number }[] {
  const tileOf = (world: number): number => Math.floor(world / tileUnits);
  const tiles: { x: number; y: number }[] = [];
  for (let y = tileOf((cellY - 1) * CELL); y <= tileOf((cellY + 2) * CELL - 1e-6); y += 1) {
    for (let x = tileOf((cellX - 1) * CELL); x <= tileOf((cellX + 2) * CELL - 1e-6); x += 1) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}
