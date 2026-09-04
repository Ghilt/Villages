import { addProtocol } from 'maplibre-gl';
import { note } from '../debug/log';
import { TILE } from './painterlyMessages';
import type { PaintReply, PaintRequest } from './painterlyMessages';
import { WORLD_MAX_ZOOM } from './worldStyle';

/**
 * The painterly renderer's front door: a URL scheme MapLibre can ask for tiles on, a pool of workers that
 * paint them, and a store of the ones already painted.
 *
 * Everything MapLibre is good at stays MapLibre's job, which is knowing what is visible, when to fetch it,
 * and drawing it under the camera. All that happens here is that the answer to a tile request is painted
 * instead of downloaded. See docs/adr/0022.
 *
 * Two things make that bearable to look at. It is painted in workers, because a tile is tens of
 * milliseconds of arithmetic in one uninterruptible loop and on the main thread that is a dropped frame
 * per tile. And the tiles just outside the view are painted during the pauses, so that panning finds them
 * already done: without that, moving the map shows the flat terrain first and the painted version a third
 * of a second later, and watching land change its appearance under you is worse than waiting for it.
 */

const SCHEME = 'painterly';

/**
 * A cap on the painters, because each holds its own cache of decoded terrain, so more of them means more
 * memory and more of the same terrain decoded twice over. Half the cores, up to four.
 *
 * Six was tried on a twenty core machine and measured the same as four, so four it is. Painting is not
 * what a screenful of tiles waits on once it is off the main thread.
 */
const MOST_PAINTERS = 4;

/**
 * Painted tiles kept as pixels, at a quarter of a megabyte each, so this is about forty megabytes.
 *
 * It has to hold the view and everything painted around it at once, or looking ahead evicts the very
 * tiles it just painted. A screenful at this depth of ring is around a hundred and seventy tiles.
 */
const REMEMBER = 200;

/** How long the map has to be still before anything is painted ahead of being asked for. */
const QUIET_MS = 180;

/**
 * How deep a ring around the view to paint ahead, in tiles.
 *
 * One was tried and left half the tiles of a screen-sized pan still to paint, because a pan of a whole
 * screen moves two to three tiles. Two covers it.
 */
const RING = 2;

/** A bound on how much to paint ahead, so a fast pan cannot queue up a thousand tiles. */
const MOST_AHEAD = 140;

/** A painted tile, four bytes a pixel. Its buffer is the one transferred out of a painter. */
type Pixels = Uint8ClampedArray<ArrayBuffer>;

interface Pending {
  settle: (pixels: ArrayBuffer) => void;
  fail: (error: Error) => void;
}

const pending = new Map<number, Pending>();
/** Tiles already painted, by style and address. Pixels, not bitmaps: MapLibre closes a bitmap it uploads. */
const painted = new Map<string, Pixels>();
let painters: Worker[] = [];
/** How many tiles each painter has been given and not yet answered. */
const inFlight: number[] = [];
let nextId = 1;

/**
 * How well the looking ahead is working: of the tiles the map asked for, how many were already painted.
 *
 * Ready is the number that decides how this feels, because a tile that is not ready is a tile the eye
 * catches arriving. It does not show up in a profile, so it is counted here and shown in the debug panel.
 */
const tally = { ready: 0, waited: 0, aheadPainted: 0 };

export interface PaintedTally {
  ready: number;
  waited: number;
  aheadPainted: number;
  /** How many painted tiles are being kept, against the cap. */
  held: number;
}

export function paintedTally(): PaintedTally {
  return { ...tally, held: painted.size };
}

/** Starts the counting again, so a single movement can be measured on its own. */
export function forgetPaintedTally(): void {
  tally.ready = 0;
  tally.waited = 0;
  tally.aheadPainted = 0;
}

if (import.meta.env.DEV) {
  (window as unknown as { villagesPainterly?: () => PaintedTally }).villagesPainterly = paintedTally;
}

const addressOf = (request: PaintRequest): string =>
  `${request.style}/${request.zoom}/${request.x}/${request.y}`;

