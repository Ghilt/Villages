/**
 * The projection that keeps a sprite standing on its place while the map moves underneath it.
 *
 * Everything here is a pure function of the camera, so the overlay can be trusted without a browser and
 * tested without pixels. It assumes a camera showing the world once, and carries the turn and the tilt of
 * that camera rather than assuming there is none: see experiment 0008. Flat and north-up is still what a
 * player gets, and is still the arithmetic below when pitch and bearing are zero. See docs/adr/0014.
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
  /**
   * How far the camera has tipped from straight down, in degrees. Zero is the flat map a player gets.
   *
   * It only ever squashes: an orthographic camera foreshortens the axis it leans along and does nothing
   * else, so sixty degrees is a half and the classic two-to-one of an isometric game. See 0008.
   */
  pitch?: number;
  /** Which way is up, in degrees clockwise from north. Zero is north-up, which is what a player gets. */
  bearing?: number;
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
 * How the camera turns and tips the ground: the one place the turn and the squash are worked out.
 *
 * Everything that puts a thing on the ground goes through this and `tiltGround`, the marks, the scenery
 * and the walk over the cells in view alike, so that no two of them can disagree about where a piece of
 * ground is on the screen. Three copies of this arithmetic is how a tree comes to float two pixels off
 * the place a castle beside it stands on, which is the kind of fault that costs an evening to find.
 */
export interface GroundTilt {
  cos: number;
  sin: number;
  /** How much the axis the camera leans along is squashed: the cosine of the pitch. */
  lean: number;
}

export function groundTilt(view: Pick<CameraView, 'pitch' | 'bearing'>): GroundTilt {
  const turn = ((view.bearing ?? 0) * Math.PI) / 180;
  return {
    cos: Math.cos(turn),
    sin: Math.sin(turn),
    lean: Math.cos(((view.pitch ?? 0) * Math.PI) / 180),
  };
}

/**
 * Where an offset on the ground, east and south, lands on the screen, in the same unit it came in.
 *
 * Turn, then squash. Both are multiplies and neither divides, which is the whole reason this stays a
 * function rather than becoming a matrix the map has to hand over: with the field of view collapsed the
 * camera is orthographic, so there is no perspective divide and the projection is linear. A round mark
 * on the ground is an ellipse of the same shape everywhere on the screen, rather than one that grows
 * toward a horizon. See experiment 0008.
 */
export function tiltGround(east: number, south: number, tilt: GroundTilt): ScreenPoint {
  return {
    x: east * tilt.cos + south * tilt.sin,
    y: (south * tilt.cos - east * tilt.sin) * tilt.lean,
  };
}

/** The ground an offset on the screen lands on: `tiltGround` backwards, for the walk over the cells. */
export function untiltGround(x: number, y: number, tilt: GroundTilt): { east: number; south: number } {
  const unsquashed = tilt.lean === 0 ? y : y / tilt.lean;
  return {
    east: x * tilt.cos - unsquashed * tilt.sin,
    south: x * tilt.sin + unsquashed * tilt.cos,
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
  const landed = tiltGround((place2d.x - centre.x) * size, (place2d.y - centre.y) * size, groundTilt(view));
  return { x: landed.x + view.width / 2, y: landed.y + view.height / 2 };
}

/**
 * How a layer of things standing on the ground is placed on the screen, when each thing's foot has
 * already been through `tiltGround` in world units.
 *
 * This is what stands the scenery up. The turn and the squash are applied to **where each foot is**,
 * once, and the layer as a whole is then only scaled and shifted - never turned, never squashed - so the
 * picture standing on the foot stays upright and whole while the ground tips away underneath it. A
 * foot then lands on the screen at `scale * tilted + (x, y)`, which is `toScreen` exactly; a test holds
 * the two together.
 */
export function standingLayer(view: CameraView): { scale: number; x: number; y: number; tilt: GroundTilt } {
  const tilt = groundTilt(view);
  const scale = pixelsPerWorldUnit(view.zoom);
  const centre = toMercatorExact(view.center);
  const at = tiltGround(centre.x * WORLD_MASTER_WIDTH, centre.y * WORLD_MASTER_WIDTH, tilt);
  return { scale, x: view.width / 2 - at.x * scale, y: view.height / 2 - at.y * scale, tilt };
}

/**
 * Which of two things standing on the ground is drawn first: the one further up the screen, because it
 * is further away. Ties go to the one further left, so that two feet at the same depth are always drawn
 * in the same order - an order that changed from one frame to the next is a flicker, not a picture.
 */
export function fartherFirst(a: ScreenPoint, b: ScreenPoint): number {
  return a.y - b.y || a.x - b.x;
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
