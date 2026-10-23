import type { DeskTop } from '../desk/deskTop';
import { drawnPoint } from '../map/sheet';

import { project } from './camera';
import type { Point, RoomCamera } from './camera';
import { ROOM_COLOURS, floorOf, tileLines } from './model';

/**
 * The room drawn through a camera, as the inside of an SVG laid in window pixels: the floor and its tiles, so
 * far. Made afresh each time the camera moves, because it is a handful of shapes and the camera moves them
 * all. `id` keeps the clipping of one drawing from being found by another on the same page.
 */
export function roomMarkup(desk: DeskTop, camera: RoomCamera, pitch: number, id: string): string {
  const at = (point: Point): string => {
    const drawn = drawnPoint(project(camera, point), pitch);
    return `${drawn.x.toFixed(1)},${drawn.y.toFixed(1)}`;
  };
  const floor = floorOf(desk).map(at).join(' ');
  const tiles = tileLines(desk)
    .map(([from, to]) => `M${at(from)}L${at(to)}`)
    .join('');
  return (
    `<clipPath id="${id}-floor"><polygon points="${floor}"/></clipPath>` +
    `<polygon points="${floor}" fill="${ROOM_COLOURS.floor}"/>` +
    `<path d="${tiles}" stroke="${ROOM_COLOURS.tileLine}" stroke-width="1.1" opacity="0.8" fill="none" clip-path="url(#${id}-floor)"/>`
  );
}
