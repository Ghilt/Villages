import { deskOnScreen } from '../desk/deskTop';
import type { DeskTop } from '../desk/deskTop';
import { floorZoom, leanOf } from '../map/sheet';
import type { Sheet, Viewport } from '../map/sheet';
import { worldSize } from '../geometry/cameraMath';

import type { Point } from './dive';

/**
 * The room the desk stands in, and the arithmetic of pulling back into it.
 *
 * The sheet lies on the desk, the desk stands in the room, and each is hidden while the one in front of
 * it covers the window: the same rule decision 0033 gave the desk, one level further out. What is new is
 * that the room is not reached by the camera. Below the map's floor the camera is pinned, and the pull is
 * a scale on what is drawn - so this file is the whole of the geometry, and it is pure.
 *
 * See experiment 0009.
 */

/**
 * How many desks across the room is, and how many deep. More floor round the desk than the 2.6 each way it
 * was first tried at, Adam's word of 2026-10-22, and deeper than across: tipped back, the floor is squashed
 * down by the tip, and a room the desk's own shape would be a letterbox in the window.
 */
export const ROOM_ACROSS = 3.2;
export const ROOM_DEEP = 4.1;

/** At the turn, the room's shorter side is this much of the window's: nearly all of it, so there is */
/* almost no surround to see when the live map is swapped underneath it. */
const ROOM_FILLS = 0.92;

/** A pull shorter than this is not a journey, whatever the shape of the window says. */
const LEAST_SPAN = 1.2;

/** A pull longer than this leaves the map an unreadable smudge before the room is in view. */
const MOST_SPAN = 2.6;

/** MapLibre's own wheel arithmetic, so a notch past the floor is the same size as a notch above it. */
const DEFAULT_ZOOM_RATE = 1 / 100;
const WHEEL_ZOOM_RATE = 1 / 450;
const WHEEL_ZOOM_DELTA = 4.000244140625;
const MOST_SCALE_PER_EVENT = 2;

/**
 * How near the end of the map's zoom counts as at it, in zoom levels: a scale of three and a half per cent.
 *
 * MapLibre's wheel restarts its ease from wherever the zoom is on every wheel event, so while the wheel keeps
 * turning the zoom creeps towards a clamped end and does not land on it until the wheel has been still for a
 * fifth of a second. Asking for the end itself made the picture stop just short of it and the passage wait
 * for a pause that a player scrolling on does not make. Experiment 0009, second round.
 */
const NEAR_THE_END = 0.05;

const clamp = (value: number, least: number, most: number): number => Math.min(most, Math.max(least, value));

/** Whether the map's zoom is at one end of its range for the wheel's purposes: the floor, or the closest. */
export function atTheEnd(zoom: number, end: number): boolean {
  return Math.abs(zoom - end) <= NEAR_THE_END;
}

/**
 * The sheet as it will be once the camera is at its floor with the world under the middle of the window.
 *
 * The room coming in through the castle has to be drawn before the camera has gone anywhere, because
 * the point of the turn is that the swap underneath it is not seen. So it is drawn from where the sheet
 * is about to be rather than from where it is, and the turn puts the camera exactly there: the world's
 * centre, at the floor.
 */
export function sheetAtFloor(viewport: Viewport): Sheet {
  const size = worldSize(floorZoom(viewport));
  return { left: (viewport.width - size) / 2, top: (viewport.height - size) / 2, size };
}

/** The room, concentric with the desk, so pulling back draws away from the map rather than from a corner. */
export function roomOnScreen(desk: DeskTop): DeskTop {
  const width = desk.width * ROOM_ACROSS;
  const height = desk.height * ROOM_DEEP;
  return {
    left: desk.left + desk.width / 2 - width / 2,
    top: desk.top + desk.height / 2 - height / 2,
    width,
    height,
  };
}

/**
 * The scale the pull ends at: where the room's shorter side, as it is drawn, tipped by `lean`, has come down
 * to `ROOM_FILLS` of the window's. Worked out rather than declared, because the room's size follows the
 * window and a declared number would be wrong on the first stage nobody tried.
 */
export function turnsAt(room: DeskTop, viewport: Viewport, lean = 1): number {
  const shorter = Math.min(room.width, room.height * lean);
  const wanted = (ROOM_FILLS * Math.min(viewport.width, viewport.height)) / shorter;
  return 2 ** -clamp(-Math.log2(wanted), LEAST_SPAN, MOST_SPAN);
}

/**
 * How far the room is tipped back at a pull, in degrees: not at all at the floor, where the map lies on the
 * desk seen from straight above, and as far as the map is at its closest zoom once the pull is spent, so the
 * room a dive lands in and the room the pull draws are tipped alike. Eased at both ends the way the map's own
 * tilt is, so the tip neither starts nor stops with a jolt, and it follows the pull rather than a clock: the
 * wheel drives it the whole way. Tipped north-up by a parallel camera, flat ground is squashed down by the
 * cosine of the tip and nothing else, so a tip is a scale down and no more. See decision record 0060.
 */
export function tipAt(amount: number, most: number): number {
  const t = clamp(amount, 0, 1);
  return most * t * t * (3 - 2 * t);
}

