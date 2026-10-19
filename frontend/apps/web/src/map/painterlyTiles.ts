import { addProtocol } from 'maplibre-gl';
import type { Lattice } from '@villages/world';
import { note } from '../log/log';
import { KEPT_TO_ZOOM, MOST_AHEAD, RING, aroundAsked, wayOut } from './lookAhead';
import { PAINTED_TILE, PER_TILE, type PaintReply, type PaintRequest } from './painterlyMessages';
import { PaintQueue } from './paintQueue';
import type { QueuedJob } from './paintQueue';
import { forgetTally, requests, tally } from './paintTally';
import type { PaintedTally } from './paintTally';

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
 * Painted tiles kept as pixels, about a hundred and ten megabytes of them whatever size a tile is.
 *
 * It has to hold the view and everything painted around it at once, or looking ahead evicts the very
 * tiles it just painted. At 256 pixels a flat screenful and its ring was around a hundred and seventy.
 *
 * It was two hundred, which left thirty spare, and then the camera learnt to tip. An orthographic tilt
 * at sixty degrees covers exactly twice the ground - that is what a half-cosine means - so a screenful
 * became about three hundred and forty against a cap of two hundred, and the thing the number was chosen
 * to prevent happened: the looking-ahead evicted what it had just painted, every pan found nothing ready,
 * and a fast zoom out was worst of all because the coarser tiles it needed had been thrown away on the
 * way in. Four hundred and fifty held a tilted screenful and its ring with room to spare, and a flat one
 * twice over. Adam felt it before it was measured. See experiment 0008.
 *
 * Then the tiles grew to 512 pixels, four times the ground each, so the same ground is a quarter of the
 * tiles and the same memory: four hundred and fifty 256-pixel tiles is a hundred and twelve 512-pixel ones.
 */
const REMEMBER = Math.round(450 / PER_TILE);

/** How long the map has to be still before anything is painted ahead of being asked for. */
const QUIET_MS = 180;

/** A painted tile, four bytes a pixel. Its buffer is the one transferred out of a painter. */
type Pixels = Uint8ClampedArray<ArrayBuffer>;

interface Pending {
  settle: (pixels: ArrayBuffer) => void;
  fail: (error: Error) => void;
}

const pending = new Map<number, Pending>();
/** Tiles already painted, by style and address. Pixels, not bitmaps: MapLibre closes a bitmap it uploads. */
const painted = new Map<string, Pixels>();
/**
 * Tiles from `KEPT_TO_ZOOM` out, which are kept for good rather than in `painted`, where the oldest go: those of the
 * style and the lattice painted last, so that changing the renderer or turning the lattice lets the old ones go.
 */
const kept = new Map<string, Pixels>();
let keptLook = '';
const held = (key: string): Pixels | undefined => painted.get(key) ?? kept.get(key);
let painters: Worker[] = [];
/** How many tiles each painter has been given and not yet answered. */
const inFlight: number[] = [];
let nextId = 1;

export function paintedTally(): PaintedTally {
  return { ...tally, held: painted.size + kept.size };
}

/**
 * Whether the store has ever been full enough to start throwing tiles away.
 *
 * Said once, because it is the one thing about the store worth interrupting for: while there is room,
 * every tile painted ahead is still there when the map asks for it, and once there is not, a pan can
 * evict what it is about to want. It is how to tell whether `REMEMBER` is big enough for the camera
 * being used without reading a counter nobody displays. See decision record 0023 and experiment 0008.
 */
let crowded = false;

/**
 * Tiles given up on since the map last came to rest, said in one line when it does.
 *
 * Only when there were some, which on a pan is rarely and on a fast zoom out is nearly always: a zoom out
 * asks for a screenful at every level it passes and wants only the last. The number is the work that used
 * to be done anyway, in front of the tiles on screen. See decision record 0023 and experiment 0008.
 */
let droppedSinceRest = 0;

/** Starts the counting again, so a single movement can be measured on its own. */
export function forgetPaintedTally(): void {
  forgetTally();
  crowded = false;
}

if (import.meta.env.DEV) {
  (window as unknown as { villagesPainterly?: () => PaintedTally }).villagesPainterly = paintedTally;
}

const addressOf = (request: PaintRequest): string =>
  `${request.style}/${request.latticeTurn}/${request.latticeSize}/${request.zoom}/${request.x}/${request.y}`;

function remember(request: PaintRequest, key: string, pixels: Pixels): void {
  if (request.zoom <= KEPT_TO_ZOOM) {
    const look = `${request.style}/${request.latticeTurn}/${request.latticeSize}`;
    if (look !== keptLook) {
      kept.clear();
      keptLook = look;
    }
    kept.set(key, pixels);
    return;
  }
  if (painted.size >= REMEMBER) {
    if (!crowded) {
      crowded = true;
      note(
        'paint',
        `the tile store is full at ${REMEMBER} and is now throwing painted tiles away to make room`,
      );
    }
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
        tally.painted += 1;
        tally.terrainMs += event.data.terrainMs ?? 0;
        tally.paintMs += event.data.paintMs ?? 0;
        waiting?.settle(event.data.pixels);
      }
      dispatch();
    });
    return painter;
  });
  return painters;
}

