/**
 * Which zoom 7 tiles' stands a held cell brings, worked out at both ends.
 *
 * The gateway sends the stands of every tile under the cells a page follows, once while a cell is over it, and
 * lets a tile go when none is, so that coming back to it sends it afresh. The page keeps a tile exactly as long,
 * which is what lets it wait for the gateway's answer rather than draw from what it was told before, and what
 * keeps it from waiting for ever on a tile the gateway thinks it already has. `contracts/fixtures/stand-tiles.json`
 * holds the two ends to the same tiles. See decision record 0067.
 */

import { z } from 'zod';

/** How many zoom 7 tiles the world is across, and down: the sprite map's chunks, 256 world units a side. */
export const STAND_TILES = 128;

/**
 * The layers of the sprite map whose stands the gateway sends: the scenery's own, `biome`, the towns of 1790 laid in
 * ruins, `ruins`, a stand a town, and the roads, `roads`, a straight piece a record, which `decodeRoads` reads. A stands
 * frame says which it carries. See decision records 0067, 0103 and 0115.
 */
export const STAND_LAYERS = ['biome', 'ruins', 'roads'] as const;
export type StandLayer = (typeof STAND_LAYERS)[number];

/**
 * The stands of one layer of the sprite map in one zoom 7 tile, `x` across and `y` down, that touch ground the house
 * has revealed: the layer's own records, eight bytes a stand, in base64, which `decodeStands` reads. Sent for every
 * layer of every tile under a held cell from zoom 6 in, and again when the house's sight or the fog switch changes
 * what it lets through; empty when nothing there does. What the fog holds back is left out. See decision records 0067
 * and 0103.
 */
export const standsFrameSchema = z.object({
  type: z.literal('stands'),
  x: z.number().int(),
  y: z.number().int(),
  stands: z.base64(),
  layer: z.enum(STAND_LAYERS),
});

/** Held cells coarser than this are a quarter of a continent and more, and the scenery is never drawn so far out. */
export const STANDS_FROM_ZOOM = 6;

/**
 * How far past a held cell its stands are looked for, in world units: past the ring of scatter cells the page
 * draws round what it shows, each reading its stands a spacing and a wander past its own edge.
 */
export const STAND_TILE_MARGIN = 16;

const TILE_UNITS = 256;
const WORLD_UNITS = STAND_TILES * TILE_UNITS;

/**
 * The tiles a held cell brings, each as `y * STAND_TILES + x`: the tiles the cell lies in and any its margin
 * reaches into. None for a cell coarser than `STANDS_FROM_ZOOM`. Across wraps round the world; down stops at
 * its edges.
 */
export function standTilesUnder(quadkey: string): number[] {
  const zoom = quadkey.length;
  if (zoom < STANDS_FROM_ZOOM) {
    return [];
  }
  let column = 0;
  let row = 0;
  for (const digit of quadkey) {
    const bits = Number(digit);
    column = column * 2 + (bits & 1);
    row = row * 2 + (bits >> 1);
  }
  const side = WORLD_UNITS / 2 ** zoom;
  const firstX = Math.floor((column * side - STAND_TILE_MARGIN) / TILE_UNITS);
  const lastX = Math.ceil(((column + 1) * side + STAND_TILE_MARGIN) / TILE_UNITS) - 1;
  const firstY = Math.max(0, Math.floor((row * side - STAND_TILE_MARGIN) / TILE_UNITS));
  const lastY = Math.min(STAND_TILES - 1, Math.ceil(((row + 1) * side + STAND_TILE_MARGIN) / TILE_UNITS) - 1);

  const tiles: number[] = [];
  for (let y = firstY; y <= lastY; y += 1) {
    for (let x = firstX; x <= lastX; x += 1) {
      tiles.push(y * STAND_TILES + (((x % STAND_TILES) + STAND_TILES) % STAND_TILES));
    }
  }
  return tiles;
}
