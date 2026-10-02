import type * as maplibregl from 'maplibre-gl';

import { note } from '../log/log';
import { deskOnScreen } from '../desk/deskTop';
import { CAMERA } from '../map/mapConfig';
import { flatPoint, flatWindow, floorZoom, sheetOnScreen } from '../map/sheet';
import type { Viewport } from '../map/sheet';
import { easeTowards } from '../sprites/twoForms';

import { DIVE_MS, keepAbove, overTheHolding, spanTo } from './dive';
import type { Dive, Going } from './dive';
import { roomAtTurn, roomOnScreen, sheetAtFloor, spanOf, turnsAt, wheelZooms } from './roomBox';

/**
 * The pull, and the dive: the two halves of leaving the map, and the one number each of them is.
 *
 * The pull is how far the eye has drawn back past the map's floor. It is not zoom - the camera is pinned
 * and MapLibre does no work at all while it moves, and what changes is a scale on what is already drawn.
 * It has to be that way, because the camera cannot reach a room: `setMinZoom` refuses anything under -2
 * and the floor on a wide window is already about -0.19, so there are under two zoom levels spare.
 *
 * The dive is how the loop turns over, and it turns over inside your own castle. See `dive.ts`. It runs on
 * a rail rather than on the wheel, because a passage is a thing that finishes and half a passage is a
 * place nobody should be able to stand.
 *
 * A module with a listener set, the same shape as the eye and the debug log. See experiment 0009.
 */

export interface PullState {
  /** 0 at the map's floor, 1 in the room. Eased, so this is what is drawn rather than what was asked. */
  amount: number;
  /** The passage into the castle or out of it, while one is running. */
  dive: Dive | null;
}

/** How close to the end of the zoom counts as being at it. MapLibre's ease lands by adding a delta. */
const AT_THE_END = 1e-6;

/** How long the drawn pull takes to catch what the wheel asked for. MapLibre's own wheel ease is 200. */
const SETTLE_MS = 180;

/** A frame longer than this is a tab that was not being drawn, not a slow machine. */
const LONGEST_STEP_MS = 50;

/** How long the way out waits, under a room that covers the window, for the ground to be painted. */
const WAIT_MS = 900;

const still: PullState = { amount: 0, dive: null };

let state: PullState = still;
let wanted = 0;
let lastFrameAt = 0;
let owed: number | null = null;
const listeners = new Set<() => void>();

export function pullNow(): PullState {
  return state;
}

