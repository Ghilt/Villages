/**
 * The projection that keeps a sprite standing on its place while the map moves underneath it.
 *
 * Everything here is a pure function of the camera, so the overlay can be trusted without a browser and
 * tested without pixels. It assumes an unrotated, untilted camera showing the world once, which is what the
 * map is configured to allow. See docs/adr/0014.
 */

import { WORLD_MASTER_WIDTH } from '../map/worldStyle';

/** Beyond this latitude the Mercator projection runs away to infinity, so the poles are clamped. */
export const MAX_MERCATOR_LATITUDE = 85.051129;

/** The map's tile size, and therefore the width of the whole world at zoom zero. */
export const TILE_SIZE = 512;

export interface LngLat {
  lng: number;
  lat: number;
}

/** A place on the unit square that Web Mercator maps the world onto. */
export interface MercatorPoint {
  x: number;
  y: number;
}

/** Pixels from the top left of the map container, in the same units the interface uses. */
export interface ScreenPoint {
  x: number;
  y: number;
}

export interface CameraView {
  center: LngLat;
  zoom: number;
  width: number;
  height: number;
}

/** The width of the entire world in pixels at a given zoom. */
export function worldSize(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

/**
 * How many screen pixels one unit of world space covers.
 *
 * World space is the Web Mercator square the map is drawn on, as many units on a side as the master is
 * wide, so one unit is one pixel of a tile at the zoom the tiles were cut. See decision record 0030.
 * This is the number that lets a thing be given a size on the ground rather than a size on the screen:
 * it doubles with every zoom level, exactly as the terrain under it does.
 */
export function pixelsPerWorldUnit(zoom: number): number {
  return worldSize(zoom) / WORLD_MASTER_WIDTH;
}

/**
 * The zoom at which one world unit is one screen pixel, which is where the doubling is measured from.
 *
 * Six, for a master 32768 across drawn on 512 pixel tiles. Derived rather than written down, because a
 * master of another width moves it.
 */
export const WORLD_UNIT_ZOOM = Math.log2(WORLD_MASTER_WIDTH / TILE_SIZE);

/**
 * Web Mercator with nothing clamped, so it runs on past the edges of the world. That is what the camera's
 * centre needs once it may lie off the sheet; a place on the world is projected with `toMercator`.
 */
export function toMercatorExact({ lng, lat }: LngLat): MercatorPoint {
  const latitudeInRadians = (lat * Math.PI) / 180;
  return {
    x: (lng + 180) / 360,
    y: 0.5 - Math.log(Math.tan(Math.PI / 4 + latitudeInRadians / 2)) / (2 * Math.PI),
  };
}

export function toMercator({ lng, lat }: LngLat): MercatorPoint {
  const clamped = Math.min(MAX_MERCATOR_LATITUDE, Math.max(-MAX_MERCATOR_LATITUDE, lat));
  return toMercatorExact({ lng, lat: clamped });
}

/**
 * The place a point on the Mercator plane stands for. The latitude saturates at the poles for any finite
 * y rather than running away, so what comes back is always a latitude MapLibre accepts.
 */
export function fromMercator({ x, y }: MercatorPoint): LngLat {
  return {
    lng: x * 360 - 180,
    lat: (360 / Math.PI) * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - 90,
  };
}

/**
 * Where a place falls on the screen. The offset is measured from the camera centre rather than from the
 * edge of the world, which keeps the arithmetic small and exact even at the closest zoom.
 */
export function toScreen(place: LngLat, view: CameraView): ScreenPoint {
  const size = worldSize(view.zoom);
  const place2d = toMercator(place);
  // The centre may lie off the world once the sheet can be smaller than the window; clamping it would
  // snap the sheet back. See docs/adr/0033.
  const centre = toMercatorExact(view.center);
  return {
    x: (place2d.x - centre.x) * size + view.width / 2,
    y: (place2d.y - centre.y) * size + view.height / 2,
  };
}

/** Whether a sprite is worth drawing, with a margin so that it does not pop in at the edge. */
export function isWithinView(
  point: ScreenPoint,
  view: { width: number; height: number },
  margin = 96,
): boolean {
  return (
    point.x >= -margin &&
    point.y >= -margin &&
    point.x <= view.width + margin &&
    point.y <= view.height + margin
  );
}
