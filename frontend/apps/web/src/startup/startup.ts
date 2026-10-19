import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';
import type * as maplibregl from 'maplibre-gl';

import { FOUNDING_ZOOM } from '../house/arrival';
import { inHandStore } from '../loading/inHand';
import { note } from '../log/log';
import { paintedRequests } from '../map/paintTally';
import { sessionStore } from '../net/gateway';
import { startAtIn } from '../net/startAt';
import { LONGEST_MS, nextStep, shareDrawn } from './rules';

/**
 * The game starting up: the loading screen over the game from its first frame, the camera put where the player starts
 * while it is up, and the screen lifted once the map is drawn there. The rule is `rules.ts`; this is its wiring to
 * the map, the session and the work in hand. Once a page load, and never again: a reconnect does not cover the game.
 */
export interface Startup {
  readonly lifted: boolean;
  /** How far along the drawing is, nought to one, once the camera has been put; nothing before. */
  readonly share?: number;
  /** The same in words, for a screen reader. */
  readonly shareSaid?: string;
}

// A module run again by the dev server long after the page opened starts lifted, rather than covering the game anew.
const startup = createStore<Startup>({ lifted: performance.now() >= LONGEST_MS });

export const startupStore: Readable<Startup> = startup;

// The limit holds whether or not a map ever comes to be watched: a map that never has its style lifts the screen too.
if (!startup.get().lifted) {
  globalThis.setTimeout(() => {
    if (!startup.get().lifted) {
      startup.set({ lifted: true });
      note('startup', `lifted at the ${seconds(LONGEST_MS)} limit, before the map had its style`);
    }
  }, LONGEST_MS - performance.now());
}

/** How often the screen looks again while nothing tells it to: for its meter, and for the waits it keeps. */
const LOOK_EVERY_MS = 200;

const WHERE_IT_OPENED = 'where the page opened';

/**
 * Watches the map from when it has its style until the screen lifts, and puts the camera where the player starts.
 * Returns what stops it watching.
 */
export function watchStartup(map: maplibregl.Map): () => void {
  if (startup.get().lifted) {
    return () => undefined;
  }
  const mapReadyAt = performance.now();
  const linked = startAtIn(globalThis.location.search) !== null;
  let placed: string | null = null;
  let placedAt = 0;
  let drawn = false;
  let since = paintedRequests();
  let share = 0;

  const wanted = (): string => {
    const seat = sessionStore.get().yourHouse?.house.seat;
    return linked || seat === undefined
      ? WHERE_IT_OPENED
      : `the seat at ${seat.lat.toFixed(3)}, ${seat.lon.toFixed(3)}`;
  };

  // Said put before it moves: the camera moving asks the gateway for other cells, and the session changing at that
  // looks again at once, which would otherwise see the camera not yet put and put it again.
  const place = (where: string): void => {
    placed = where;
    placedAt = performance.now();
    drawn = false;
    since = paintedRequests();
    share = 0;
    note('startup', `the camera put at ${where}, ${seconds(placedAt)} after the page opened`);
    const seat = sessionStore.get().yourHouse?.house.seat;
    if (where !== WHERE_IT_OPENED && seat !== undefined) {
      map.jumpTo({ center: [seat.lon, seat.lat], zoom: Math.max(map.getZoom(), FOUNDING_ZOOM) });
    }
    // Drawn again whether or not it moved, so the map says once more when it has nothing left to draw.
    map.triggerRepaint();
  };

  const lift = (cutShort: boolean): void => {
    stop();
    startup.set({ lifted: true, share: 1, shareSaid: 'drawn' });
    const now = performance.now();
    if (!cutShort) {
      note(
        'startup',
        `the map was drawn ${seconds(now)} after the page opened, ${seconds(now - placedAt)} after the camera was put at ${placed}`,
      );
      return;
    }
    const works = [...new Set(inHandStore.get().works)];
    const why = [
      placed === null ? 'before the camera was put' : `${seconds(now - placedAt)} after the camera was put`,
      ...(drawn ? [] : ['the map still drawing']),
      ...(works.length === 0 ? [] : [`still in hand: ${works.join(', ')}`]),
    ];
    note('startup', `lifted at the ${seconds(LONGEST_MS)} limit, ${why.join(', ')}`);
  };

  const look = (): void => {
    if (startup.get().lifted) {
      stop();
      return;
    }
    const step = nextStep({
      now: performance.now(),
      mapReadyAt,
      houseHeard: sessionStore.get().houseHeard,
      wanted: wanted(),
      placed,
      drawn,
      inHand: inHandStore.get().works.length,
    });
    if (step.step === 'lift') {
      lift(step.cutShort);
      return;
    }
    if (step.step === 'place') {
      place(wanted());
    }
    if (placed !== null) {
      const now = paintedRequests();
      share = shareDrawn(share, now.ended - since.ended, now.asked - now.ended, drawn);
      if (share !== startup.get().share) {
        startup.set({ share, shareSaid: `${Math.round(share * 100)} in a hundred of the map drawn` });
      }
    }
  };

  const idle = (): void => {
    if (placed !== null && !drawn) {
      drawn = true;
      look();
    }
  };

  map.on('idle', idle);
  const unwatchSession = sessionStore.watch(look);
  const unwatchInHand = inHandStore.watch(look);
  const ticking = globalThis.setInterval(look, LOOK_EVERY_MS);
  look();
  return stop;

  function stop(): void {
    map.off('idle', idle);
    unwatchSession();
    unwatchInHand();
    globalThis.clearInterval(ticking);
  }
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
