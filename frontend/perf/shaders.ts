import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

import { startServers } from './devServer.ts';
import { instrument } from './instrument.ts';
import { findSetters } from './levels.ts';
import { cardNow, watchClocks } from './machine.ts';
import { burst, goTo, liftFog, openGame, setLevels, warm } from './page.ts';
import { HELD_AT, placesNamed } from './places.ts';
import type { Place } from './places.ts';
import { combine, faster, readingOf, spreadOf } from './stats.ts';
import type { Combined, Frame } from './stats.ts';

/**
 * What the game's shaders cost the graphics card at fixed places on the map, measured from outside the game, so that
 * any tree - this one, or an old commit checked out - is measured the same way. See docs/plans/performance-history.md.
 *
 *   npm run perf:shaders --prefix frontend -- [--places tundra,bog] [--tree <dir>] [--rounds 3] [--check] [--headed]
 *
 * It prints a table and leaves the whole reading, and a picture of every place, in .logs/perf/.
 */

const HERE = resolve(import.meta.dirname, '..', '..');
const VIEWPORT = { width: 1920, height: 1080 };
const BURSTS = 5;
const FRAMES = 60;
/** The first frames of every burst, let go by: the card is still coming up to its clock. */
const LET_GO = 5;

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};
const flag = (name: string): boolean => args.includes(`--${name}`);

const tree = resolve(option('tree') ?? HERE);
const places = placesNamed((option('places') ?? '').split(',').filter(Boolean));
// Three pages a place, the fastest kept: one page draws a place up to a sixth slower than the next, and keeps to it.
const rounds = Number(option('rounds') ?? 3);
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const logs = join(HERE, '.logs', 'perf');
const pictures = join(logs, stamp);

const git = (...command: string[]) =>
  execFileSync('git', ['-C', tree, ...command], { encoding: 'utf8' }).trim();

/** Chrome on this machine's graphics card, headless when it will draw there with the card's timer, else a window. */
async function chromeOnTheCard(): Promise<{ browser: Browser; renderer: string; headless: boolean }> {
  const launch = (headless: boolean) =>
    chromium.launch({
      channel: 'chrome',
      headless,
      args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
    });
  for (const headless of flag('headed') ? [false] : [true, false]) {
    const browser = await launch(headless);
    const page = await browser.newPage();
    const { renderer, timer } = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer:
          gl === null || gl === undefined
            ? 'no WebGL 2'
            : String(gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)),
        timer: gl?.getExtension('EXT_disjoint_timer_query_webgl2') !== null,
      };
    });
    await page.close();
    if (timer && !/swiftshader|software|no WebGL/i.test(renderer)) return { browser, renderer, headless };
    console.log(
      `${headless ? 'headless' : 'a window'}: ${renderer}${timer ? '' : ', no timer'} - not the card`,
    );
    await browser.close();
  }
  throw new Error('no Chrome on this machine draws on the graphics card with its timer');
}

/**
 * Draws this place until the card has come up to its working clock: until two bursts in a row, timed as a whole, come
 * within three in a hundred of each other. A place measured after a light one - the sky - otherwise found the card
 * still on its way up, and read a tenth slower for it.
 */
async function warmUp(page: Page): Promise<number> {
  await warm(page, 2);
  let last = Number.POSITIVE_INFINITY;
  for (let i = 1; i <= 15; i += 1) {
    const now = readingOf((await burst(page, FRAMES, 'whole')).frames.slice(LET_GO)).frame;
    if (Math.abs(now - last) <= 0.03 * now) return i;
    last = now;
  }
  return 15;
}

/**
 * One place, read: the card warmed, then bursts timed as a whole and run by run in turn, so both see the card alike;
 * any burst the card was interrupted in let go.
 */
async function readAt(page: Page): Promise<{ reading: Combined; thrown: number }> {
  await warmUp(page);
  const whole: Frame[] = [];
  const parts: Frame[] = [];
  let thrown = 0;
  for (let i = 0; i < BURSTS * 2; i += 1) {
    const how = i % 2 === 0 ? 'whole' : 'attributed';
    const got = await burst(page, FRAMES, how);
    if (got.disjoint || got.lost > 0) thrown += 1;
    else (how === 'whole' ? whole : parts).push(...got.frames.slice(LET_GO));
  }
  return { reading: combine(readingOf(whole), readingOf(parts)), thrown };
}

const card = cardNow();
if (card !== null && card.busy > 25) {
  const said = `the graphics card is ${card.busy}% busy before starting: something else is drawing on it, and every time would carry it`;
  if (!flag('anyway')) {
    console.log(`${said}. Close it, or measure --anyway.`);
    process.exit(1);
  }
  console.log(`${said}; measuring anyway`);
}

