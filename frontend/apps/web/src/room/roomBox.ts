import { deskOnScreen } from '../desk/deskTop';
import type { DeskTop } from '../desk/deskTop';
import { floorZoom } from '../map/sheet';
import type { Sheet, Viewport } from '../map/sheet';
import { worldSize } from '../geometry/cameraMath';

import { boxOf, lookBy, offsetOf, project } from './camera';
import type { Point, RoomCamera } from './camera';
import { shellOf } from './model';
import type { Spot } from './model';

/**
 * The room the desk stands in, and the arithmetic of pulling back into it.
 *
 * The sheet lies on the desk, the desk stands in the room, and each is hidden while the one in front of
 * it covers the window: the same rule decision 0033 gave the desk, one level further out. What is new is
 * that the room is not reached by the camera. Below the map's floor the camera is pinned, and the pull is
 * the room's own camera on what is drawn, drawing it back, turning it and tipping it - so this file and
 * `camera.ts` are the whole of the geometry, and both are pure.
 *
 * See experiment 0009 and `docs/plans/room.md`.
 */

/** At the turn, the shorter side of the box the room is drawn in is this much of the window's: nearly all */
/* of it, so there is almost no surround to see when the live map is swapped underneath it. */
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

/**
 * How far the room turns and tips once the pull is spent, in degrees: the map's own pair, the turn of the
 * ground's grid and the tilt at the closest zoom, so the room a dive lands in is seen as the map is.
 */
export interface Most {
  turn: number;
  tip: number;
}

/**
 * How far the room is turned or tipped at a pull, in degrees: not at all at the floor, where the map lies on
 * the desk seen from straight above, and the most once the pull is spent. Eased at both ends the way the map's
 * own tilt is, so it neither starts nor stops with a jolt, and it follows the pull rather than a clock: the
 * wheel drives it the whole way.
 */
export function tipAt(amount: number, most: number): number {
  const t = clamp(amount, 0, 1);
  return most * t * t * (3 - 2 * t);
}

/**
 * The scale the pull ends at: where the room's shell - its floor and the tops of its walls - as it is drawn
 * turned and tipped, has its box's shorter
 * side come down to `ROOM_FILLS` of the window's. Worked out rather than declared, because the room's size
 * follows the window and a declared number would be wrong on the first stage nobody tried.
 */
export function turnsAt(shell: readonly Spot[], viewport: Viewport, most: Most): number {
  const spent: RoomCamera = { scale: 1, about: middleOf(viewport), turn: most.turn, tip: most.tip };
  const box = boxOf(shell.map((corner) => project(spent, corner, corner.up)));
  const wanted = (ROOM_FILLS * Math.min(viewport.width, viewport.height)) / Math.min(box.width, box.height);
  return 2 ** -clamp(-Math.log2(wanted), LEAST_SPAN, MOST_SPAN);
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
 * The point to draw back about, kept where the room's box, as the camera draws it, still covers the window.
 *
 * A point of the table top is drawn at `M q + (1 - M) about`, so the box of the first half is fixed for a
 * camera and the point only slides it: along an axis where the box is wider than the window it may slide as
 * far as the room's edge and no further, and along one where it is narrower it is put in the middle. The
 * slide is worked back into a point through the camera, and at no pull there is nothing to slide.
 */
export function aboutWithin(shell: readonly Spot[], viewport: Viewport, camera: RoomCamera): Point {
  const fixed: RoomCamera = { ...camera, about: { x: 0, y: 0 } };
  const box = boxOf(shell.map((corner) => project(fixed, corner, corner.up)));
  const now = offsetOf(camera);
  const wanted = {
    x: alongWithin(box.left, box.width, viewport.width, now.x),
    y: alongWithin(box.top, box.height, viewport.height, now.y),
  };
  const by = lookBy(camera, { x: wanted.x - now.x, y: wanted.y - now.y });
  return by === null ? camera.about : { x: camera.about.x + by.x, y: camera.about.y + by.y };
}

function alongWithin(start: number, length: number, window: number, offset: number): number {
  if (length <= window) {
    return window / 2 - (start + length / 2);
  }
  return clamp(offset, window - (start + length), -start);
}

/** The pull as it is drawn: the desk and the floor in the scene's own pixels, and the camera they are seen by. */
export interface PulledBack {
  desk: DeskTop;
  /** The room's outermost corners: the floor's, and the tops of its walls. */
  shell: Spot[];
  camera: RoomCamera;
}

/**
 * The pull at an amount, with the sheet where it lies and the point the player last looked round to, or the
 * middle of the window if they have not. The room drawn on the page and the room a dive sets out from are
 * both this, so they cannot disagree.
 */
export function pulledBack(
  sheet: Sheet,
  viewport: Viewport,
  amount: number,
  wanted: Point | null,
  most: Most,
): PulledBack {
  const desk = deskOnScreen(sheet, viewport);
  const shell = shellOf(desk);
  const camera: RoomCamera = {
    scale: scaleFor(amount, turnsAt(shell, viewport, most)),
    about: wanted ?? middleOf(viewport),
    turn: tipAt(amount, most.turn),
    tip: tipAt(amount, most.tip),
  };
  return { desk, shell, camera: { ...camera, about: aboutWithin(shell, viewport, camera) } };
}

/**
 * The room once the pull is spent: the map's sheet and the desk it is laid round, the camera, and the box the
 * room is drawn in.
 */
export interface RoomAtTurn {
  sheet: Sheet;
  desk: DeskTop;
  camera: RoomCamera;
  box: DeskTop;
}

/**
 * The room once the pull is spent, wherever in it the player was looking. This is where a dive has to start
 * and finish, in both directions: the room it leaves you in has to be the room it was showing you.
 */
export function roomAtTurn(sheet: Sheet, viewport: Viewport, about: Point | null, most: Most): RoomAtTurn {
  const spent = pulledBack(sheet, viewport, 1, about, most);
  const box = boxOf(spent.shell.map((corner) => project(spent.camera, corner, corner.up)));
  return { sheet, desk: spent.desk, camera: spent.camera, box };
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
