import { cpus } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Browser, Page } from '@playwright/test';

import { readZoomPoints } from '../apps/web/src/admin/performance/zoomPoints.ts';
import type { Pacing, ZoomPoint, Zoomed } from '../apps/web/src/admin/performance/zoomPoints.ts';
import { HERE, argsOf } from './args.ts';
import { chromeOnTheCard } from './chrome.ts';
import { besideSaid } from './compare.ts';
import { startServers } from './devServer.ts';
import { METHOD, codeOf, keep, keptFile, lastLike, readKept } from './kept.ts';
import { findSetters } from './levels.ts';
import { cardToMeasureOn } from './machine.ts';
import { liftFog, readLevels } from './page.ts';
import { placesNamed } from './places.ts';
import type { Place } from './places.ts';
import { percentile } from './stats.ts';
import { LATE_MS, slowestFrames } from './slowFrames.ts';
import type { TimedProfile } from './slowFrames.ts';
import { compiledOf, spanOf, spentIn } from './startupStats.ts';
import { watchStartup } from './startupWatch.ts';
import type { Watched } from './startupWatch.ts';
import { middleByLate, middleZoom, said, slowestSaid, zoomBeside } from './zoomReading.ts';

/**
 * How smoothly the camera comes in from far out, and where the time goes while it does: over ground thick with
 * sprites - the forest - over grassland, and over bare ice, so that what the sprites cost a zoom is the forest's
 * against the ice's. Adam's word of 2026-10-20: zooming into ground thick with foliage is less pleasant than into bare
 * ground. Each zoom on a fresh page of its own, the fog lifted and the shaders as a player has them, settled at zoom
 * 5 and then flown to 10 over four seconds, the way a few turns of the wheel take it, and watched three seconds more
 * while what came settles. See decision record 0106.
 *
 * And the crossing into the real world at zoom 7.5, where the trees, the roads and everything standing arrive at once,
 * over the busiest ground, `settled`: settled at zoom 7 and flown to 8.2 over a second and a half. Adam's word of
 * 2026-10-22: with the fog lifted over a busy place the crossing stutters, and it should be smooth. Every zoom and
 * crossing keeps its slowest frames and what ran in each (`slowFrames.ts`). And then the pan: settled at zoom 8.5
 * over the same ground, the real world already in, and panned two screens east over four seconds, a brisk drag, which
 * is where a roadside or a wood laid out again whole is felt and a single crossing hardly shows it (Adam's word of
 * 2026-10-22). See `docs/plans/smooth-crossing-into-the-real-world.md`.
 *
 *   npm run perf:zoom --prefix frontend -- [--places forest,ice] [--crossing settled] [--only zoom|crossing|pan]
 *     [--rounds 3] [--tree <dir>] [--compare] [--record] [--why to-main|history|by-hand] [--headed] [--anyway]
 *
 * `--compare` puts the run beside the last point kept that was measured alike, and says what moved. `--only` measures
 * the zooms, the crossing or the pan alone, for a hand-over's comparison; a point kept measures them all.
 */

const VIEWPORT = { width: 1920, height: 1080 };
/** A flight of the camera: settled at one zoom, then flown to another over so many milliseconds. */
interface Flight {
  from: number;
  to: number;
  ms: number;
  /** How far the camera is panned east, in screen pixels, for a pan rather than a zoom. */
  east?: number;
}
const ZOOM: Flight = { from: 5, to: 10, ms: 4_000 };
/** Across `BECOMES_A_MARK_AT` and its stickiness (`sprites/twoForms.ts`), stopping where the view is widest. */
const CROSSING: Flight = { from: 7, to: 8.2, ms: 1_500 };
/** Two screens east at zoom 8.5, the real world in, over four seconds. */
const PAN: Flight = { from: 8.5, to: 8.5, ms: 4_000, east: 2 * VIEWPORT.width };
const AFTER_MS = 3_000;
const { option, flag, tree, why, stamp } = argsOf(process.argv.slice(2));
const places = placesNamed((option('places') ?? 'forest,grassland,ice').split(',').filter(Boolean));
const crossingPlace = placesNamed([option('crossing') ?? 'settled'])[0]!;
const only = option('only');
if (only !== undefined && only !== 'zoom' && only !== 'crossing' && only !== 'pan') {
  throw new Error(`--only is zoom, crossing or pan, not ${only}`);
}
const measures = (what: 'zoom' | 'crossing' | 'pan') => only === undefined || only === what;
if (only !== undefined && flag('record')) {
  throw new Error('a point kept measures the zooms and the crossing both, so --record takes no --only');
}
const rounds = Number(option('rounds') ?? 3);
const logs = join(HERE, '.logs', 'perf');