/**
 * How many tiles a painter holds at once: the one under its brush and the next.
 *
 * A tile handed to a painter cannot be taken back, so this is also how much abandoned work there can be:
 * two a painter rather than everything MapLibre ever asked for. One would be tighter still, but a painter
 * that finishes would then wait for the main thread to notice and hand it the next, and during a zoom the
 * main thread is busy drawing - a frame of idleness a tile is a fifth of the painting thrown away.
 */
const DEPTH = 2;

/** One tile somebody wants painted, from being asked for until its pixels arrive. */
interface Job extends QueuedJob {
  request: PaintRequest;
  pixels: Promise<Pixels>;
  settle: (pixels: Pixels) => void;
  fail: (error: Error) => void;
}

/**
 * The tiles being waited on, and the rules for which to start and which to give up on. The rules live in
 * `paintQueue.ts`, where they can be tested without a worker; this file is only the wiring.
 */
const queue = new PaintQueue<Job>(DEPTH);

function newJob(request: PaintRequest, key: string): Job {
  let settle: (pixels: Pixels) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const pixels = new Promise<Pixels>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  // Nobody may be listening by the time a dropped or failed job says so, and that is not an error.
  pixels.catch(() => undefined);
  return { request, key, zoom: request.zoom, state: 'waiting', wantedBy: 0, pixels, settle, fail };
}

/** Posts a job to a painter. From here it will be painted whatever happens. */
function start(job: Job, to: number): void {
  const painter = pool()[to]!;
  job.request.id = nextId;
  nextId += 1;
  inFlight[to] = (inFlight[to] ?? 0) + 1;
  pending.set(job.request.id, {
    settle: (buffer) => {
      const pixels = new Uint8ClampedArray(buffer);
      remember(job.request, job.key, pixels);
      queue.finish(job);
      job.settle(pixels);
    },
    fail: (error) => {
      queue.finish(job);
      job.fail(error);
    },
  });
  painter.postMessage(job.request);
}

/**
 * Hands out work to whichever painters have room, and is the only thing that does.
 *
 * Tiles the map is waiting for go first, newest first, to any painter holding fewer than `DEPTH`. Tiles
 * painted on speculation go only to a painter holding nothing at all and only when no wanted tile is
 * waiting, which is the whole safety of looking ahead: a tile the map is actually waiting for is never
 * queued behind one that nobody has asked for. Those around where the map rests go before the way out.
 */
function dispatch(): void {
  for (let next = queue.next(inFlight); next !== null; next = queue.next(inFlight)) {
    start(next.job, next.painter);
  }
  if (!queue.anyWaiting) {
    speculate(ahead);
    speculate(later);
  }
}

/** Gives each painter holding nothing the first of `from` that is neither painted nor being painted. */
function speculate(from: PaintRequest[]): void {
  const available = pool();
  for (let index = 0; index < available.length && from.length > 0; index += 1) {
    if ((inFlight[index] ?? 0) !== 0) {
      continue;
    }
    const next = from.shift();
    if (next === undefined) {
      break;
    }
    const key = addressOf(next);
    if (held(key) !== undefined || queue.has(key)) {
      index -= 1;
      continue;
    }
    const job = newJob(next, key);
    queue.track(job);
    tally.aheadPainted += 1;
    start(job, index);
  }
}

/**
 * The pixels of one tile, painted or already held, for one of MapLibre's requests.
 *
 * Gives up the moment MapLibre does. If nobody else wants the tile and no painter has it yet, it is taken
 * out of the queue and never painted; if a painter has it, it is finished and kept. Either way MapLibre is
 * answered at once, rather than after a paint it no longer wants - an answer it was holding a request
 * open for, while the tiles for where the map actually is waited their turn.
 */