function remember(key: string, pixels: Pixels): void {
  if (painted.size >= REMEMBER) {
    const oldest = painted.keys().next();
    if (oldest.done !== true) {
      painted.delete(oldest.value);
    }
  }
  painted.set(key, pixels);
}

function pool(): Worker[] {
  if (painters.length > 0) {
    return painters;
  }
  const cores = navigator.hardwareConcurrency ?? 4;
  const count = Math.max(1, Math.min(MOST_PAINTERS, Math.floor(cores / 2)));

  painters = Array.from({ length: count }, (_unused, index) => {
    inFlight[index] = 0;
    const painter = new Worker(new URL('./painterlyWorker.ts', import.meta.url), { type: 'module' });
    painter.addEventListener('message', (event: MessageEvent<PaintReply>) => {
      inFlight[index] = Math.max(0, (inFlight[index] ?? 1) - 1);
      const waiting = pending.get(event.data.id);
      pending.delete(event.data.id);
      if (event.data.pixels === undefined) {
        const why = event.data.error ?? 'the painter gave no reason';
        note('paint', `a tile failed: ${why}`);
        waiting?.fail(new Error(why));
      } else {
        waiting?.settle(event.data.pixels);
      }
      paintAhead();
    });
    return painter;
  });
  return painters;
}

/**
 * Which painter gets a tile: whichever has least in hand.
 *
 * Sending neighbouring tiles to the same painter was tried first, so that it would already hold the
 * decoded terrain they share. It measured the same, and it has a fault this does not: past zoom seven
 * every tile on the screen has the same ancestor, so a whole screen would go to one painter.
 */
function leastBusy(): number {
  let chosen = 0;
  for (let index = 1; index < inFlight.length; index += 1) {
    if (inFlight[index]! < inFlight[chosen]!) {
      chosen = index;
    }
  }
  return chosen;
}

/** Sends one tile to a painter and resolves with its pixels. */
function commission(request: PaintRequest, to: number): Promise<ArrayBuffer> {
  const available = pool();
  const painter = available[to]!;
  inFlight[to] = (inFlight[to] ?? 0) + 1;
  return new Promise<ArrayBuffer>((settle, fail) => {
    pending.set(request.id, { settle, fail });
    painter.postMessage(request);
  });
}

/** Paints one tile, or hands back the one already painted, and never paints the same tile twice at once. */
function pixelsFor(request: PaintRequest, to: number): Promise<Pixels> {
  const key = addressOf(request);
  const held = painted.get(key);
  if (held !== undefined) {
    return Promise.resolve(held);
  }
  const already = inProgress.get(key);
  if (already !== undefined) {
    return already;
  }

  request.id = nextId;
  nextId += 1;
  const started = commission(request, to)
    .then((buffer) => {
      const pixels = new Uint8ClampedArray(buffer);
      remember(key, pixels);
      return pixels;
    })
    .finally(() => {
      inProgress.delete(key);
    });
  inProgress.set(key, started);
  return started;
}

const inProgress = new Map<string, Promise<Pixels>>();
/** Addresses MapLibre has asked for lately. What is around these is what it will ask for next. */
const wanted = new Map<string, PaintRequest>();
let ahead: PaintRequest[] = [];
let quiet: ReturnType<typeof setTimeout> | undefined;

/**
 * Works out what the map will want next, once it has stopped moving.
 *
 * Rather than reading the camera and doing the arithmetic, this takes what MapLibre actually asked for and
 * looks around it: the eight tiles beside each one for panning, the four inside it for zooming in, and the
 * one containing it for zooming out. That way the zoom is always the one MapLibre chose, with no guessing.
 */
