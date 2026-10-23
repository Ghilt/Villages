import type { DeskTop } from '../desk/deskTop';
import { drawnPoint, leanOf } from '../map/sheet';
import type { Viewport } from '../map/sheet';

/**
 * The room's camera: the one the map's square on the table and the room round it are both drawn through.
 *
 * It is parallel, as the map's camera is, and it does three things to a point of the table top about a point of
 * the window: it turns it, as the map's ground grid is turned; draws it back, smaller; and tips it, squashing
 * south by the cosine of the tip. A point standing above the table top is lifted by the sine of the tip as
 * well. At rest it does nothing at all, so the map is handed back exactly as it was left. Pure, so the rules
 * that must hold of it are tested rather than looked for. See `docs/plans/room.md`.
 */

/** A point of the window, or of the scene laid out in it, in pixels. */
export interface Point {
  x: number;
  y: number;
}

export interface RoomCamera {
  /** How much smaller everything is drawn: one at the floor. */
  scale: number;
  /** The point of the window everything is drawn back, turned and tipped about. */
  about: Point;
  /** How far the room is turned, in degrees, clockwise on the window: the map's ground grid's own turn. */
  turn: number;
  /** How far it is tipped back, in degrees. */
  tip: number;
}

/** The table top's plane through a camera, as a 2D matrix about its point: `x' = a x + c y`, `y' = b x + d y`. */
export interface Plane {
  a: number;
  b: number;
  c: number;
  d: number;
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Turned, then drawn back, then squashed down by the tip. */
export function planeOf(camera: RoomCamera): Plane {
  const turn = radians(camera.turn);
  const lean = leanOf(camera.tip);
  const { scale } = camera;
  return {
    a: scale * Math.cos(turn),
    b: scale * Math.sin(turn) * lean,
    c: -scale * Math.sin(turn),
    d: scale * Math.cos(turn) * lean,
  };
}

/** How far a point is lifted up the window for every pixel it stands above the table top. */
export function liftOf(camera: RoomCamera): number {
  return camera.scale * Math.sin(radians(camera.tip));
}

/** Where a point of the table top, or `up` pixels above it, is drawn on the window. */
export function project(camera: RoomCamera, point: Point, up = 0): Point {
  const plane = planeOf(camera);
  const x = point.x - camera.about.x;
  const y = point.y - camera.about.y;
  return {
    x: camera.about.x + plane.a * x + plane.c * y,
    y: camera.about.y + plane.b * x + plane.d * y - up * liftOf(camera),
  };
}

/** The point of the table top a point of the window shows: `project` backwards, for the pointer. */
export function unproject(camera: RoomCamera, point: Point): Point {
  const plane = planeOf(camera);
  const det = plane.a * plane.d - plane.b * plane.c;
  const x = point.x - camera.about.x;
  const y = point.y - camera.about.y;
  return {
    x: camera.about.x + (plane.d * x - plane.c * y) / det,
    y: camera.about.y + (plane.a * y - plane.b * x) / det,
  };
}

/**
 * How far everything on the table top is shifted by the point it is drawn about: a point is drawn at `M q +
 * (1 - M) about`, so this is the second half, and at rest it is nothing wherever the point is.
 */
export function offsetOf(camera: RoomCamera): Point {
  const plane = planeOf(camera);
  const { x, y } = camera.about;
  return { x: x - (plane.a * x + plane.c * y), y: y - (plane.b * x + plane.d * y) };
}

/**
 * How far the point has to move for everything drawn on the table top to move `by`, which is how a drag
 * looks round the room: `(1 - M)` run backwards. Null at rest, where moving the point moves nothing.
 */
export function lookBy(camera: RoomCamera, by: Point): Point | null {
  const plane = planeOf(camera);
  const p = 1 - plane.a;
  const q = -plane.c;
  const r = -plane.b;
  const s = 1 - plane.d;
  const det = p * s - q * r;
  if (Math.abs(det) < 1e-9) {
    return null;
  }
  return { x: (s * by.x - q * by.y) / det, y: (p * by.y - r * by.x) / det };
}

/**
 * The scene drawn through the camera, as CSS: the scene is laid out in the flat window of the map's own tip,
 * `pitch`, and drawn on the real one squashed by it, so the matrix is carried from the one to the other.
 * At a pitch of nothing, which is the map's at the floor, it is the plane as it is.
 */
export function cssOf(camera: RoomCamera, pitch: number): { origin: string; transform: string } {
  const plane = planeOf(camera);
  const lean = leanOf(pitch);
  const origin = drawnPoint(camera.about, pitch);
  return {
    origin: `${origin.x}px ${origin.y}px`,
    transform: `matrix(${plane.a}, ${plane.b * lean}, ${plane.c / lean}, ${plane.d}, 0, 0)`,
  };
}

/** The smallest rectangle round some points. */
export function boxOf(points: readonly Point[]): DeskTop {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

/** Whether a four-cornered shape, its corners in order round it, covers every corner of the window. */
export function coversWindow(corners: readonly Point[], viewport: Viewport): boolean {
  const windowCorners = [
    { x: 0, y: 0 },
    { x: viewport.width, y: 0 },
    { x: viewport.width, y: viewport.height },
    { x: 0, y: viewport.height },
  ];
  return windowCorners.every((point) => {
    let sign = 0;
    for (let index = 0; index < corners.length; index += 1) {
      const from = corners[index];
      const to = corners[(index + 1) % corners.length];
      if (from === undefined || to === undefined) {
        return false;
      }
      const cross = (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
      if (Math.abs(cross) < 1e-9) {
        continue;
      }
      if (sign === 0) {
        sign = Math.sign(cross);
      } else if (Math.sign(cross) !== sign) {
        return false;
      }
    }
    return true;
  });
}
