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

/**
 * How high the back and west walls stand above the floor, and how thick every wall is: an imposing little room
 * with a high ceiling, Adam's word of 2026-10-23, at the height he left the preview's slider. The two near
 * walls, south and east, are cut down to a low edge so that they never stand between the camera and the room.
 */
export const WALL_HIGH = 5.5;
const WALL_THICK = 0.3;
const NEAR_WALL_HIGH = 0.25;

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
  wallTop: '#3b3029',
  wallFace: '#5c4b3f',
  wallEnd: '#4a3c32',
  frame: '#2a1d15',
  glass: '#cfe0e6',
  stone: '#6b5a4c',
  firebox: '#1a120d',
  fire: '#e8873a',
  mantel: '#4a3624',
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
  /** Shapes drawn on a face, over it: a window on a wall, a hearth. */
  marks?: Mark[];
}

/** Which face of a box a mark is on, and the shapes of it, each lying in that face. */
export interface Mark {
  face: 'north' | 'south' | 'east' | 'west';
  shapes: { corners: Spot[]; fill: string }[];
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
  colours: { top: string | null; front: string; side: string; marks?: Mark[] },
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

/** A floor's height above the floor, in metres, as the model's height above the table top. */
const aboveFloor = (metres: number): number => metres - TABLE_HIGH;

/**
 * The walls: the back and the west ones standing their full height along the floor's north and west edges, the
 * back one taking the corner between them; the south and east ones cut down to a low edge. The window is in the
 * back wall's face, the hearth in the west wall's, each a hair in front of the face it is on.
 */
export function wallBlocks(desk: DeskTop): { far: Block[]; near: Block[] } {
  const wall = { top: ROOM_COLOURS.wallTop, front: ROOM_COLOURS.wallFace, side: ROOM_COLOURS.wallEnd };
  const floor = aboveFloor(0);
  const high = aboveFloor(WALL_HIGH);
  const low = aboveFloor(NEAR_WALL_HIGH);
  const outer = {
    west: FLOOR.west - WALL_THICK,
    east: FLOOR.east + WALL_THICK,
    south: FLOOR.south + WALL_THICK,
  };

  // The window, tall and narrow, in the middle of the back wall: its frame and its glass.
  const onBack = (east: number, upFromFloor: number): Spot =>
    spotOf(desk, east, FLOOR.north + 0.01, aboveFloor(upFromFloor));
  const pane = (west: number, east: number, low: number, high: number) => [
    onBack(west, low),
    onBack(east, low),
    onBack(east, high),
    onBack(west, high),
  ];
  const windowTop = WALL_HIGH - 0.6;
  const windowFoot = Math.max(0.7, windowTop - 4.2);
  const window: Mark = {
    face: 'south',
    shapes: [
      { corners: pane(-0.8, 0.8, windowFoot, windowTop), fill: ROOM_COLOURS.frame },
      { corners: pane(-0.68, 0.68, windowFoot + 0.1, windowTop - 0.1), fill: ROOM_COLOURS.glass },
      { corners: pane(-0.04, 0.04, windowFoot + 0.1, windowTop - 0.1), fill: ROOM_COLOURS.frame },
    ],
  };

  // The hearth in the west wall: its stone surround, its mantel, the dark of the firebox and the fire in it.
  const onWest = (south: number, upFromFloor: number): Spot =>
    spotOf(desk, FLOOR.west + 0.01, south, aboveFloor(upFromFloor));
  const panel = (north: number, south: number, low: number, high: number) => [
    onWest(north, low),
    onWest(south, low),
    onWest(south, high),
    onWest(north, high),
  ];
  const hearth: Mark = {
    face: 'east',
    shapes: [
      { corners: panel(-1.7, -0.3, 0, 1.6), fill: ROOM_COLOURS.stone },
      { corners: panel(-1.8, -0.2, 1.6, 1.75), fill: ROOM_COLOURS.mantel },
      { corners: panel(-1.35, -0.65, 0, 0.9), fill: ROOM_COLOURS.firebox },
      { corners: [onWest(-1.18, 0), onWest(-0.82, 0), onWest(-1.0, 0.5)], fill: ROOM_COLOURS.fire },
    ],
  };

  const back = blockOf(
    desk,
    {
      west: outer.west,
      east: outer.east,
      north: FLOOR.north - WALL_THICK,
      south: FLOOR.north,
      low: floor,
      high,
    },
    { ...wall, marks: [window] },
  );
  // The west wall is seen by its east face, the one into the room, so that face takes the wall's face colour.
  const west = blockOf(
    desk,
    { west: outer.west, east: FLOOR.west, north: FLOOR.north, south: outer.south, low: floor, high },
    { ...wall, front: ROOM_COLOURS.wallEnd, side: ROOM_COLOURS.wallFace, marks: [hearth] },
  );
  const east = blockOf(
    desk,
    { west: FLOOR.east, east: outer.east, north: FLOOR.north, south: outer.south, low: floor, high: low },
    wall,
  );
  const south = blockOf(
    desk,
    { west: FLOOR.west, east: FLOOR.east, north: FLOOR.south, south: outer.south, low: floor, high: low },
    wall,
  );
  return { far: [back, west], near: [east, south] };
}

/**
 * The room's outermost corners as the camera can see them: the floor's, and the tops of its walls. What the turn
 * is framed by and what looking round stops at.
 */
export function shellOf(desk: DeskTop): Spot[] {
  const { far, near } = wallBlocks(desk);
  const tops = [...far, ...near].flatMap((block) => [
    { x: block.west, y: block.north, up: block.high },
    { x: block.east, y: block.north, up: block.high },
    { x: block.east, y: block.south, up: block.high },
    { x: block.west, y: block.south, up: block.high },
  ]);
  return [...floorOf(desk), ...tops];
}