/** How far the whole pull is, in zoom levels, which is what a wheel notch is measured against. */
export function spanOf(turn: number): number {
  return -Math.log2(turn);
}

/** The middle of the window, which the pull draws back about until a drag moves it. */
export function middleOf(viewport: Viewport): Point {
  return { x: viewport.width / 2, y: viewport.height / 2 };
}

/**
 * Where a rectangle of the scene is drawn, the scene scaled about a point of the window: `about + (x - about)
 * * scale` across, and the same down with the tip's `lean` on it. The point is the one thing that stays where
 * it is, so a scale about the middle is the pull as it always was, and a scale about anywhere else is the same
 * pull looking somewhere else.
 */
export function scaledAbout(rect: DeskTop, about: Point, scale: number, lean = 1): DeskTop {
  return {
    left: about.x + (rect.left - about.x) * scale,
    top: about.y + (rect.top - about.y) * scale * lean,
    width: rect.width * scale,
    height: rect.height * scale * lean,
  };
}

/**
 * The point to draw back about, kept where the room still covers the window.
 *
 * Moving the point by `d` moves everything drawn by `d * (1 - scale)`, so a drag moves it by its own length
 * over that and everything follows the pointer, and at no pull at all it moves nothing: there is no look to
 * hand back when the pull comes in to the floor, because at the floor the point does not matter. Along an
 * axis where the room is wider than the window it may go as far as the room's walls and no further; along
 * one where the room is narrower it is the point that puts the room in the middle.
 */
export function aboutWithin(
  room: DeskTop,
  viewport: Viewport,
  scale: number,
  wanted: Point,
  lean = 1,
): Point {
  return {
    x: alongWithin(room.left, room.width, viewport.width, scale, wanted.x),
    y: alongWithin(room.top, room.height, viewport.height, scale * lean, wanted.y),
  };
}

function alongWithin(start: number, length: number, window: number, scale: number, wanted: number): number {
  const free = 1 - scale;
  if (free <= 0) {
    return window / 2;
  }
  if (length * scale <= window) {
    return (window / 2 - (start + length / 2) * scale) / free;
  }
  return clamp(wanted, (window - (start + length) * scale) / free, (-start * scale) / free);
}

/** The pull as it is drawn: the desk and the room in the scene's own pixels, and how it is drawn back. */
export interface PulledBack {
  desk: DeskTop;
  room: DeskTop;
  /** How much smaller everything is drawn: one at the floor, the turn's scale in the room. */
  scale: number;
  /** How much the tip squashes it down on top of that: one at the floor, the cosine of the most in the room. */
  lean: number;
  /** The point of the window it is drawn back about, kept where the room covers the window. */
  about: Point;
}

/**
 * The pull at an amount, with the sheet where it lies and the point the player last looked round to, or the
 * middle of the window if they have not, tipped back towards `most` degrees, the map's own at its closest.
 * The room drawn on the page and the room a dive sets out from are both this, so they cannot disagree.
 */
export function pulledBack(
  sheet: Sheet,
  viewport: Viewport,
  amount: number,
  wanted: Point | null,
  most: number,
): PulledBack {
  const desk = deskOnScreen(sheet, viewport);
  const room = roomOnScreen(desk);
  const lean = leanOf(tipAt(amount, most));
  const scale = scaleFor(amount, turnsAt(room, viewport, leanOf(most)));
  const about = aboutWithin(room, viewport, scale, wanted ?? middleOf(viewport), lean);
  return { desk, room, scale, lean, about };
}

/**
 * Where the room ends up, in window pixels, once the pull is spent, wherever in it the player was looking,
 * tipped back `most` degrees. This is where a dive has to start and finish, in both directions: the room it
 * leaves you in has to be the room it was showing you.
 */
export function roomAtTurn(sheet: Sheet, viewport: Viewport, about: Point | null, most: number): DeskTop {
  const spent = pulledBack(sheet, viewport, 1, about, most);
  return scaledAbout(spent.room, spent.about, spent.scale, spent.lean);
}

/**
 * The scale at a given pull. Exponential, so a notch is a constant ratio and the pull-back reads as more
 * of the same zoom rather than as a different motion with its own acceleration.
 */
export function scaleFor(amount: number, turn: number): number {
  return turn ** clamp(amount, 0, 1);
}

/**
 * A wheel event in zoom levels, always positive, by MapLibre's own formula: the slower rate for the big
 * deltas a mouse wheel sends, the faster one for a trackpad's small ones, and a cap of one zoom level an
 * event. Firefox reports lines rather than pixels and is worth forty times as much, which is the one
 * thing here that is a bug if it is left out rather than merely a difference in feel.
 */
export function wheelZooms(deltaY: number, deltaMode: number): number {
  const value = deltaMode === 1 ? deltaY * 40 : deltaY;
  const rate = Math.abs(value) > WHEEL_ZOOM_DELTA ? WHEEL_ZOOM_RATE : DEFAULT_ZOOM_RATE;
  const scale = MOST_SCALE_PER_EVENT / (1 + Math.exp(-Math.abs(value * rate)));
  return Math.log2(scale);
}
