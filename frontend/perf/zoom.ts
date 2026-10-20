import { cpus } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Browser, Page } from '@playwright/test';

import { readZoomPoints } from '../apps/web/src/admin/performance/zoomPoints.ts';
import type { Pacing, ZoomPoint, Zoomed } from '../apps/web/src/admin/performance/zoomPoints.ts';
import { HERE, argsOf } from './args.ts';
import { chromeOnTheCard } from './chrome.ts';
import { besideSaid } from './compare.ts';
import type { Beside } from './compare.ts';
import { startServers } from './devServer.ts';
import { METHOD, codeOf, keep, keptFile, lastLike, readKept } from './kept.ts';
import { findSetters } from './levels.ts';
import { cardToMeasureOn } from './machine.ts';
import { liftFog, readLevels } from './page.ts';
import { placesNamed } from './places.ts';
import type { Place } from './places.ts';
import { percentile } from './stats.ts';
import { compiledOf, spanOf, spentIn } from './startupStats.ts';
import type { Profile } from './startupStats.ts';
import { watchStartup } from './startupWatch.ts';
import type { Watched } from './startupWatch.ts';

/**
 * How smoothly the camera comes in from far out, and where the time goes while it does: over ground thick with
 * sprites - the forest - over grassland, and over bare ice, so that what the sprites cost a zoom is the forest's
 * against the ice's. Adam's word of 2026-10-20: zooming into ground thick with foliage is less pleasant than into bare
 * ground. Each zoom on a fresh page of its own, the fog lifted and the shaders as a player has them, settled at zoom
 * 5 and then flown to 10 over four seconds, the way a few turns of the wheel take it, and watched three seconds more
 * while what came settles. See decision record 0106.
 *
 *   npm run perf:zoom --prefix frontend -- [--places forest,ice] [--rounds 3] [--tree <dir>] [--compare] [--record]
 *     [--why to-main|history|by-hand] [--headed] [--anyway]
 *
 * `--compare` puts the run beside the last point kept that was measured alike, and says what moved.
 */

const VIEWPORT = { width: 1920, height: 1080 };
const FROM = 5;
const TO = 10;
const FLYING_MS = 4_000;
const AFTER_MS = 3_000;
const { option, flag, tree, why, stamp } = argsOf(process.argv.slice(2));
const places = placesNamed((option('places') ?? 'forest,grassland,ice').split(',').filter(Boolean));
const rounds = Number(option('rounds') ?? 3);
const logs = join(HERE, '.logs', 'perf');

type MapHandle = {
  style?: { _loaded?: boolean };
  loaded(): boolean;
  areTilesLoaded(): boolean;
  jumpTo(options: { center: [number, number]; zoom: number }): void;
  easeTo(options: { zoom: number; duration: number }): void;
};
type Win = { villagesMap?: MapHandle; villagesScenery?: () => { particles: number }; __startup: Watched };

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
  };
}

/** Opens the game on a fresh page, far out over a place, the panes put away and the fog lifted, and lets it settle. */
async function settledFarOut(page: Page, url: string, place: Place): Promise<void> {
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
    { lat: place.lat, lon: place.lon, zoom: FROM },
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

/** One zoom in over a place, on a page of its own. */
async function zoomOnce(browser: Browser, url: string, place: Place): Promise<Zoomed> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await context.addInitScript(watchStartup);
  const page = await context.newPage();
  await settledFarOut(page, url, place);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
  await cdp.send('Profiler.start');
  const began = await page.evaluate(
    ({ zoom, duration }) => {
      (globalThis as unknown as Win).villagesMap!.easeTo({ zoom, duration });
      return performance.now();
    },
    { zoom: TO, duration: FLYING_MS },
  );
  await page.waitForTimeout(FLYING_MS + AFTER_MS);
  const profile = ((await cdp.send('Profiler.stop')) as { profile: Profile }).profile;
  const { watched, sprites } = await page.evaluate(() => {
    const win = globalThis as unknown as Win;
    return { watched: win.__startup, sprites: win.villagesScenery?.().particles ?? null };
  });
  await context.close();
  const spent = spentIn(profile);
  return {
    place: place.name,
    lat: place.lat,
    lon: place.lon,
    from: FROM,
    to: TO,
    ms: FLYING_MS,
    during: pacing(watched, began, began + FLYING_MS),
    after: pacing(watched, began + FLYING_MS, began + FLYING_MS + AFTER_MS),
    cpu: { busy: spent.busy, gc: spent.gc },
    modules: spent.modules,
    functions: spent.functions,
    sprites,
    compiles: compiledOf(watched, began + FLYING_MS + AFTER_MS),
  };
}