type MapHandle = {
  style?: { _loaded?: boolean };
  loaded(): boolean;
  areTilesLoaded(): boolean;
  jumpTo(options: { center: [number, number]; zoom: number }): void;
  easeTo(options: { zoom: number; duration: number }): void;
  panBy(offset: [number, number], options: { duration: number }): void;
};
type Win = {
  villagesMap?: MapHandle;
  villagesScenery?: () => { particles: number };
  villagesRoads?: () => { strips: number; roadside: number };
  __startup: Watched;
};

/** How the frames came between two moments: a span of the start's, with the frames a second and the 95th gap. */
function pacing(watched: Watched, from: number, to: number): Pacing {
  const inside = watched.frames.filter((frame) => frame >= from && frame <= to);
  const gaps = inside
    .slice(1)
    .map((frame, i) => frame - inside[i]!)
    .sort((a, b) => a - b);
  return {
    ...spanOf(watched.longTasks, watched.frames, from, to),
    fps: Math.round((inside.length / ((to - from) / 1000)) * 10) / 10,
    p95Gap: Math.round((percentile(gaps, 0.95) || 0) * 10) / 10,
    late: gaps.filter((gap) => gap >= LATE_MS).length,
  };
}

/** Opens the game on a fresh page over a place at a zoom, the panes put away and the fog lifted, and lets it settle. */
async function settledOver(page: Page, url: string, place: Place, zoom: number): Promise<void> {
  // A dev server's first page of an old tree can take more than the default half a minute (2026-10-07's did).
  await page.goto(url, { timeout: 120_000 });
  await page.waitForFunction(
    () => (globalThis as unknown as Win).villagesMap?.style?._loaded === true,
    null,
    {
      timeout: 120_000,
    },
  );
  await page.waitForFunction(() => document.getElementsByTagName('canvas').length >= 2, null, {
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    const press = (label: string) =>
      [...document.querySelectorAll('button')]
        .filter(
          (button) =>
            (button.getAttribute('aria-label') || button.title || button.textContent || '').trim() === label,
        )
        .forEach((button) => button.click());
    press('put away');
    press('minimise to a badge');
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  await liftFog(page);
  await page.evaluate(
    ({ lat, lon, zoom }) => (globalThis as unknown as Win).villagesMap!.jumpTo({ center: [lon, lat], zoom }),
    { lat: place.lat, lon: place.lon, zoom },
  );
  // Settled once the map has had all its tiles for a second and a half running.
  await page.waitForFunction(
    () => {
      const win = globalThis as unknown as Win & { __since?: number };
      const map = win.villagesMap!;
      if (!(map.loaded() && map.areTilesLoaded())) win.__since = undefined;
      else win.__since ??= performance.now();
      return win.__since !== undefined && performance.now() - win.__since > 1_500;
    },
    null,
    { timeout: 60_000, polling: 100 },
  );
}

/** One flight of the camera over a place, on a page of its own. */
async function flyOnce(browser: Browser, url: string, place: Place, flight: Flight): Promise<Zoomed> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await context.addInitScript(watchStartup);
  const page = await context.newPage();
  await settledOver(page, url, place, flight.from);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
  await cdp.send('Profiler.start');
  const began = await page.evaluate(
    ({ zoom, duration, east }) => {
      // Named as `LINE_UP` is, and busy long enough to be sampled: the profile is lined up by where it ends.
      const lineUpTheProfile = () => {
        const until = performance.now() + 5;
        while (performance.now() < until) {
          // Waiting is the point.
        }
        return performance.now();
      };
      const at = lineUpTheProfile();
      const map = (globalThis as unknown as Win).villagesMap!;
      if (east === null) map.easeTo({ zoom, duration });
      else map.panBy([east, 0], { duration });
      return at;
    },
    { zoom: flight.to, duration: flight.ms, east: flight.east ?? null },
  );
  await page.waitForTimeout(flight.ms + AFTER_MS);
  const profile = ((await cdp.send('Profiler.stop')) as { profile: TimedProfile }).profile;
  const { watched, sprites, roads } = await page.evaluate(() => {
    const win = globalThis as unknown as Win;
    return {
      watched: win.__startup,
      sprites: win.villagesScenery?.().particles ?? null,
      roads: win.villagesRoads?.() ?? null,
    };
  });
  await context.close();
  const spent = spentIn(profile);
  const until = began + flight.ms + AFTER_MS;
  return {
    place: place.name,
    lat: place.lat,
    lon: place.lon,
    from: flight.from,
    to: flight.to,
    ms: flight.ms,
    ...(flight.east === undefined ? {} : { east: flight.east }),
    during: pacing(watched, began, began + flight.ms),
    after: pacing(watched, began + flight.ms, until),
    cpu: { busy: spent.busy, gc: spent.gc },
    modules: spent.modules,
    functions: spent.functions,
    sprites,
    roads,
    slowest: slowestFrames(profile, watched.frames, began, until),
    compiles: compiledOf(watched, until),
  };
}

const card = cardToMeasureOn(flag('anyway'));
const servers = await startServers(tree, logs);
const { browser, renderer, headless } = await chromeOnTheCard(flag('headed'));
try {
  // A first page, let go by: the dev server works out every file anew for it, which is the start's to measure.
  const warming = await browser.newContext({ viewport: VIEWPORT });
  const zoomFirst = measures('zoom');
  await settledOver(
    await warming.newPage(),
    servers.url,
    zoomFirst ? places[0]! : crossingPlace,
    zoomFirst ? ZOOM.from : measures('crossing') ? CROSSING.from : PAN.from,
  );
  const levelsPage = warming.pages()[0]!;
  const levels = await readLevels(levelsPage, findSetters(tree));
  await warming.close();

  const compiling = (zoom: Zoomed) =>
    zoom.compiles.map((compile) => `${compile.name} ${compile.ms} ms`).join(', ') || 'nothing waited on';
  const all = new Map<string, Zoomed[]>();
  let firstZoom: Zoomed | null = null;
  if (zoomFirst) {
    // The run's first zoom, cold: the browser compiles the game's programs as the camera first needs them.
    firstZoom = await flyOnce(browser, servers.url, places[0]!, ZOOM);
    console.log(
      `  the first zoom, ${firstZoom.place}: ${Math.round(firstZoom.during.longTasks.total)} ms of long tasks, ` +
        `compiling ${compiling(firstZoom)}`,
    );
    for (let round = 1; round <= rounds; round += 1) {
      for (const place of places) {
        const zoom = await flyOnce(browser, servers.url, place, ZOOM);
        all.set(place.name, [...(all.get(place.name) ?? []), zoom]);
        console.log(
          `  round ${round}, ${place.name}: ${zoom.during.janky} stutters, ${Math.round(zoom.during.longTasks.total)} ms of long tasks`,
        );
      }
    }
  }
  // A flight's first, apart, and then its rounds: the first crossing waits on whatever programs only the real world
  // needs, which no zoom before it compiled.
  const flown = async (name: string, flight: Flight): Promise<{ first: Zoomed; each: Zoomed[] }> => {
    const first = await flyOnce(browser, servers.url, crossingPlace, flight);
    console.log(
      `  the first ${name}, ${first.place}: ${Math.round(first.during.longTasks.total)} ms of long tasks, ` +
        `compiling ${compiling(first)}`,
    );
    const each: Zoomed[] = [];
    for (let round = 1; round <= rounds; round += 1) {
      const one = await flyOnce(browser, servers.url, crossingPlace, flight);
      each.push(one);
      console.log(
        `  round ${round}, the ${name}: ${(one.during.late ?? 0) + (one.after.late ?? 0)} late frames, ` +
          `${one.during.janky + one.after.janky} stutters`,
      );
    }
    return { first, each };
  };
  const crossed = measures('crossing') ? await flown('crossing', CROSSING) : null;
  const panned = measures('pan') ? await flown('pan', PAN) : null;
  const firstCrossing = crossed?.first ?? null;
  const crossings = crossed?.each ?? [];
  const point: ZoomPoint = {
    method: METHOD,
    why,
    measuredAt: new Date().toISOString(),
    code: codeOf(tree),
    machine: {
      gpu: card?.name ?? renderer,
      cpu: `${cpus()[0]?.model.trim() ?? 'a CPU'}, ${cpus().length} threads`,
      chrome: browser.version(),
      viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
    },
    levels,
    firstZoom,
    zooms: zoomFirst ? places.map((place) => middleZoom(all.get(place.name)!)) : [],
    of: rounds,
    firstCrossing,
    crossing: crossings.length === 0 ? null : middleByLate(crossings),
    firstPan: panned?.first ?? null,
    pan: panned === null ? null : middleByLate(panned.each),
  };
  mkdirSync(logs, { recursive: true });
  const file = join(logs, `zoom-${stamp}.json`);
  writeFileSync(
    file,
    `${JSON.stringify({ ...point, all: Object.fromEntries(all), crossings, pans: panned?.each ?? [] }, null, 2)}\n`,
  );

  console.log(`\n${renderer}, ${headless ? 'headless' : 'in a window'}, the middle of ${rounds}`);
  if (firstZoom !== null) {
    console.log(`zoom ${ZOOM.from} to ${ZOOM.to} over ${ZOOM.ms / 1000} s`);
    console.log(`the first zoom, cold: ${said(firstZoom)}\n`);
    for (const zoom of point.zooms) console.log(said(zoom));
  }
  if (point.crossing != null && firstCrossing !== null) {
    console.log(`\nthe crossing, zoom ${CROSSING.from} to ${CROSSING.to} over ${CROSSING.ms / 1000} s`);
    console.log(`the first crossing, cold: ${said(firstCrossing)}\n`);
    console.log(said(point.crossing));
    console.log(`           its slowest frames, and what ran in each:\n${slowestSaid(point.crossing)}`);
  }
  if (point.pan != null && panned !== null) {
    console.log(`\nthe pan, ${PAN.east} pixels east at zoom ${PAN.from} over ${PAN.ms / 1000} s`);
    console.log(`the first pan, cold: ${said(panned.first)}\n`);
    console.log(said(point.pan));
    console.log(`           its slowest frames, and what ran in each:\n${slowestSaid(point.pan)}`);
  }
  if (flag('compare')) {
    const then = lastLike(readZoomPoints(readKept('zoom')).points, point);
    if (then === null) console.log('\nnothing kept to compare with, measured alike');
    else {
      console.log(
        `\nagainst ${then.code.commit.slice(0, 7)}, "${then.code.subject}", measured ${then.measuredAt.slice(0, 10)}:`,
      );
      for (const line of besideSaid(zoomBeside(then, point))) console.log(`  ${line}`);
    }
  }
  if (flag('record')) {
    const kept = keptFile(HERE, 'zoom');
    keep(kept, point);
    console.log(`\nkept in ${kept}`);
  }
  console.log(`\n${file}`);
} finally {
  await browser.close();
  await servers.stop();
}
