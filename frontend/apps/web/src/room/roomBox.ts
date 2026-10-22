import { deskOnScreen } from '../desk/deskTop';
import type { DeskTop } from '../desk/deskTop';
import { floorZoom } from '../map/sheet';
import type { Sheet, Viewport } from '../map/sheet';
import { worldSize } from '../geometry/cameraMath';

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

/** How many desks across the room is. */
const ROOM_IN_DESKS = 2.6;

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
 * The room coming in through the ceiling has to be drawn before the camera has gone anywhere, because
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
  const width = desk.width * ROOM_IN_DESKS;
  const height = desk.height * ROOM_IN_DESKS;
  return {
    left: desk.left + desk.width / 2 - width / 2,
    top: desk.top + desk.height / 2 - height / 2,
    width,
    height,
  };
}

/**
 * The scale the pull ends at: where the room's shorter side has come down to `ROOM_FILLS` of the
 * window's. Worked out rather than declared, because the room's size follows the window and a declared
 * number would be wrong on the first stage nobody tried.
 */
export function turnsAt(room: DeskTop, viewport: Viewport): number {
  const wanted = (ROOM_FILLS * Math.min(viewport.width, viewport.height)) / Math.min(room.width, room.height);
  return 2 ** -clamp(-Math.log2(wanted), LEAST_SPAN, MOST_SPAN);
}

/** How far the whole pull is, in zoom levels, which is what a wheel notch is measured against. */
export function spanOf(turn: number): number {
  return -Math.log2(turn);
}

/**
 * Where the room ends up, in window pixels, once the pull is spent.
 *
 * The scale is taken about the middle of the window, so a rectangle in the scene's own pixels lands at
 * `x * scale + width * (1 - scale) / 2`. This is where a dive has to start and finish, in both
 * directions: the room it leaves you in has to be the room it was showing you.
 */
export function roomAtTurn(sheet: Sheet, viewport: Viewport): DeskTop {
  const room = roomOnScreen(deskOnScreen(sheet, viewport));
  const scale = turnsAt(room, viewport);
  const across = (viewport.width * (1 - scale)) / 2;
  const down = (viewport.height * (1 - scale)) / 2;
  return {
    left: room.left * scale + across,
    top: room.top * scale + down,
    width: room.width * scale,
    height: room.height * scale,
  };
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