function wantPixels(request: PaintRequest, signal: AbortSignal): Promise<Pixels> {
  const key = addressOf(request);
  requests.asked += 1;
  const there = held(key);
  if (there !== undefined) {
    requests.ended += 1;
    return Promise.resolve(there);
  }

  let job = queue.find(key);
  if (job === undefined) {
    job = newJob(request, key);
    queue.enqueue(job);
  }
  const mine = job;
  mine.wantedBy += 1;

  return new Promise<Pixels>((settle, fail) => {
    // A request ends once, whichever comes first - the pixels or MapLibre giving up - and whichever comes
    // second is ignored, or a request that gave up and then saw its tile finish would be counted off twice.
    let ended = false;
    const end = (): boolean => {
      if (ended) {
        return false;
      }
      ended = true;
      requests.ended += 1;
      signal.removeEventListener('abort', giveUp);
      return true;
    };
    function giveUp(): void {
      if (!end()) {
        return;
      }
      if (queue.giveUp(mine)) {
        tally.dropped += 1;
        droppedSinceRest += 1;
      }
      fail(new DOMException('the tile was no longer wanted', 'AbortError'));
    }
    if (signal.aborted) {
      giveUp();
      return;
    }
    signal.addEventListener('abort', giveUp, { once: true });
    mine.pixels.then(
      (pixels) => {
        if (end()) {
          settle(pixels);
        }
      },
      (error: unknown) => {
        if (end()) {
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      },
    );
    dispatch();
  });
}

/** Addresses MapLibre has asked for lately. What is around these is what it will ask for next. */
const wanted = new Map<string, PaintRequest>();
let ahead: PaintRequest[] = [];
/** The way out from where the game starts, painted after everything else. See `paintTheWayOut`. */
let later: PaintRequest[] = [];
/** The last tile MapLibre asked for, whose style and lattice a tile painted unasked is painted in. */
let lastAsked: PaintRequest | null = null;
let quiet: ReturnType<typeof setTimeout> | undefined;

/** Works out what the map will want next, once it has stopped moving: `aroundAsked` in `lookAhead.ts`. */
function lookAhead(): void {
  quiet = undefined;
  if (droppedSinceRest > 0) {
    note(
      'paint',
      `that movement gave up on ${droppedSinceRest} tile${droppedSinceRest === 1 ? '' : 's'} before a painter reached ${droppedSinceRest === 1 ? 'it' : 'them'}, so ${droppedSinceRest === 1 ? 'it was' : 'they were'} never painted`,
    );
    droppedSinceRest = 0;
  }
  ahead = [];
  for (const { from, at } of aroundAsked([...wanted.values()], RING)) {
    const next: PaintRequest = { ...from, id: 0, tiles: tilesRoot, ...at };
    const key = addressOf(next);
    if (held(key) === undefined && !queue.has(key) && !wanted.has(key)) {
      ahead.push(next);
    }
    if (ahead.length >= MOST_AHEAD) {
      break;
    }
  }
  wanted.clear();
  dispatch();
}

/**
 * Paints the way out from where the game starts, once it has: the tiles a zoom out from this camera will ask for,
 * the nearest zoom first, after everything the map is waiting for or will want around where it rests. Those from
 * `KEPT_TO_ZOOM` out are kept for good once painted. See `wayOut` in `lookAhead.ts`.
 */
export function paintTheWayOut(view: Parameters<typeof wayOut>[0]): void {
  const like = lastAsked;
  if (like === null) {
    return;
  }
  later = wayOut(view).map((at) => ({ ...like, id: 0, tiles: tilesRoot, ...at }));
  const keeping = later.filter((one) => one.zoom <= KEPT_TO_ZOOM).length;
  note(
    'paint',
    `painting the way out ahead of the camera: ${later.length} tiles from zoom ${later[0]?.zoom ?? 0} out, the ${keeping} from zoom ${KEPT_TO_ZOOM} out kept for good`,
  );
  dispatch();
}

/**
 * The URL template a raster source uses to ask for a painted tile in one of the styles.
 *
 * The lattice is in the address rather than beside it, which is what makes turning it safe: a different
 * lattice is a different URL, so MapLibre asks afresh and nothing painted on the old one is handed back.
 * It is the same reasoning as the style being in there. See experiment 0008.
 */
export function painterlyTiles(style: string, lattice: Lattice): string {
  return `${SCHEME}://${style}/${lattice.turn}/${lattice.size}/{z}/{x}/{y}`;
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
    const parts = /^painterly:\/\/([^/]+)\/([\d.]+)\/([\d.]+)\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    if (parts === null) {
      throw new Error(`${params.url} is not a painterly tile`);
    }
    const request: PaintRequest = {
      id: 0,
      style: parts[1]!,
      tiles: tilesRoot,
      latticeTurn: Number(parts[2]),
      latticeSize: Number(parts[3]),
      zoom: Number(parts[4]),
      x: Number(parts[5]),
      y: Number(parts[6]),
    };

    wanted.set(addressOf(request), request);
    lastAsked = request;
    if (quiet !== undefined) {
      clearTimeout(quiet);
    }
    quiet = setTimeout(lookAhead, QUIET_MS);

    if (held(addressOf(request)) !== undefined) {
      tally.ready += 1;
    } else {
      tally.waited += 1;
    }

    const pixels = await wantPixels(request, abortController.signal);
    return { data: await createImageBitmap(new ImageData(pixels, PAINTED_TILE, PAINTED_TILE)) };
  });
}
