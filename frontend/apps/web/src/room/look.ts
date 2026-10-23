import type * as maplibregl from 'maplibre-gl';

import { flatPoint, sheetOnScreen } from '../map/sheet';

import { lookBy, unproject } from './camera';
import type { Point } from './camera';
import { aboutWithin, pulledBack } from './roomBox';
import { roomMost, seen } from './seen';

/**
 * Looking round the room: a drag, and the click that takes you back to the map.
 *
 * The pull draws back, turns and tips about a point of the window, and a drag moves that point by as much as
 * it takes for everything drawn to follow the pointer, no further than the room's walls. A click on the map
 * takes you back to it. A click anywhere else is not this file's: the table is meant to hold things beside the
 * map that can be pressed, so a press takes nothing from the page until it has moved, and only a drag takes the
 * pointer for itself. See experiment 0009.
 */

/** How far a press may wander, in pixels, and still be a click rather than the start of a drag. */
const CLICK_SLOP = 4;

interface LookHooks {
  map: maplibregl.Map;
  /** The full-pane element the pull listens on, which takes the pointer while the pull is on. */
  surface: HTMLElement;
  /** How far the pull is and the point it is drawn back about, or null when there is no room to look round. */
  pulled: () => { amount: number; about: Point | null } | null;
  /** Moves the point the pull is drawn back about. */
  lookAt: (about: Point) => void;
  /** Takes the player back to the map. */
  back: () => void;
}

export function attachLook({ map, surface, pulled, lookAt, back }: LookHooks): () => void {
  /** The pull as it is drawn now, in the flat window, or null when there is none. */
  const drawn = () => {
    const now = pulled();
    if (now === null) {
      return null;
    }
    const camera = seen(map);
    const view = { width: camera.width, height: camera.height };
    const sheet = sheetOnScreen(camera);
    return { view, sheet, ...pulledBack(sheet, view, now.amount, now.about, roomMost()) };
  };

  /** Where a pointer is in the flat window, where the pull's arithmetic is done. */
  const pointOf = (event: PointerEvent): Point => {
    const box = surface.getBoundingClientRect();
    return flatPoint({ x: event.clientX - box.left, y: event.clientY - box.top }, map.getPitch());
  };

  /** A press, until it is known whether it is a click or a drag. */
  let press: { id: number; at: Point; dragging: boolean } | null = null;

  const onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0 || pulled() === null) {
      return;
    }
    press = { id: event.pointerId, at: pointOf(event), dragging: false };
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (press === null || event.pointerId !== press.id) {
      return;
    }
    const at = pointOf(event);
    if (!press.dragging) {
      if (Math.hypot(at.x - press.at.x, at.y - press.at.y) < CLICK_SLOP) {
        return;
      }
      press.dragging = true;
      surface.setPointerCapture(event.pointerId);
    }
    // Turned and tipped, the point the room is drawn about has to move askew for the room to follow the
    // pointer straight; the camera works out how far, and the room's walls stop it.
    const now = drawn();
    const by = now === null ? null : lookBy(now.camera, { x: at.x - press.at.x, y: at.y - press.at.y });
    if (now !== null && by !== null) {
      const moved = { x: now.camera.about.x + by.x, y: now.camera.about.y + by.y };
      lookAt(aboutWithin(now.shell, now.view, { ...now.camera, about: moved }));
    }
    press.at = at;
  };

  // A wheel is not the only way to be here, so a click on the map takes you back to it: without a way that
  // is not a wheel, a touch or a trackpad without one would leave the room with no door.
  const onPointerUp = (event: PointerEvent): void => {
    if (press === null || event.pointerId !== press.id) {
      return;
    }
    const clicked = !press.dragging;
    press = null;
    if (surface.hasPointerCapture(event.pointerId)) {
      surface.releasePointerCapture(event.pointerId);
    }
    const now = clicked ? drawn() : null;
    if (now === null) {
      return;
    }
    // The map's square is turned and tipped into a skewed diamond on the window, so the click is carried back
    // through the camera onto the table top and looked for in the square there.
    const { sheet } = now;
    const on = unproject(now.camera, pointOf(event));
    if (
      on.x >= sheet.left &&
      on.x <= sheet.left + sheet.size &&
      on.y >= sheet.top &&
      on.y <= sheet.top + sheet.size
    ) {
      back();
    }
  };

  const onPointerCancel = (): void => {
    press = null;
  };

  surface.addEventListener('pointerdown', onPointerDown);
  surface.addEventListener('pointermove', onPointerMove);
  surface.addEventListener('pointerup', onPointerUp);
  surface.addEventListener('pointercancel', onPointerCancel);
  return () => {
    surface.removeEventListener('pointerdown', onPointerDown);
    surface.removeEventListener('pointermove', onPointerMove);
    surface.removeEventListener('pointerup', onPointerUp);
    surface.removeEventListener('pointercancel', onPointerCancel);
  };
}