/** The numbers of a zoom a run is put beside the last point by: the first zoom's stall, each place's stalls, stutters and CPU. */
function zoomBeside(then: ZoomPoint, now: ZoomPoint): Beside[] {
  const stalled = (zoom: Zoomed | undefined | null) =>
    zoom === undefined || zoom === null ? null : zoom.during.longTasks.total + zoom.after.longTasks.total;
  const janky = (zoom: Zoomed | undefined) =>
    zoom === undefined ? null : zoom.during.janky + zoom.after.janky;
  const first: Beside = {
    name: 'the first zoom: long tasks',
    then: stalled(then.firstZoom),
    now: stalled(now.firstZoom),
    // The driver's compile alone swings from 23 to 31 seconds between runs of one tree (2026-10-20).
    least: 10_000,
    unit: 's',
  };
  return [
    first,
    ...now.zooms.flatMap((zoom) => {
      const was = then.zooms.find((each) => each.place === zoom.place);
      return [
        { name: `${zoom.place}: long tasks`, then: stalled(was), now: stalled(zoom), least: 100, unit: 'ms' },
        { name: `${zoom.place}: stutters`, then: janky(was), now: janky(zoom), least: 2, unit: '' },
        {
          name: `${zoom.place}: CPU`,
          then: was?.cpu.busy ?? null,
          now: zoom.cpu.busy,
          least: 200,
          unit: 'ms',
        },
      ];
    }),
  ];
}

/** Of a place's zooms, the middle by how long the page was stalled while the camera came in. */
function middleZoom(zooms: readonly Zoomed[]): Zoomed {
  const sorted = [...zooms].sort((a, b) => a.during.longTasks.total - b.during.longTasks.total);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

const said = (zoom: Zoomed) =>
  `${zoom.place.padEnd(10)} during: ${zoom.during.fps} frames a second, ${zoom.during.janky} stutters, worst gap ` +
  `${Math.round(zoom.during.worstGap)} ms, 95th ${Math.round(zoom.during.p95Gap)} ms, ${zoom.during.longTasks.count} long tasks ` +
  `${Math.round(zoom.during.longTasks.total)} ms; after: ${zoom.after.janky} stutters, ${zoom.after.longTasks.count} long tasks ` +
  `${Math.round(zoom.after.longTasks.total)} ms; CPU ${Math.round(zoom.cpu.busy)} ms; ${zoom.sprites ?? '-'} sprites` +
  `${zoom.compiles.length === 0 ? '' : `; waited on compiling ${zoom.compiles.map((compile) => `${compile.name} ${compile.ms} ms`).join(', ')}`}\n` +
  `           ${zoom.modules
    .slice(0, 6)
    .map((module) => `${module.name} ${Math.round(module.ms)}`)
    .join(', ')}`;

const card = cardToMeasureOn(flag('anyway'));
const servers = await startServers(tree, logs);
const { browser, renderer, headless } = await chromeOnTheCard(flag('headed'));
try {
  // A first page, let go by: the dev server works out every file anew for it, which is the start's to measure.
  const warming = await browser.newContext({ viewport: VIEWPORT });
  await settledFarOut(await warming.newPage(), servers.url, places[0]!);
  const levelsPage = warming.pages()[0]!;
  const levels = await readLevels(levelsPage, findSetters(tree));
  await warming.close();

  // The run's first zoom, cold: the browser compiles the game's programs as the camera first needs them.
  const firstZoom = await zoomOnce(browser, servers.url, places[0]!);
  console.log(
    `  the first zoom, ${firstZoom.place}: ${Math.round(firstZoom.during.longTasks.total)} ms of long tasks, compiling ` +
      `${firstZoom.compiles.map((compile) => `${compile.name} ${compile.ms} ms`).join(', ') || 'nothing waited on'}`,
  );
  const all = new Map<string, Zoomed[]>();
  for (let round = 1; round <= rounds; round += 1) {
    for (const place of places) {
      const zoom = await zoomOnce(browser, servers.url, place);
      all.set(place.name, [...(all.get(place.name) ?? []), zoom]);
      console.log(
        `  round ${round}, ${place.name}: ${zoom.during.janky} stutters, ${Math.round(zoom.during.longTasks.total)} ms of long tasks`,
      );
    }
  }
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
    zooms: places.map((place) => middleZoom(all.get(place.name)!)),
    of: rounds,
  };
  mkdirSync(logs, { recursive: true });
  const file = join(logs, `zoom-${stamp}.json`);
  writeFileSync(file, `${JSON.stringify({ ...point, all: Object.fromEntries(all) }, null, 2)}\n`);

  console.log(
    `\n${renderer}, ${headless ? 'headless' : 'in a window'}, zoom ${FROM} to ${TO} over ${FLYING_MS / 1000} s, the middle of ${rounds}`,
  );
  console.log(`the first zoom, cold: ${said(firstZoom)}\n`);
  for (const zoom of point.zooms) console.log(said(zoom));
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
