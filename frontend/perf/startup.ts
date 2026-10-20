import { cpus } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Browser } from '@playwright/test';

import type { Load, StartupPoint } from '../apps/web/src/admin/performance/startupPoints.ts';
import { HERE, argsOf } from './args.ts';
import { builtPage } from './builtPage.ts';
import { chromeOnTheCard } from './chrome.ts';
import { startServers } from './devServer.ts';
import { METHOD, codeOf, keep, keptFile } from './kept.ts';
import { cardToMeasureOn } from './machine.ts';
import { middleOf, requestsByKind, spanOf, spentIn } from './startupStats.ts';
import type { Profile } from './startupStats.ts';
import { watchStartup } from './startupWatch.ts';
import type { Watched } from './startupWatch.ts';

/**
 * How long the game takes to start, and where that time goes, measured from outside the game on this machine's Chrome
 * and graphics card, against a dev server and a game server of the tool's own: the first load after the dev server
 * started, the game loaded again on it, and the page as it is built for a player. Each load in a browser of its own,
 * nothing cached; for each, when each mark of the start came, the long tasks and the gaps between frames up to the
 * loading screen lifting and in the five seconds after, what was fetched, and where the CPU's time went by module and
 * by function. See decision record 0106.
 *
 *   npm run perf:startup --prefix frontend -- [--loads 3] [--no-built] [--tree <dir>] [--record]
 *     [--why to-main|history|by-hand] [--headed] [--anyway]
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
  await page.goto(url, { waitUntil: 'commit' });
  // Done when the loading screen has lifted; before there was a screen, when the map had drawn.
  const readyDoc = await page
    .waitForFunction(
      () => {
        const seen = (globalThis as unknown as { __startup?: Watched }).__startup?.at;
        if (seen === undefined) return null;
        return document.querySelector('.ui-loading') === null
          ? (seen['drawn'] ?? null)
          : (seen['lifted'] ?? null);
      },
      null,
      { timeout: 60_000, polling: 50 },
    )
    .then((handle) => handle.jsonValue() as Promise<number>)
    .catch(() => null);
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
    readyBy: readyDoc === null ? null : watched.at['lifted'] !== undefined ? 'lifted' : 'drawn',
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
  };
}

const seconds = (ms: number | null | undefined) =>
  ms === null || ms === undefined ? '-' : `${(ms / 1000).toFixed(1)} s`;

function said(name: string, load: Load | null): string {
  if (load === null) return `${name.padEnd(12)} not measured`;
  const { before, after } = load;
  return (
    `${name.padEnd(12)} ready ${seconds(load.ready)}${load.readyBy === 'drawn' ? ' (map drawn)' : ''}` +
    `${load.reloads > 0 ? `, ${load.reloads} reload${load.reloads > 1 ? 's' : ''}` : ''}; ` +
    `style ${seconds(load.at['style'])}, sprites ${seconds(load.at['sprites'])}; ` +
    `before: ${before.longTasks.count} long tasks ${Math.round(before.longTasks.total)} ms, worst gap ${Math.round(before.worstGap)} ms; ` +
    `after: ${after.longTasks.count} long tasks ${Math.round(after.longTasks.total)} ms, ${after.janky} stutters, worst gap ${Math.round(after.worstGap)} ms; ` +
    `fetched ${Object.entries(load.requests)
      .map(([kind, { count, kb }]) => `${kind} ${count} (${(kb / 1024).toFixed(1)} MB)`)
      .join(', ')}`
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
  if (!flag('no-built')) {
    console.log('  building the page');
    const page = await builtPage(tree, join(logs, 'built'), servers.gamePort);
    try {
      for (let i = 0; i < loads; i += 1) {
        console.log(`  the built page, ${i + 1} of ${loads}`);
        built.push(await loadOnce(browser, page.url));
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
    loads: { first, again: middleOf(again), built: middleOf(built) },
    of: loads,
  };
  mkdirSync(logs, { recursive: true });
  const file = join(logs, `startup-${stamp}.json`);
  writeFileSync(file, `${JSON.stringify({ ...point, all: { again, built } }, null, 2)}\n`);

  console.log(`\n${renderer}, ${headless ? 'headless' : 'in a window'}, ${point.machine.cpu}`);
  console.log(said('first load', point.loads.first));
  console.log(said('load again', point.loads.again));
  console.log(said('built page', point.loads.built));
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
