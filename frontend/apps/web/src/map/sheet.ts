import { MAX_MERCATOR_LATITUDE, TILE_SIZE, toScreen, worldSize } from '../sprites/cameraMath';
import type { CameraView, MercatorPoint } from '../sprites/cameraMath';

import { CAMERA } from './mapConfig';

/**
 * The sheet: the world's square seen as one object, and the rule that keeps it in the window.
 *
 * MapLibre's own rule refuses any zoom at which the world is smaller than the window. Ours replaces it:
 * above the fit zoom the window stays inside the world, exactly as before; below it the sheet stays inside
 * the window, shrinking towards a floor, and the desk shows around it. Pure, so that the arithmetic is
 * tested rather than felt for. See docs/adr/0033.
 */

export interface Viewport {
  width: number;
  height: number;
}

/** Where the sheet lies in the window, in CSS pixels from its top left corner. */
export interface Sheet {
  left: number;
  top: number;
  size: number;
}

export interface Camera {
  centre: MercatorPoint;
  zoom: number;
}

/** The corners of what the camera sees, as MapLibre reports them, which run past the world at low zoom. */
export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * How far past the world the camera's centre may stray, in worlds. It has to leave the world for the sheet
 * to reach the corner of a wide window, and past about four the round trip through a latitude loses pixels.
 */
const CENTRE_REACH = 2;

/** A hairline of tolerance, so a sheet exactly the window's size counts as covering it. */
const EDGE = 0.5;

const clamp = (value: number, least: number, most: number): number => Math.min(most, Math.max(least, value));

/** The zoom at which the sheet just covers the window: its side is the window's longer side. Below it the desk shows. */
export function fitZoom(viewport: Viewport): number {
  return Math.log2(Math.max(viewport.width, viewport.height) / TILE_SIZE);
}

/**
 * The lowest zoom: the sheet is `sheetAtFloor` of the window's shorter side, and never smaller than
 * MapLibre's own floor allows.
 */
export function floorZoom(viewport: Viewport, sheetAtFloor: number = CAMERA.sheetAtFloor): number {
  const side = Math.min(viewport.width, viewport.height) * sheetAtFloor;
  if (!(side > 0)) {
    return CAMERA.minZoom;
  }
  return Math.max(CAMERA.minZoom, Math.log2(side / TILE_SIZE));
}

/**
 * Where the camera's centre may be along one axis, in world pixels from the world's edge.
 *
 * When the world is the larger the window stays inside it, which is MapLibre's rule; when the window is
 * the larger the sheet stays inside it. Both are the one interval between `window / 2` and
 * `world - window / 2`, which is a single point where the two are equal, so crossing from one to the other
 * never jumps.
 */
export function clampAxis(centre: number, world: number, window: number): number {
  const nearEdge = window / 2;
  const farEdge = world - window / 2;
  return clamp(centre, Math.min(nearEdge, farEdge), Math.max(nearEdge, farEdge));
}

/** The camera as the rule allows it: the zoom between the floor and the ceiling, the centre on the sheet. */
export function constrainCamera(camera: Camera, viewport: Viewport, maxZoom: number): Camera {
  const zoom = clamp(camera.zoom, floorZoom(viewport), maxZoom);
  const world = worldSize(zoom);
  const x = clampAxis(camera.centre.x * world, world, viewport.width) / world;
  const y = clampAxis(camera.centre.y * world, world, viewport.height) / world;
  return {
    zoom,
    centre: {
      x: clamp(x, -CENTRE_REACH, 1 + CENTRE_REACH),
      y: clamp(y, -CENTRE_REACH, 1 + CENTRE_REACH),
    },
  };
}

export function sheetOnScreen(view: CameraView): Sheet {
  const corner = toScreen({ lng: -180, lat: MAX_MERCATOR_LATITUDE }, view);
  return { left: corner.x, top: corner.y, size: worldSize(view.zoom) };
}

/** Whether the sheet reaches every edge of the window, which is when the desk cannot be seen. */
export function sheetCoversView(sheet: Sheet, viewport: Viewport): boolean {
  return (
    sheet.left <= EDGE &&
    sheet.top <= EDGE &&
    sheet.left + sheet.size >= viewport.width - EDGE &&
    sheet.top + sheet.size >= viewport.height - EDGE
  );
}

/** The part of a view that is on the world, for anything that has to put a place inside it. */
export function clampBoundsToWorld(bounds: Bounds): Bounds {
  return {
    north: clamp(bounds.north, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE),
    south: clamp(bounds.south, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE),
    east: clamp(bounds.east, -180, 180),
    west: clamp(bounds.west, -180, 180),
  };
}
