import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import type * as maplibregl from 'maplibre-gl';

import { note } from '../log/log';
import { deskOnScreen } from '../desk/deskTop';
import { CAMERA } from '../map/mapConfig';
import { flatPoint, flatWindow, floorZoom, sheetOnScreen } from '../map/sheet';
import type { Viewport } from '../map/sheet';
import { easeTowards } from '../sprites/twoForms';

import { keepAbove, overTheHolding, railFrom, spanTo } from './dive';
import type { Dive, Going } from './dive';
import { atTheEnd, roomAtTurn, roomOnScreen, sheetAtFloor, spanOf, turnsAt, wheelZooms } from './roomBox';
import { worldStill } from '../motion/motion';

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
 * place nobody should be able to stand; the wheel can only turn it round.
 *
 * A store, the same shape as the eye and the debug log, read through `useStore`. See experiment 0009.
 */

export interface PullState {
  /** 0 at the map's floor, 1 in the room. Eased, so this is what is drawn rather than what was asked. */
  amount: number;
  /** The passage into the castle or out of it, while one is running. */
  dive: Dive | null;
}

/** How long the drawn pull takes to catch what the wheel asked for. MapLibre's own wheel ease is 200. */
const SETTLE_MS = 180;

/** A frame longer than this is a tab that was not being drawn, not a slow machine. */
const LONGEST_STEP_MS = 50;

const still: PullState = { amount: 0, dive: null };

const store = createStore<PullState>(still);

/** How far the eye has drawn back, and the passage running, as drawn. */
export const pullStore: Readable<PullState> = store;
let wanted = 0;
let lastFrameAt = 0;
let owed: number | null = null;

function settle(next: PullState): void {
  store.set(next);
}

function calm(): boolean {
  return worldStill();
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
    if (wanted === 0 && store.get().amount === 0) {
      return;
    }
    wanted = 0;
    settle({ ...store.get(), amount: 0 });
    if (why !== null) {
      note('room', why);
    }
  };

  // ---- the dive -------------------------------------------------------------------------------------

  /**
   * The camera the room is seen from, which a dive going in lands on. The world's centre at the floor, as the
   * room coming in through the castle is drawn; but a dive that set out from the room and was turned round
   * goes back to the camera it left, or the room would land somewhere other than where it was showing.
   */
  let roomCamera: { center: [number, number]; zoom: number } | null = null;

  /** Where the dive leaves you. Going in, that is the room; coming out, the map at your own seat. */
  const land = (going: Going): void => {
    if (going === 'in') {
      ours = true;
      map.jumpTo(roomCamera ?? { center: [0, 0], zoom: floorZoom(viewport()) });
      ours = false;
      wanted = 1;
      settle({ amount: 1, dive: null });
    } else {
      wanted = 0;
      settle({ amount: 0, dive: null });
    }
    roomCamera = null;
  };

  let railing: number | null = null;
  /** Where the leg of the rail now running began, and when. Turning a dive round begins a new leg. */
  let leg = { from: 0, at: 0 };

  const rail = (): void => {
    railing = null;
    const dive = store.get().dive;
    if (dive === null) {
      return;
    }
    const progress = railFrom(leg.from, dive.going, performance.now() - leg.at);
    settle({ ...store.get(), dive: { ...dive, progress } });
    if (dive.going === 'in' ? progress >= 1 : progress <= 0) {
      land(dive.going);
      return;
    }
    railing = requestAnimationFrame(rail);
  };

  const run = (from: number): void => {
    leg = { from, at: performance.now() };
    railing ??= requestAnimationFrame(rail);
  };

  /**
   * Starts a passage, at once and both ways. Coming out it used to hold under the room until the ground
   * at the seat was painted, for up to 900 milliseconds, which was felt as a stop before the passage rather
   * than as a wait for anything; the map has a coarse copy of the ground everywhere now, and the first fifth
   * of the way out is the picture coming up under the room in any case.
   */
  const dive = (going: Going, seat: { lat: number; lon: number }): void => {
    const view = viewport();
    const end = roomAtTurn(going === 'in' ? sheetAtFloor(view) : sheetOnScreen(seen(map)), view);

    // Whatever MapLibre's wheel was still easing towards stops where it is, rather than creeping on under a
    // picture of itself.
    ours = true;
    map.stop();
    if (going === 'out') {
      const centre = map.getCenter();
      roomCamera = { center: [centre.lng, centre.lat], zoom: map.getZoom() };
      map.jumpTo({ center: [seat.lon, seat.lat], zoom: CAMERA.maxZoom });
    }
    ours = false;

    if (calm()) {
      land(going);
      return;
    }

    const foot = map.project([seat.lon, seat.lat]);
    const started: Dive = {
      going,
      progress: going === 'in' ? 0 : 1,
      // Worked out on the real window, where the castle stands upright, and then carried into the flat
      // one, where the dive's arithmetic is done. At the zoom the wheel left the map at, which is within a
      // hair of the closest, so that nothing moves on the first frame.
      keep: flatPoint(keepAbove({ x: foot.x, y: foot.y }, map.getZoom()), map.getPitch()),
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
    run(started.progress);
  };

  /** Turns a passage round from wherever it has got to, which is the wheel's one say while one is running. */
  const turn = (going: Going): void => {
    const running = store.get().dive;
    if (running === null || running.going === going) {
      return;
    }
    settle({ ...store.get(), dive: { ...running, going } });
    run(running.progress);
    note('room', going === 'in' ? 'turned back: into the room again' : 'turned back: out to the map again');
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
    const amount = calm() ? wanted : easeTowards(store.get().amount, wanted, elapsed, SETTLE_MS);
    if (amount !== store.get().amount) {
      settle({ ...store.get(), amount });
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

    // On the rail the wheel has one thing to say, which is which way: against the passage it turns it round,
    // and with it there is nothing to add. It is swallowed rather than handed back either way, because
    // handing it back would zoom a map that is under a picture of itself.
    if (store.get().dive !== null) {
      event.preventDefault();
      event.stopPropagation();
      if (event.deltaY !== 0) {
        turn(event.deltaY > 0 ? 'out' : 'in');
      }
      return;
    }

    const out = event.deltaY > 0;
    const zoom = map.getZoom();
    const view = viewport();

    if (store.get().amount === 0 && wanted === 0) {
      if (out && atTheEnd(zoom, floorZoom(view))) {
        // The pull starts with this wheel, not the first one after the map has landed on its floor, and
        // MapLibre's own ease is stopped a hair above the floor rather than left to creep on under the pull.
        ours = true;
        map.stop();
        ours = false;
        said = false;
        note('room', `off the desk: ${span().toFixed(2)} zoom levels of pull to the turn`);
      } else if (event.deltaY < 0 && atTheEnd(zoom, CAMERA.maxZoom)) {
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
    if (store.get().dive === null) {
      release('back on the desk');
    }
  };

  // The floor moves with the window, so a pull measured against the old one is a lie; and a dive is
  // anchored to a castle that is no longer where it was, so it is landed rather than carried over.
  const onResize = (): void => {
    const { dive } = store.get();
    if (dive !== null) {
      stopRail();
      land(dive.going);
      return;
    }
    release(null);
  };

  const onMoveStart = (): void => {
    if (!ours && store.get().dive === null) {
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
    settle(still);
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
