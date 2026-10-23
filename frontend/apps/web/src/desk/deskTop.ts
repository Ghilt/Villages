import type { Sheet, Viewport } from '../map/sheet';

/**
 * The desk as an object with edges, rather than as the plane that fills whatever is left.
 *
 * Decision 0033 drew the desk as an infinite surface, because nothing could ever see past it: the camera
 * stops at a floor where the sheet is half the window's shorter side. Pull back past that floor and the
 * desk has to end somewhere. It is rigid and it is attached to the sheet, so panning at the floor slides
 * the whole desk under the camera exactly as the grain already slides, and shoving the sheet hard against
 * one edge of the window can bring the far edge of the desk into view. That is the desk being a real
 * object and not a backdrop.
 */

export interface DeskTop {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Wider than it is deep, like a desk. */
const DESK_ASPECT = 1.45;

/** How many sheets across the desk is, where the window does not force it wider. */
const DESK_IN_SHEETS = 4;

/** Room to spare beyond covering the window, so the edge is off-screen with the sheet in the middle. */
const DESK_MARGIN = 0.12;

/**
 * Where the desk lies in the window, in CSS pixels from its top left corner.
 *
 * Its size is the window's, not the sheet's: a fixed multiple of the sheet cannot cover a stage confined
 * to a phone and a desktop one at the same time, because the sheet is measured against the shorter side
 * and the desk has to cover the longer. The multiple is the floor under that, so the desk is the four
 * sheets across it looks like wherever the window is squarer.
 */
export function deskOnScreen(sheet: Sheet, viewport: Viewport): DeskTop {
  const covers = Math.max(viewport.width, viewport.height * DESK_ASPECT) * (1 + DESK_MARGIN);
  const width = Math.max(covers, sheet.size * DESK_IN_SHEETS);
  const height = width / DESK_ASPECT;
  return {
    left: sheet.left + sheet.size / 2 - width / 2,
    top: sheet.top + sheet.size / 2 - height / 2,
    width,
    height,
  };
}

/**
 * Whether the desk reaches every edge of the window, which is when the room cannot be seen: drawn back by
 * `scale` about a point of the window, the middle unless the room is being looked round.
 */
export function deskCoversView(
  desk: DeskTop,
  viewport: Viewport,
  scale: number,
  about: { x: number; y: number } = { x: viewport.width / 2, y: viewport.height / 2 },
): boolean {
  const left = about.x + (desk.left - about.x) * scale;
  const top = about.y + (desk.top - about.y) * scale;
  return (
    left <= 0 &&
    top <= 0 &&
    left + desk.width * scale >= viewport.width &&
    top + desk.height * scale >= viewport.height
  );
}
