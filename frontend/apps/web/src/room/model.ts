import { DESK_ASPECT } from '../desk/deskTop';
import type { DeskTop } from '../desk/deskTop';

import type { Point } from './camera';

/**
 * The room, measured: what is in it and where, in metres from the middle of the table, east and south. The
 * table is the desk the map lies on, so a metre is worth the desk's width on the screen over the table's.
 * Everything here is drawn through the room's camera, `camera.ts`; see `docs/plans/room.md` for the
 * measurements and why they are what they are.
 */

/** The table top, which is the desk: as wide as a big map table, and the desk's shape. */
export const TABLE_WIDE = 2.4;

/** The floor's edges, in metres from the table's middle: the table a little forward of the room's middle. */
const FLOOR = { west: -3.9, east: 3.9, north: -3.6, south: 3.2 };

/** How wide a floor tile is. */
export const TILE = 0.5;

/** The colours, flat, because the shapes are what is being judged. */
export const BEYOND = '#211a16';
const FLOOR_COLOUR = '#8a6640';
const TILE_LINE = '#4a3220';

export const ROOM_COLOURS = { beyond: BEYOND, floor: FLOOR_COLOUR, tileLine: TILE_LINE };

/** A point of the room, in metres east and south of the table's middle, in the scene's own pixels. */
export function sceneOf(desk: DeskTop, east: number, south: number): Point {
  const metre = desk.width / TABLE_WIDE;
  return { x: desk.left + desk.width / 2 + east * metre, y: desk.top + desk.height / 2 + south * metre };
}

/** The floor's corners in the scene's pixels, north-west first and on round clockwise. */
export function floorOf(desk: DeskTop): Point[] {
  return [
    sceneOf(desk, FLOOR.west, FLOOR.north),
    sceneOf(desk, FLOOR.east, FLOOR.north),
    sceneOf(desk, FLOOR.east, FLOOR.south),
    sceneOf(desk, FLOOR.west, FLOOR.south),
  ];
}

/**
 * The lines between the floor's tiles, each its two ends in the scene's pixels: a tile's corner under the
 * table's middle, and the lines running the whole floor east and west, and north and south.
 */
export function tileLines(desk: DeskTop): [Point, Point][] {
  const lines: [Point, Point][] = [];
  for (let east = Math.ceil(FLOOR.west / TILE) * TILE; east < FLOOR.east; east += TILE) {
    if (east > FLOOR.west) {
      lines.push([sceneOf(desk, east, FLOOR.north), sceneOf(desk, east, FLOOR.south)]);
    }
  }
  for (let south = Math.ceil(FLOOR.north / TILE) * TILE; south < FLOOR.south; south += TILE) {
    if (south > FLOOR.north) {
      lines.push([sceneOf(desk, FLOOR.west, south), sceneOf(desk, FLOOR.east, south)]);
    }
  }
  return lines;
}

/** The table top's corners in the scene's pixels, which are the desk's. */
export function tableOf(desk: DeskTop): Point[] {
  const half = { across: TABLE_WIDE / 2, deep: TABLE_WIDE / DESK_ASPECT / 2 };
  return [
    sceneOf(desk, -half.across, -half.deep),
    sceneOf(desk, half.across, -half.deep),
    sceneOf(desk, half.across, half.deep),
    sceneOf(desk, -half.across, half.deep),
  ];
}