const server = await startServers(tree, logs);
const { browser, renderer, headless } = await chromeOnTheCard();
try {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await context.addInitScript(instrument);
  const page = await context.newPage();
  // Vite works out the packages on the first load and loads the page again: that load is let go by.
  await openGame(page, server.url);
  const { contexts } = await openGame(page, server.url);
  let inFlight = 0;
  let lastFetch = Date.now();
  page.on('request', () => {
    inFlight += 1;
    lastFetch = Date.now();
  });
  const done = () => {
    inFlight = Math.max(0, inFlight - 1);
    lastFetch = Date.now();
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  const quiet = () => inFlight === 0 && Date.now() - lastFetch > 1_000;

  const setters = findSetters(tree);
  const levels = await setLevels(page, setters, 'high');
  const fogLifted = await liftFog(page);
  mkdirSync(pictures, { recursive: true });

  /**
   * A place on a page of its own: the game opened afresh, every shader set again and the fog lifted again, then the
   * camera put there. A page that has been to other places first can draw the same place slower - the tundra a
   * tenth slower once the camera had been round the rest (2026-10-19) - so no place is measured with another's history.
   */
  const freshAt = async (place: Place, levelled = setters): Promise<boolean> => {
    await openGame(page, server.url);
    await setLevels(page, levelled, 'high');
    await liftFog(page);
    return goTo(page, place, HELD_AT, quiet);
  };

  const readings = new Map<
    string,
    { reading: Combined; rounds: number[]; settled: boolean; thrown: number; clocks: unknown }
  >();
  for (let round = 1; round <= rounds; round += 1) {
    for (const place of places) {
      const settled = await freshAt(place);
      if (round === 1) await page.screenshot({ path: join(pictures, `${place.name}.png`) });
      const clocks = watchClocks();
      const { reading, thrown } = await readAt(page);
      const watched = clocks.stop();
      const was = readings.get(place.name);
      readings.set(place.name, {
        reading: was === undefined ? reading : faster(was.reading, reading),
        rounds: [...(was?.rounds ?? []), reading.frame],
        settled: settled && (was?.settled ?? true),
        thrown: thrown + (was?.thrown ?? 0),
        clocks: was !== undefined && was.reading.frame <= reading.frame ? was.clocks : watched,
      });
      console.log(
        `  round ${round}, ${place.name}: ${reading.frame.toFixed(2)} ms${settled ? '' : ' (never settled)'}`,
      );
    }
  }

  // The method's own check: the water's part, as timed, against what the frame loses when the water is turned off.
  let check: Record<string, unknown> | null = null;
  const coast = places.find((place) => place.name === 'coast');
  const water = setters.find((setter) => setter.setter === 'setWaterLevel');
  if (flag('check') && coast !== undefined && water !== undefined) {
    await freshAt(coast);
    const withWater = (await readAt(page)).reading;
    await freshAt(coast);
    await setLevels(page, [water], 'off');
    await goTo(page, coast, HELD_AT, quiet);
    const without = (await readAt(page)).reading;
    check = {
      waterPart: withWater.keys['map:water'] ?? 0,
      waterBySubtraction: withWater.frame - without.frame,
    };
  }

  const out = {
    measuredAt: new Date().toISOString(),
    tree,
    code: {
      commit: git('rev-parse', 'HEAD'),
      subject: git('log', '-1', '--format=%s'),
      dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
    },
    machine: { renderer, card, chrome: browser.version(), headless, viewport: VIEWPORT, dpr: 1 },
    levels,
    fogLifted,
    contexts,
    places: places.map((place) => ({ ...place, ...readings.get(place.name)! })),
    check,
  };
  const file = join(logs, `shaders-${stamp}.json`);
  writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);

  console.log(
    `\n${renderer}, ${headless ? 'headless' : 'in a window'}, ${VIEWPORT.width}x${VIEWPORT.height}, every shader high`,
  );
  for (const place of out.places) {
    const { reading } = place;
    const top = Object.entries(reading.keys)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, ms]) => `${key} ${ms.toFixed(2)}`)
      .join(', ');
    const spread = spreadOf(place.rounds);
    console.log(
      `${place.name.padEnd(10)} ${reading.frame.toFixed(2).padStart(6)} ms (p50 ${reading.p50.toFixed(2)}, p80 ${reading.p80.toFixed(2)}), ` +
        `cpu ${reading.cpu.toFixed(2)} ms, rounds ${(spread * 100).toFixed(0)}% apart, ` +
        `parts timed ${reading.partsOverWhole.toFixed(2)}x the whole (${(reading.perRun * 1000).toFixed(0)} us a query)` +
        `${place.settled ? '' : ', never settled'}${place.thrown > 0 ? `, ${place.thrown} bursts thrown` : ''}\n           ${top}`,
    );
  }
  if (check !== null) console.log('check', JSON.stringify(check));
  console.log(`\n${file}\n${pictures}`);
} finally {
  await browser.close();
  await server.stop();
}
