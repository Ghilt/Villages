import type * as maplibregl from 'maplibre-gl';

import { cameraStore } from '../map/camera';
import { CAMERA } from '../map/mapConfig';
import { flatWindow, floorZoom } from '../map/sheet';
import type { Sheet, Viewport } from '../map/sheet';
import { tiltAt } from '../map/tilt';

import { sheetAtFloor } from './roomBox';
import type { Most } from './roomBox';

/**
 * The map's camera as the room's arithmetic wants it: the window as the flat world sees it, the camera the
 * room is seen from, and how far the room tips back. Everything about the desk and the room is laid out as
 * if the camera looked straight down, in a window taller by one over the lean, and squashed only as it is
 * drawn. See decision record 0060 and experiment 0009.
 */

/** The window as the flat world sees it now, at the camera's own tip. */
export function flatViewOf(map: maplibregl.Map): Viewport {
  const container = map.getContainer();
  return flatWindow({ width: container.clientWidth, height: container.clientHeight }, map.getPitch());
}

/** The camera as `sheetOnScreen` wants it: looking straight down, in the flat window. */
export function seen(map: maplibregl.Map): {
  center: { lng: number; lat: number };
  zoom: number;
  width: number;
  height: number;
} {
  const centre = map.getCenter();
  return { center: { lng: centre.lng, lat: centre.lat }, zoom: map.getZoom(), ...flatViewOf(map) };
}

/**
 * How far the room turns and tips once the pull is spent: as far as the map's ground grid is turned, and as far
 * as the map tips at its closest, both read as they are now, so the debug panel's levers move the room too.
 */
export function roomMost(): Most {
  return { turn: cameraStore.get().latticeTurn, tip: tiltAt(CAMERA.maxZoom) };
}

/**
 * The room's own camera: at the floor over the world's centre, and the window as the flat world sees it
 * there. Worked out rather than read off the map, because the dive in asks for it from the closest zoom.
 */
export function atTheFloor(map: maplibregl.Map): {
  view: Viewport;
  pitch: number;
  sheet: Sheet;
  zoom: number;
} {
  const container = map.getContainer();
  const real = { width: container.clientWidth, height: container.clientHeight };
  const pitch = tiltAt(floorZoom(real));
  const view = flatWindow(real, pitch);
  return { view, pitch, sheet: sheetAtFloor(view), zoom: floorZoom(view) };
}
