import type { DeskTop } from '../desk/deskTop';
import { drawnPoint } from '../map/sheet';
import type { Sheet } from '../map/sheet';
import { SEA } from '../map/worldStyle';

import { nearness, project, towards } from './camera';
import type { Direction, RoomCamera } from './camera';
import { ROOM_COLOURS, floorOf, tableBlocks, tableOf, tileLines, wallBlocks } from './model';
import type { Block, Mark, Spot } from './model';

/**
 * The room drawn through a camera, as the inside of an SVG laid in window pixels. Made afresh each time the
 * camera moves, because it is a few dozen shapes and the camera moves them all. `id` keeps the clipping of one
 * drawing from being found by another on the same page.
 *
 * Everything here is below the table top, and the camera looks down, so wherever the table top and something
 * under it are drawn over each other the table top is the nearer. On the page the top is the desk the page
 * already draws, over this; inside the castle there is no desk, so `sheet` asks for the top to be drawn here,
 * last, with a plain square for the map on it.
 */
export function roomMarkup(
  desk: DeskTop,
  camera: RoomCamera,
  pitch: number,
  id: string,
  sheet: Sheet | null = null,
): string {
  const at = (spot: Spot): string => {
    const drawn = drawnPoint(project(camera, spot, spot.up), pitch);
    return `${drawn.x.toFixed(1)},${drawn.y.toFixed(1)}`;
  };
  const polygon = (spots: Spot[], fill: string, edge = ''): string =>
    `<polygon points="${spots.map(at).join(' ')}" fill="${fill}"${edge}/>`;
  const floor = floorOf(desk).map(at).join(' ');
  const tiles = tileLines(desk)
    .map(([from, to]) => `M${at(from)}L${at(to)}`)
    .join('');
  const edge = ` stroke="${ROOM_COLOURS.edge}" stroke-width="0.6" stroke-linejoin="round"`;

  // The faces the camera can see, farthest first, each with whatever is marked on it drawn over it.
  const drawn = (blocks: Block[]): string =>
    blocks
      .flatMap((block) => facesOf(block))
      .filter((face) => towards(camera, face.facing) > 1e-9)
      .map((face) => ({ face, near: nearOf(camera, face.corners) }))
      .sort((one, two) => one.near - two.near)
      .map(
        ({ face }) =>
          polygon(face.corners, face.fill, edge) +
          face.marks
            .flatMap((mark) => mark.shapes.map((shape) => polygon(shape.corners, shape.fill)))
            .join(''),
      )
      .join('');

  // The far walls are behind everything in the room and the near ones in front of it, so the room is drawn in
  // three runs rather than sorted as one: what a box's middle says about its nearness is no use for a wall
  // five metres high beside a table.
  const walls = wallBlocks(desk);
  const faces = drawn(walls.far) + drawn(tableBlocks(desk)) + drawn(walls.near);

  let top = '';
  if (sheet !== null) {
    const lying = (points: { x: number; y: number }[]): Spot[] =>
      points.map((point) => ({ ...point, up: 0 }));
    const map = [
      { x: sheet.left, y: sheet.top },
      { x: sheet.left + sheet.size, y: sheet.top },
      { x: sheet.left + sheet.size, y: sheet.top + sheet.size },
      { x: sheet.left, y: sheet.top + sheet.size },
    ];
    top = polygon(lying(tableOf(desk)), ROOM_COLOURS.tableTop, edge) + polygon(lying(map), SEA);
  }

  return (
    `<clipPath id="${id}-floor"><polygon points="${floor}"/></clipPath>` +
    `<polygon points="${floor}" fill="${ROOM_COLOURS.floor}"/>` +
    `<path d="${tiles}" stroke="${ROOM_COLOURS.tileLine}" stroke-width="1.1" opacity="0.8" fill="none" clip-path="url(#${id}-floor)"/>` +
    faces +
    top
  );
}

interface Face {
  corners: Spot[];
  facing: Direction;
  fill: string;
  marks: Mark[];
}

/** A box's five faces that can ever be seen - its top and its four sides - each with the way it faces. */
function facesOf(block: Block): Face[] {
  const { west, east, north, south, low, high } = block;
  const spot = (x: number, y: number, up: number): Spot => ({ x, y, up });
  const marksOn = (face: Mark['face']): Mark[] => (block.marks ?? []).filter((mark) => mark.face === face);
  const faces: Face[] = [
    {
      corners: [
        spot(west, south, low),
        spot(east, south, low),
        spot(east, south, high),
        spot(west, south, high),
      ],
      facing: { east: 0, south: 1, up: 0 },
      fill: block.front,
      marks: marksOn('south'),
    },
    {
      corners: [
        spot(west, north, low),
        spot(east, north, low),
        spot(east, north, high),
        spot(west, north, high),
      ],
      facing: { east: 0, south: -1, up: 0 },
      fill: block.front,
      marks: marksOn('north'),
    },
    {
      corners: [
        spot(east, north, low),
        spot(east, south, low),
        spot(east, south, high),
        spot(east, north, high),
      ],
      facing: { east: 1, south: 0, up: 0 },
      fill: block.side,
      marks: marksOn('east'),
    },
    {
      corners: [
        spot(west, north, low),
        spot(west, south, low),
        spot(west, south, high),
        spot(west, north, high),
      ],
      facing: { east: -1, south: 0, up: 0 },
      fill: block.side,
      marks: marksOn('west'),
    },
  ];
  if (block.top !== null) {
    faces.push({
      corners: [
        spot(west, north, high),
        spot(east, north, high),
        spot(east, south, high),
        spot(west, south, high),
      ],
      facing: { east: 0, south: 0, up: 1 },
      fill: block.top,
      marks: [],
    });
  }
  return faces;
}

/** How near a face is, by its middle. */
function nearOf(camera: RoomCamera, corners: Spot[]): number {
  const middle = corners.reduce(
    (sum, corner) => ({
      x: sum.x + corner.x / corners.length,
      y: sum.y + corner.y / corners.length,
      up: sum.up + corner.up / corners.length,
    }),
    { x: 0, y: 0, up: 0 },
  );
  return nearness(camera, middle, middle.up);
}