function lookAhead(): void {
  quiet = undefined;
  const around: PaintRequest[] = [];

  const consider = (style: string, zoom: number, x: number, y: number): void => {
    if (zoom < 0 || zoom > WORLD_MAX_ZOOM || around.length >= MOST_AHEAD) {
      return;
    }
    const across = 2 ** zoom;
    if (x < 0 || x >= across || y < 0 || y >= across) {
      return;
    }
    const key = `${style}/${zoom}/${x}/${y}`;
    if (painted.has(key) || inProgress.has(key) || wanted.has(key)) {
      return;
    }
    around.push({ id: 0, style, tiles: tilesRoot, zoom, x, y });
  };

  // Nearest first, so that what is painted ahead is what a small movement reaches first.
  for (let ring = 1; ring <= RING; ring += 1) {
    for (const request of wanted.values()) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        for (let dx = -ring; dx <= ring; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) {
            consider(request.style, request.zoom, request.x + dx, request.y + dy);
          }
        }
      }
    }
  }
  for (const request of wanted.values()) {
    consider(request.style, request.zoom + 1, request.x * 2, request.y * 2);
    consider(request.style, request.zoom + 1, request.x * 2 + 1, request.y * 2);
    consider(request.style, request.zoom + 1, request.x * 2, request.y * 2 + 1);
    consider(request.style, request.zoom + 1, request.x * 2 + 1, request.y * 2 + 1);
    // Zooming out asks for the tile containing this one; two out as well, so that there is always a
    // coarse painted version for MapLibre to stretch while a sharp one is still being painted.
    consider(request.style, request.zoom - 1, request.x >> 1, request.y >> 1);
    consider(request.style, request.zoom - 2, request.x >> 2, request.y >> 2);
  }

  wanted.clear();
  ahead = around;
  paintAhead();
}

/**
 * Hands out the tiles painted on speculation, and only to a painter with nothing in hand.
 *
 * That condition is the whole safety of the idea: a tile the map is actually waiting for is never queued
 * behind one that nobody has asked for.
 */
function paintAhead(): void {
  if (ahead.length === 0) {
    return;
  }
  const available = pool();
  for (let index = 0; index < available.length && ahead.length > 0; index += 1) {
    if ((inFlight[index] ?? 0) !== 0) {
      continue;
    }
    const next = ahead.shift();
    if (next !== undefined) {
      tally.aheadPainted += 1;
      void pixelsFor(next, index).catch(() => undefined);
    }
  }
}

/** The URL template a raster source uses to ask for a painted tile in one of the styles. */
export function painterlyTiles(style: string): string {
  return `${SCHEME}://${style}/{z}/{x}/{y}`;
}

let registered = false;
/**
 * Where the flat tiles the paint reads come from, which is to say which master is being drawn.
 *
 * Set once, before a map exists, and never changed: switching master reloads the page. Changing it in
 * place would leave every painted tile in the store, and every decoded tile in every painter, holding
 * terrain from the master before it.
 */
let tilesRoot = '/world/masters/terrain';

/** Teaches MapLibre the `painterly://` scheme. Called once, before a map is built. */
export function registerPainterlyTiles(worldRoot: string): void {
  if (registered) {
    return;
  }
  registered = true;
  tilesRoot = worldRoot;

  addProtocol(SCHEME, async (params, abortController) => {
    const parts = /^painterly:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    if (parts === null) {
      throw new Error(`${params.url} is not a painterly tile`);
    }
    const request: PaintRequest = {
      id: 0,
      style: parts[1]!,
      tiles: tilesRoot,
      zoom: Number(parts[2]),
      x: Number(parts[3]),
      y: Number(parts[4]),
    };

    wanted.set(addressOf(request), request);
    if (quiet !== undefined) {
      clearTimeout(quiet);
    }
    quiet = setTimeout(lookAhead, QUIET_MS);

    if (painted.has(addressOf(request))) {
      tally.ready += 1;
    } else {
      tally.waited += 1;
    }

    const pixels = await pixelsFor(request, leastBusy());
    // The paint is kept either way: a tile that scrolled off screen has usually only just scrolled off,
    // and asking for it again is free now.
    if (abortController.signal.aborted) {
      throw new DOMException('the tile was no longer wanted', 'AbortError');
    }
    return { data: await createImageBitmap(new ImageData(pixels, TILE, TILE)) };
  });
}
