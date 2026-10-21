import { cpus } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Browser } from '@playwright/test';

import { readStartupPoints } from '../apps/web/src/admin/performance/startupPoints.ts';
import type { Load, StartupPoint } from '../apps/web/src/admin/performance/startupPoints.ts';
import { HERE, argsOf } from './args.ts';
import { builtPage } from './builtPage.ts';
import { besideSaid } from './compare.ts';
import type { Beside } from './compare.ts';
import { chromeOnTheCard } from './chrome.ts';
import { startServers } from './devServer.ts';
import { METHOD, codeOf, keep, keptFile, lastLike, readKept } from './kept.ts';
import { cardToMeasureOn } from './machine.ts';
import { compiledOf, middleOf, requestsByKind, spanOf, spentIn } from './startupStats.ts';
import type { Profile } from './startupStats.ts';
import { watchStartup } from './startupWatch.ts';
import type { Watched } from './startupWatch.ts';

/**
 * How long the game takes to start, and where that time goes, measured from outside the game on this machine's Chrome
 * and graphics card, against a dev server and a game server of the tool's own: the first load after the dev server
 * started, the game loaded again on it, the page as it is built for a player, and a player's first visit. Each load
 * on a page of its own with nothing in its cache; the pages of one browser share the programs it has compiled, so a
 * first visit is the built page in a browser started for that one load, where nothing is compiled either, as on a
 * player's first visit and on every visit after a shader changes. For each, when each mark of the start came, the long tasks and the gaps between frames up to the
 * loading screen lifting and in the five seconds after, what was fetched, and where the CPU's time went by module and
 * by function. See decision record 0106.
 *
 *   npm run perf:startup --prefix frontend -- [--loads 3] [--no-built] [--tree <dir>] [--compare] [--record]
 *     [--why to-main|history|by-hand] [--headed] [--anyway]
 *
 * `--compare` puts the run beside the last point kept that was measured alike, and says what moved.
 */

const VIEWPORT = { width: 1920, height: 1080 };
/** How long after the screen lifts the start is still watched: a player is looking by then. */
const AFTER_MS = 5_000;
const { option, flag, tree, why, stamp } = argsOf(process.argv.slice(2));
const loads = Number(option('loads') ?? 3);
const logs = join(HERE, '.logs', 'perf');

/** One load of the game in a browser of its own, from asking for the page to five seconds after it was ready. */
async function loadOnce(browser: Browser, url: string): Promise<Load> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await context.addInitScript(watchStartup);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
  await cdp.send('Profiler.start');
  let reloads = -1;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) reloads += 1;
  });
  const asked = Date.now();
  await page.goto(url, { waitUntil: 'commit', timeout: 120_000 });
  // Done when the loading screen has lifted; before there was a screen, when the map had drawn; and on a built page
  // from then, which hides the map's handle, when its last tile came.
  const readyAt = await page
    .waitForFunction(
      () => {
        const seen = (globalThis as unknown as { __startup?: Watched }).__startup?.at;
        if (seen === undefined) return null;
        if (document.querySelector('.ui-loading') !== null)
          return seen['lifted'] === undefined ? null : { ms: seen['lifted'], by: 'lifted' };
        if ('villagesMap' in globalThis)
          return seen['drawn'] === undefined ? null : { ms: seen['drawn'], by: 'drawn' };
        return seen['tiles'] === undefined ? null : { ms: seen['tiles'], by: 'tiles' };
      },
      null,
      { timeout: 60_000, polling: 50 },
    )
    .then((handle) => handle.jsonValue() as Promise<{ ms: number; by: 'lifted' | 'drawn' | 'tiles' }>)
    .catch(() => null);
  const readyDoc = readyAt?.ms ?? null;
  const origin = await page.evaluate(() => performance.timeOrigin);
  const before = ((await cdp.send('Profiler.stop')) as { profile: Profile }).profile;
  await cdp.send('Profiler.start');
  await page.waitForTimeout(AFTER_MS);
  const after = ((await cdp.send('Profiler.stop')) as { profile: Profile }).profile;
  const watched = await page.evaluate(() => (globalThis as unknown as { __startup: Watched }).__startup);
  const entries = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return {
        name: resource.name,
        transferSize: resource.transferSize,
        encodedBodySize: resource.encodedBodySize,
      };
    }),
  );
  await context.close();
  const end = readyDoc ?? Math.max(0, ...watched.frames);
  const spentBefore = spentIn(before);
  const spentAfter = spentIn(after);
  const at = Object.fromEntries(Object.entries(watched.at).map(([mark, ms]) => [mark, Math.round(ms)]));
  return {
    ready: readyDoc === null ? null : Math.round(origin + readyDoc - asked),
    readyBy: readyAt?.by ?? null,
    reloads: Math.max(0, reloads),
    at,
    before: spanOf(watched.longTasks, watched.frames, 0, end),
    after: spanOf(watched.longTasks, watched.frames, end, end + AFTER_MS),
    requests: requestsByKind(entries),
    cpu: { busy: spentBefore.busy, idle: spentBefore.idle, gc: spentBefore.gc },
    modules: spentBefore.modules,
    functions: spentBefore.functions,
    afterModules: spentAfter.modules.slice(0, 8),
    afterFunctions: spentAfter.functions.slice(0, 8),
    compiles: compiledOf(watched, end + AFTER_MS),
  };
}

/**
 * A player's first visit: the built page in a browser started for this one load, which has compiled no program and
 * cached nothing, so the page waits on the graphics driver for every program it needs before the screen lifts.
 */
async function firstVisit(url: string): Promise<Load> {
  const { browser: fresh } = await chromeOnTheCard(flag('headed'));
  try {
    return await loadOnce(fresh, url);
  } finally {
    await fresh.close();
  }
}