export function watchPull(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function settle(next: PullState): void {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

function calm(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

interface Hooks {
  map: maplibregl.Map;
  /**
   * The full-pane element the wheel is listened for on. It has to be this rather than the map's own
   * container, because once the pull is on the map is a thumbnail in the middle and most of the window is
   * nowhere near it. Whether it is the thing under the pointer is a matter of `pointer-events`, which the
   * component hands back and forth: the scene takes them at rest, this takes them once the pull is on.
   */
  surface: HTMLElement;
  /** The player's seat, or null while they have no house and so no way into the room. */
  seatNow: () => { lat: number; lon: number } | null;
  /** Whether the map pane is put away as a strip, where forty-four pixels of room would be nonsense. */
  stripNow: () => boolean;
}

/**
 * Hangs the pull off a map. Everything below the end of the zoom is handled here, and nothing above it is
 * touched: a wheel the map can still act on is handed straight back.
 */
export function attachPull({ map, surface, seatNow, stripNow }: Hooks): () => void {
  const container = map.getContainer();
  // The window as the flat world sees it, like everything else about the desk and the room: the camera
  // is tipped, and the room's rules are the flat ones in a window taller by one over the lean. See 0060.
  const viewport = (): Viewport =>
    flatWindow({ width: container.clientWidth, height: container.clientHeight }, map.getPitch());

  /** How far the pull is, in zoom levels, which is what a wheel notch is measured against. */
  const span = (): number => {
    const view = viewport();
    return spanOf(turnsAt(roomOnScreen(deskOnScreen(sheetOnScreen(seen(map)), view)), view));
  };

  let ours = false;
  let said = false;

  const release = (why: string | null): void => {
    if (wanted === 0 && state.amount === 0) {
      return;
    }
    wanted = 0;
    settle({ ...state, amount: 0 });
    if (why !== null) {
      note('room', why);
    }
  };

  // ---- the dive -------------------------------------------------------------------------------------

  /** Where the dive leaves you. Going in, that is the room; coming out, the map at your own seat. */
  const land = (going: Going): void => {
    if (going === 'in') {
      ours = true;
      map.jumpTo({ center: [0, 0], zoom: floorZoom(viewport()) });
      ours = false;
      wanted = 1;
      settle({ amount: 1, dive: null });
    } else {
      wanted = 0;
      settle({ amount: 0, dive: null });
    }
  };

  let railing: number | null = null;

  const rail = (going: Going, from: number, at: number): void => {
    railing = null;
    const now = performance.now();
    const gone = (now - at) / DIVE_MS;
    const progress = going === 'in' ? Math.min(1, from + gone) : Math.max(0, from - gone);
    const dive = state.dive;
    if (dive === null) {
      return;
    }
    settle({ ...state, dive: { ...dive, progress } });
    if (going === 'in' ? progress >= 1 : progress <= 0) {
      land(going);
      return;
    }
    railing = requestAnimationFrame(() => rail(going, from, at));
  };

  /**
   * Starts a passage. Going in, the picture is already on the screen and it begins at once; coming out,
   * the camera has to be put on the seat first and the ground there has never been painted, so it holds
   * under a room that covers the whole window until the tiles have arrived.
   */
  const dive = (going: Going, seat: { lat: number; lon: number }): void => {
    const view = viewport();
    const end = roomAtTurn(going === 'in' ? sheetAtFloor(view) : sheetOnScreen(seen(map)), view);

    if (calm()) {
      land(going);
      return;
    }

    if (going === 'out') {
      ours = true;
      map.jumpTo({ center: [seat.lon, seat.lat], zoom: CAMERA.maxZoom });
      ours = false;
    }

    const foot = map.project([seat.lon, seat.lat]);
    const started: Dive = {
      going,
      progress: going === 'in' ? 0 : 1,
      // Worked out on the real window, where the castle stands upright, and then carried into the flat
      // one, where the dive's arithmetic is done.
      keep: flatPoint(keepAbove({ x: foot.x, y: foot.y }, CAMERA.maxZoom), map.getPitch()),
      span: spanTo(end),
      end,
    };
    wanted = going === 'in' ? 0 : 1;
    settle({ amount: going === 'in' ? 0 : 1, dive: started });
    note(
      'room',
      going === 'in'
        ? `in through your own castle at ${seat.lat.toFixed(3)}, ${seat.lon.toFixed(3)}: ${started.span.toFixed(0)} times into its pixels`
        : `out through your own castle at ${seat.lat.toFixed(3)}, ${seat.lon.toFixed(3)}`,
    );

    const go = () => {
      if (state.dive === null || railing !== null) {
        return;
      }
      railing = requestAnimationFrame(() => rail(going, started.progress, performance.now()));
    };
    if (going === 'in') {
      go();
    } else {
      map.once('idle', go);
      globalThis.setTimeout(go, WAIT_MS);
    }
  };

  const stopRail = (): void => {
    if (railing !== null) {
      cancelAnimationFrame(railing);
      railing = null;
    }
  };

  // ---- the pull -------------------------------------------------------------------------------------

  const frame = (): void => {
    owed = null;
    const now = performance.now();
    const elapsed = Math.min(now - lastFrameAt, LONGEST_STEP_MS);
    lastFrameAt = now;
    const amount = calm() ? wanted : easeTowards(state.amount, wanted, elapsed, SETTLE_MS);
    if (amount !== state.amount) {
      settle({ ...state, amount });
    }
    if (amount >= 1 && wanted >= 1) {
      const seat = seatNow();
      if (seat === null) {
        // Nowhere to go. The pull rests against the room exactly as it used to rest against the floor,
        // which is the same answer the wheel has always given at the end of the zoom.
        if (!said) {
          note('room', 'no house yet, and the way out is through your own castle: the pull rests here');
          said = true;
        }
        return;
      }
      dive('out', seat);
      return;
    }
    if (amount !== wanted) {
      keep();
    }
  };

  const keep = (): void => {
    if (owed !== null) {
      return;
    }
    owed = requestAnimationFrame(frame);
  };

  const push = (by: number): void => {
    wanted = Math.min(1, Math.max(0, wanted + by / span()));
    if (owed === null) {
      lastFrameAt = performance.now();
    }
    keep();
  };

  const onWheel = (event: WheelEvent): void => {
    if (stripNow()) {
      return;
    }

    // On the rail the wheel has nothing to say. It is swallowed rather than handed back, because handing
    // it back would zoom a map that is under a picture of itself.
    if (state.dive !== null) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const out = event.deltaY > 0;
    const zoom = map.getZoom();
    const view = viewport();

    if (state.amount === 0 && wanted === 0) {
      if (out && zoom <= floorZoom(view) + AT_THE_END) {
        // One wheel is spent settling MapLibre's own ease on to the floor before the next one starts the
        // pull, which is the one seam in this and is felt as a tick of hesitation rather than as a stop.
        said = false;
        note('room', `off the desk: ${span().toFixed(2)} zoom levels of pull to the turn`);
      } else if (!out && zoom >= CAMERA.maxZoom - AT_THE_END) {
        // The way in is through your own house, so it is only there when that is what you are looking at.
        const seat = seatNow();
        const foot = seat === null ? null : map.project([seat.lon, seat.lat]);
        if (seat === null || foot === null || !overTheHolding(flatPoint(foot, map.getPitch()), view)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        dive('in', seat);
        return;
      } else {
        return;
      }
    }

    event.preventDefault();
    event.stopPropagation();
    push((out ? 1 : -1) * wheelZooms(event.deltaY, event.deltaMode));
  };

  // A wheel is not the only way to be here and it is the only way out, so a click puts it back. Without
  // it a touch or a keyboard leaves the room with no door.
  const onClick = (): void => {
    if (state.dive === null) {
      release('back on the desk');
    }
  };

  // The floor moves with the window, so a pull measured against the old one is a lie; and a dive is
  // anchored to a castle that is no longer where it was, so it is landed rather than carried over.
  const onResize = (): void => {
    if (state.dive !== null) {
      stopRail();
      land(state.dive.going);
      return;
    }
    release(null);
  };

  const onMoveStart = (): void => {
    if (!ours && state.dive === null) {
      release(null);
    }
  };

  surface.addEventListener('wheel', onWheel, { capture: true, passive: false });
  surface.addEventListener('click', onClick);
  map.on('resize', onResize);
  map.on('movestart', onMoveStart);

  return () => {
    surface.removeEventListener('wheel', onWheel, { capture: true });
    surface.removeEventListener('click', onClick);
    map.off('resize', onResize);
    map.off('movestart', onMoveStart);
    stopRail();
    if (owed !== null) {
      cancelAnimationFrame(owed);
      owed = null;
    }
    wanted = 0;
    state = still;
  };
}

/** The camera as `sheetOnScreen` wants it: looking straight down, in the flat window. */
function seen(map: maplibregl.Map): {
  center: { lng: number; lat: number };
  zoom: number;
  width: number;
  height: number;
} {
  const container = map.getContainer();
  const centre = map.getCenter();
  return {
    center: { lng: centre.lng, lat: centre.lat },
    zoom: map.getZoom(),
    ...flatWindow({ width: container.clientWidth, height: container.clientHeight }, map.getPitch()),
  };
}
