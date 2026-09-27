import type { DeskTop } from '../desk/deskTop';
import type { Viewport } from '../map/sheet';
import { pixelsPerWorldUnit } from '../sprites/cameraMath';

/**
 * The dive: going into your own castle, and coming back out of it.
 *
 * The loop turns over here, and it turns over inside the mark for your own house rather than beside it.
 * The scene stops being a map and becomes a picture: the camera is pinned at the closest zoom over the
 * seat and the whole of what is drawn is scaled up about the middle of the castle, so its pixels grow
 * until they are the size of the window. The room is inside them. By the time it is the window, it is the
 * same room at the same size the real one is about to be, and the camera can be put anywhere underneath.
 *
 * Which is to say: the picture is not a snapshot. It is the live map and the live sprites with a scale
 * over them, which is the same thing to look at and costs nothing, because a pinned camera draws no
 * frames and a snapshot would mean `preserveDrawingBuffer` on every frame the game ever draws for the
 * sake of two seconds of it.
 *
 * It runs on a rail. The wheel starts it and then has nothing more to say until it is over: a passage is
 * a thing that finishes, and half a passage is a place nobody should be able to stand. See experiment
 * 0009.
 */

export interface Point {
  x: number;
  y: number;
}

export type Going = 'in' | 'out';

export interface Dive {
  going: Going;
  /** 0 on the map, 1 in the room. It runs up going in and down coming out. */
  progress: number;
  /** The middle of the castle when the dive began, in window pixels. */
  keep: Point;
  /** How much larger the scene gets across the whole dive. */
  span: number;
  /** Where the room ends: the rectangle the real one has at a full pull, so the handover is invisible. */
  end: DeskTop;
}

/**
 * How tall a house stands on the ground, in world units.
 *
 * The same four the renderer gives it, which is not exported and is `KINDS.house` in
 * `sprites/PixiSpriteRenderer.ts`. A change there is a change here, and the dive would turn about a point
 * that is not the middle of the castle without it. See decision record 0051.
 */
const HOUSE_GROUND_HEIGHT = 4;

/** How wide the room is where it starts, in window pixels: a fraction of the castle, inside the keep. */
const ROOM_IN_THE_KEEP = 18;

/**
 * How long the passage takes.
 *
 * Halved from the 1700 it was first tried at. A second and three quarters was long enough to be read as a
 * journey and long enough to be waited for, and a passage that has to be sat through twice is a passage
 * nobody takes twice. The wheel is taken away for the whole of it, which is the thing this number really
 * buys and the reason it wants to be as short as it can be while still being a going-somewhere.
 */
export const DIVE_MS = 850;

/** How near the middle of the window the castle has to be for the way in to be there at all. */
const NEAR_ENOUGH = 0.35;

/** The room is nothing at first, so that it never appears as a blob painted on the sprite. */
const SOLID_BY = 0.22;

/** Where the picture starts to go. The room does not quite fill the window, and what is beside it has to */
/* be the same thing before and after the camera moves, or the swap shows as a flicker round the edges. */
const CLOSES_FROM = 0.82;

const clamp = (value: number, least: number, most: number): number => Math.min(most, Math.max(least, value));

const ease = (t: number): number => t * t * (3 - 2 * t);

/** How tall the castle is drawn at a zoom, in screen pixels: 64 at the closest. */
export function castleHeight(zoom: number): number {
  return HOUSE_GROUND_HEIGHT * pixelsPerWorldUnit(zoom);
}

/**
 * The point the dive turns about: the middle of the castle, half its height above the seat it stands on.
 *
 * Both forms of a mark share one anchor and it is the foot (decision record 0051), so the seat projects to
 * the bottom of the castle and the middle of it is up from there.
 */
export function keepAbove(foot: Point, zoom: number): Point {
  return { x: foot.x, y: foot.y - castleHeight(zoom) / 2 };
}

/**
 * Whether the castle is near enough the middle of the window to dive into.
 *
 * The way into the room is through your own house, so it has to be the thing you are looking at rather
 * than something in the corner of the view. Off to one side, the closest zoom is the end of the zoom
 * again and the wheel does nothing, which is what it always did.
 */
export function overTheHolding(foot: Point, viewport: Viewport): boolean {
  const reach = Math.min(viewport.width, viewport.height) * NEAR_ENOUGH;
  return Math.hypot(foot.x - viewport.width / 2, foot.y - viewport.height / 2) <= reach;
}

/** How much larger everything gets: enough to take the room from inside the keep to the whole window. */
export function spanTo(end: DeskTop): number {
  return end.width / ROOM_IN_THE_KEEP;
}

/** The scale at a point in the passage. Exponential, so it reads as zoom rather than as a thing growing. */
export function scaleAt(dive: Dive, progress: number): number {
  return dive.span ** clamp(progress, 0, 1);
}

/**
 * Where the castle's middle sits on the screen: where it was, easing to the middle of the window.
 *
 * It has to arrive in the middle, because that is where the room is when it is the window, and the room
 * being anywhere else at the end would be a jump at the very moment the whole thing exists to hide.
 */
export function keepAt(dive: Dive, viewport: Viewport, progress: number): Point {
  const t = ease(clamp(progress, 0, 1));
  return {
    x: dive.keep.x + (viewport.width / 2 - dive.keep.x) * t,
    y: dive.keep.y + (viewport.height / 2 - dive.keep.y) * t,
  };
}

/**
 * What to put on the scene: scale about the castle's middle, then slide that point to where it belongs.
 *
 * With `transform-origin` at the keep, `translate(d) scale(s)` sends a point `q` to
 * `keep + (q - keep) * s + d`, so `d` is the whole of the drift and the two can be worked out apart.
 */
export function sceneAt(
  dive: Dive,
  viewport: Viewport,
  progress: number,
): { origin: Point; slide: Point; scale: number } {
  const now = keepAt(dive, viewport, progress);
  return {
    origin: dive.keep,
    slide: { x: now.x - dive.keep.x, y: now.y - dive.keep.y },
    scale: scaleAt(dive, progress),
  };
}

/**
 * The room, in window pixels. It is a rectangle standing at the castle's middle in the scene's own
 * coordinates, so it grows with everything around it and stays where it is inside the pixels.
 */
export function roomAt(dive: Dive, viewport: Viewport, progress: number): DeskTop {
  const centre = keepAt(dive, viewport, progress);
  const width = ROOM_IN_THE_KEEP * scaleAt(dive, progress);
  const height = (width * dive.end.height) / dive.end.width;
  return { left: centre.x - width / 2, top: centre.y - height / 2, width, height };
}

/** How solid the room is: nothing at first, and everything by the time it is worth looking at. */
export function solidAt(progress: number): number {
  return ease(clamp(progress / SOLID_BY, 0, 1));
}

/**
 * How much of the picture is still showing: all of it until the room is nearly the window, then none.
 *
 * The room stops a little short of the window's edges, because that is where the real one stops, and what
 * shows beside it has to be the same before and after the camera is moved underneath. Without this the
 * margin would go from a castle's own pixel to the dark behind the room in a single frame, which is the
 * one flicker the whole passage exists to avoid. Read backwards it is the light coming up as you leave.
 */
export function lightAt(progress: number): number {
  return 1 - ease(clamp((progress - CLOSES_FROM) / (1 - CLOSES_FROM), 0, 1));
}
