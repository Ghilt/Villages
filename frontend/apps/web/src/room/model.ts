import { DESK_ASPECT } from '../desk/deskTop';
import type { DeskTop } from '../desk/deskTop';

import type { Point } from './camera';

/**
 * The room, measured: what is in it and where, in metres from the middle of the table, east and south, and up
 * from the table top, where the map lies. The table is the desk the map lies on, so a metre is worth the desk's
 * width on the screen over the table's. Everything here is drawn through the room's camera, `camera.ts`; see
 * `docs/plans/room.md` for the measurements and why they are what they are.
 */

/** The table top, which is the desk: as wide as a big map table, and the desk's shape. */
export const TABLE_WIDE = 2.4;
const TABLE_DEEP = TABLE_WIDE / DESK_ASPECT;

/** How high the table top stands above the floor, which is how far the floor is below the map. */
export const TABLE_HIGH = 0.8;

/** How thick the table top is, and how thick its legs, and how far in from its corners they stand. */
const SLAB = 0.08;
const LEG = 0.1;
const LEG_IN = 0.06;

/** The floor's edges, in metres from the table's middle: the table a little forward of the room's middle. */
const FLOOR = { west: -3.9, east: 3.9, north: -3.6, south: 3.2 };

/** How wide a floor tile is. */
export const TILE = 0.5;

/** The colours, flat, because the shapes are what is being judged. */
export const BEYOND = '#211a16';
export const ROOM_COLOURS = {
  beyond: BEYOND,
  floor: '#8a6640',
  tileLine: '#4a3220',
  edge: '#1c140f',
  tableTop: '#5c3f28',
  slabFront: '#3f2917',
  slabSide: '#34210f',
  legFront: '#36230f',
  legSide: '#2b1b0c',
};

/** A point of the model in the scene's own pixels, and how many of them it stands above the table top. */
export interface Spot extends Point {
  up: number;
}

/**
 * A box of the model, upright and square to the room: its four sides in the scene's pixels, how high its foot
 * and its top stand above the table top in the same pixels, and its colours. A box whose top is the table top
 * the page already draws leaves its own top undrawn.
 */
export interface Block {
  west: number;
  east: number;
  north: number;
  south: number;
  low: number;
  high: number;
  top: string | null;
  front: string;
  side: string;
}

/** How many of the scene's pixels a metre is. */
export function metreOf(desk: DeskTop): number {
  return desk.width / TABLE_WIDE;
}

/** A point of the room, in metres east and south of the table's middle, in the scene's own pixels. */
export function sceneOf(desk: DeskTop, east: number, south: number): Point {
  const metre = metreOf(desk);
  return { x: desk.left + desk.width / 2 + east * metre, y: desk.top + desk.height / 2 + south * metre };
}

/** A point of the room, in metres east, south and up, as a spot in the scene's pixels. */
function spotOf(desk: DeskTop, east: number, south: number, up: number): Spot {
  return { ...sceneOf(desk, east, south), up: up * metreOf(desk) };
}

/** The floor's corners, a table's height below the map, north-west first and on round clockwise. */
export function floorOf(desk: DeskTop): Spot[] {
  return [
    spotOf(desk, FLOOR.west, FLOOR.north, -TABLE_HIGH),
    spotOf(desk, FLOOR.east, FLOOR.north, -TABLE_HIGH),
    spotOf(desk, FLOOR.east, FLOOR.south, -TABLE_HIGH),
    spotOf(desk, FLOOR.west, FLOOR.south, -TABLE_HIGH),
  ];
}

/**
 * The lines between the floor's tiles, each its two ends: a tile's corner under the table's middle, and the
 * lines running the whole floor east and west, and north and south.
 */
export function tileLines(desk: DeskTop): [Spot, Spot][] {
  const lines: [Spot, Spot][] = [];
  const at = (east: number, south: number) => spotOf(desk, east, south, -TABLE_HIGH);
  for (let east = Math.ceil(FLOOR.west / TILE) * TILE; east < FLOOR.east; east += TILE) {
    if (east > FLOOR.west) {
      lines.push([at(east, FLOOR.north), at(east, FLOOR.south)]);
    }
  }
  for (let south = Math.ceil(FLOOR.north / TILE) * TILE; south < FLOOR.south; south += TILE) {
    if (south > FLOOR.north) {
      lines.push([at(FLOOR.west, south), at(FLOOR.east, south)]);
    }
  }
  return lines;
}

/** The table top's corners in the scene's pixels, which are the desk's. */
export function tableOf(desk: DeskTop): Point[] {
  const half = { across: TABLE_WIDE / 2, deep: TABLE_DEEP / 2 };
  return [
    sceneOf(desk, -half.across, -half.deep),
    sceneOf(desk, half.across, -half.deep),
    sceneOf(desk, half.across, half.deep),
    sceneOf(desk, -half.across, half.deep),
  ];
}

/** A box given in metres from the table's middle, in the scene's pixels. */
function blockOf(
  desk: DeskTop,
  metres: { west: number; east: number; north: number; south: number; low: number; high: number },
  colours: { top: string | null; front: string; side: string },
): Block {
  const metre = metreOf(desk);
  const nw = sceneOf(desk, metres.west, metres.north);
  const se = sceneOf(desk, metres.east, metres.south);
  return {
    west: nw.x,
    east: se.x,
    north: nw.y,
    south: se.y,
    low: metres.low * metre,
    high: metres.high * metre,
    ...colours,
  };
}

/**
 * The table, crudely: its top's thickness under the desk the page draws, and four square legs down to the floor.
 * The top is the desk itself, so the slab leaves its top undrawn.
 */
export function tableBlocks(desk: DeskTop): Block[] {
  const half = { across: TABLE_WIDE / 2, deep: TABLE_DEEP / 2 };
  const leg = { top: null, front: ROOM_COLOURS.legFront, side: ROOM_COLOURS.legSide };
  const legs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([across = 0, deep = 0]) => {
    const east = across * (half.across - LEG_IN) - (across > 0 ? LEG : 0);
    const south = deep * (half.deep - LEG_IN) - (deep > 0 ? LEG : 0);
    return blockOf(
      desk,
      { west: east, east: east + LEG, north: south, south: south + LEG, low: -TABLE_HIGH, high: -SLAB },
      leg,
    );
  });
  const slab = blockOf(
    desk,
    { west: -half.across, east: half.across, north: -half.deep, south: half.deep, low: -SLAB, high: 0 },
    { top: null, front: ROOM_COLOURS.slabFront, side: ROOM_COLOURS.slabSide },
  );
  return [...legs, slab];
}