/** The numbers of a start a run is put beside the last point by: each load's seconds to ready, its stalls, its stutters. */
function startupBeside(then: StartupPoint, now: StartupPoint): Beside[] {
  return (['first', 'again', 'built', 'visit'] as const).flatMap((key) => {
    const was = then.loads[key] ?? null;
    const is = now.loads[key] ?? null;
    if (was === null && is === null) return [];
    return [
      { name: `${key}: ready`, then: was?.ready ?? null, now: is?.ready ?? null, least: 300, unit: 's' },
      {
        name: `${key}: long tasks up to ready`,
        then: was?.before.longTasks.total ?? null,
        now: is?.before.longTasks.total ?? null,
        least: 150,
        unit: 'ms',
      },
      {
        name: `${key}: stutters after`,
        then: was?.after.janky ?? null,
        now: is?.after.janky ?? null,
        least: 2,
        unit: '',
      },
    ];
  });
}

const seconds = (ms: number | null | undefined) =>
  ms === null || ms === undefined ? '-' : `${(ms / 1000).toFixed(1)} s`;

function said(name: string, load: Load | null): string {
  if (load === null) return `${name.padEnd(12)} not measured`;
  const { before, after } = load;
  return (
    `${name.padEnd(12)} ready ${seconds(load.ready)}${load.readyBy === 'drawn' ? ' (map drawn)' : load.readyBy === 'tiles' ? ' (last tile)' : ''}` +
    `${load.reloads > 0 ? `, ${load.reloads} reload${load.reloads > 1 ? 's' : ''}` : ''}; ` +
    `style ${seconds(load.at['style'])}, sprites ${seconds(load.at['sprites'])}; ` +
    `before: ${before.longTasks.count} long tasks ${Math.round(before.longTasks.total)} ms, worst gap ${Math.round(before.worstGap)} ms; ` +
    `after: ${after.longTasks.count} long tasks ${Math.round(after.longTasks.total)} ms, ${after.janky} stutters, worst gap ${Math.round(after.worstGap)} ms; ` +
    `fetched ${Object.entries(load.requests)
      .map(([kind, { count, kb }]) => `${kind} ${count} (${(kb / 1024).toFixed(1)} MB)`)
      .join(', ')}` +
    `${(load.compiles ?? []).length === 0 ? '' : `; waited on compiling ${(load.compiles ?? []).map((each) => `${each.name} ${each.ms} ms`).join(', ')}`}`
  );
}

const card = cardToMeasureOn(flag('anyway'));
const servers = await startServers(tree, logs);
const { browser, renderer, headless } = await chromeOnTheCard(flag('headed'));
try {
  console.log('  the first load after the dev server started');
  const first = await loadOnce(browser, servers.url);
  const again: Load[] = [];
  for (let i = 0; i < loads; i += 1) {
    console.log(`  load again, ${i + 1} of ${loads}`);
    again.push(await loadOnce(browser, servers.url));
  }
  const built: Load[] = [];
  const visit: Load[] = [];
  if (!flag('no-built')) {
    console.log('  building the page');
    const page = await builtPage(tree, join(logs, 'built'), servers.gamePort);
    try {
      for (let i = 0; i < loads; i += 1) {
        console.log(`  the built page, ${i + 1} of ${loads}`);
        built.push(await loadOnce(browser, page.url));
      }
      for (let i = 0; i < loads; i += 1) {
        console.log(`  a first visit, ${i + 1} of ${loads}`);
        visit.push(await firstVisit(page.url));
      }
    } finally {
      await page.stop();
    }
  }

  const point: StartupPoint = {
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
    loads: { first, again: middleOf(again), built: middleOf(built), visit: middleOf(visit) },
    of: loads,
  };
  mkdirSync(logs, { recursive: true });
  const file = join(logs, `startup-${stamp}.json`);
  writeFileSync(file, `${JSON.stringify({ ...point, all: { again, built, visit } }, null, 2)}\n`);

  console.log(`\n${renderer}, ${headless ? 'headless' : 'in a window'}, ${point.machine.cpu}`);
  console.log(said('first load', point.loads.first));
  console.log(said('load again', point.loads.again));
  console.log(said('built page', point.loads.built));
  console.log(said('first visit', point.loads.visit ?? null));
  const middle = point.loads.again;
  if (middle !== null) {
    const list = (spent: readonly { name: string; ms: number }[], count: number) =>
      spent
        .slice(0, count)
        .map((each) => `${each.name} ${Math.round(each.ms)}`)
        .join(', ');
    console.log(`\nwhere the CPU went up to ready, the load again: ${Math.round(middle.cpu.busy)} ms busy`);
    console.log(`  by module: ${list(middle.modules, 8)}`);
    console.log(`  by function: ${list(middle.functions, 8)}`);
    console.log(`  in the five seconds after, by module: ${list(middle.afterModules, 6)}`);
  }
  if (flag('compare')) {
    const then = lastLike(readStartupPoints(readKept('startup')).points, point);
    if (then === null) console.log('\nnothing kept to compare with, measured alike');
    else {
      console.log(
        `\nagainst ${then.code.commit.slice(0, 7)}, "${then.code.subject}", measured ${then.measuredAt.slice(0, 10)}:`,
      );
      for (const line of besideSaid(startupBeside(then, point))) console.log(`  ${line}`);
    }
  }
  if (flag('record')) {
    const kept = keptFile(HERE, 'startup');
    keep(kept, point);
    console.log(`\nkept in ${kept}`);
  }
  console.log(`\n${file}`);
} finally {
  await browser.close();
  await servers.stop();
}
