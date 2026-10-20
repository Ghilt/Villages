import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { HERE, argsOf } from './args.ts';
import { chromeOnTheCard } from './chrome.ts';
import { said, whatMoved } from './compare.ts';
import { startServers } from './devServer.ts';
import { instrument } from './instrument.ts';
import { METHOD, codeOf, keep, keptFile, keptPlace, lastLike, masterOf, readPoints } from './kept.ts';
import type { Point } from './kept.ts';
import { findSetters } from './levels.ts';
import { cardToMeasureOn, watchClocks } from './machine.ts';
import { burst, foundHouse, goTo, liftFog, openGame, setLevels, warm } from './page.ts';
import type { Arrived } from './page.ts';
import { HELD_AT, placesNamed } from './places.ts';
import type { Place } from './places.ts';
import { combine, readingOf, spreadOf } from './stats.ts';
import type { Combined, Frame } from './stats.ts';

/**
 * What the game's shaders cost the graphics card at fixed places on the map, measured from outside the game, so that
 * any tree - this one, or an old commit checked out - is measured the same way. See docs/plans/performance-history.md.
 *
 *   npm run perf:shaders --prefix frontend -- [--places tundra,bog] [--tree <dir>] [--rounds 3] [--no-fog]
 *     [--level water=low] [--compare] [--record] [--why to-main|history|by-hand] [--check] [--headed] [--anyway]
 *
 * `--compare` says what moved against the last point kept that was measured alike, `--record` keeps this run as a
 * point in this tree's `docs/experiments/performance/shaders.jsonl` (see `kept.ts`).
 *
 * It prints a table and leaves the whole reading, and a picture of every place, in .logs/perf/.
 */

const VIEWPORT = { width: 1920, height: 1080 };
const BURSTS = 5;
const FRAMES = 60;
/** The first frames of every burst, let go by: the card is still coming up to its clock. */
const LET_GO = 5;

const { option, flag, tree, why, stamp } = argsOf(process.argv.slice(2));
const places = placesNamed((option('places') ?? '').split(',').filter(Boolean));
// Three pages a place, the fastest kept: one page draws a place up to a sixth slower than the next, and keeps to it.
const rounds = Number(option('rounds') ?? 3);
const logs = join(HERE, '.logs', 'perf');
const pictures = join(logs, stamp);

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

const card = cardToMeasureOn(flag('anyway'));

const server = await startServers(tree, logs);
const { browser, renderer, headless } = await chromeOnTheCard(flag('headed'));
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
  // `--level water=low,land=off`: a shader at another level than high, by the name in its setter.
  const otherwise = (option('level') ?? '')
    .split(',')
    .filter(Boolean)
    .map((said) => {
      const [name, level] = said.split('=');
      const setter = setters.find((each) => each.setter.toLowerCase() === `set${name}level`.toLowerCase());
      if (setter === undefined || level === undefined)
        throw new Error(`no shader called ${name} to set to ${level}`);
      return { setter, level };
    });
  /** Every shader high, but those told otherwise. */
  const levelUp = async () => {
    const levels = await setLevels(page, setters, 'high');
    for (const { setter, level } of otherwise) {
      Object.assign(levels.applied, (await setLevels(page, [setter], level)).applied);
    }
    return levels;
  };
  const levels = await levelUp();
  const fogLifted = await liftFog(page);
  mkdirSync(pictures, { recursive: true });

  /**
   * A place on a page of its own: the game opened afresh, every shader set again and the fog lifted again, then the
   * camera put there. A page that has been to other places first can draw the same place slower - the tundra a
   * tenth slower once the camera had been round the rest (2026-10-19) - so no place is measured with another's history.
   */
  const freshAt = async (place: Place): Promise<Arrived> => {
    await openGame(page, server.url);
    await levelUp();
    await liftFog(page);
    return goTo(page, place, HELD_AT, quiet);
  };

  const readings = new Map<
    string,
    {
      reading: Combined;
      rounds: number[];
      settled: boolean;
      draws: Readonly<Record<string, number>>;
      thrown: number;
      clocks: unknown;
    }
  >();
  /** One round's reading of a place the camera is over, the fastest round kept. */
  const record = async (name: string, round: number, { settled, draws }: Arrived): Promise<void> => {
    if (round === 1) await page.screenshot({ path: join(pictures, `${name}.png`) });
    const clocks = watchClocks();
    const { reading, thrown } = await readAt(page);
    const watched = clocks.stop();
    const was = readings.get(name);
    const kept = was === undefined || reading.frame < was.reading.frame;
    readings.set(name, {
      reading: kept ? reading : was.reading,
      rounds: [...(was?.rounds ?? []), reading.frame],
      settled: settled && (was?.settled ?? true),
      draws: kept ? draws : was.draws,
      thrown: thrown + (was?.thrown ?? 0),
      clocks: kept ? watched : was.clocks,
    });
    console.log(
      `  round ${round}, ${name}: ${reading.frame.toFixed(2)} ms${settled ? '' : ' (never settled)'}`,
    );
  };
  for (let round = 1; round <= rounds; round += 1) {
    for (const place of places) await record(place.name, round, await freshAt(place));
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

  // The fog, last, so that no place above was measured with a house in the world: a house founded from the first seat
  // offered, on a fresh page, and the fog over everything it has not seen measured where the camera came to rest over
  // its seat; then on fresh pages over the same seat, the house the player's still. The fog's own parts are
  // `sprites:fog-of-war` and `sprites:fog-of-war-uncolour`.
  let fog: (Place & { seat: string }) | null = null;
  let fogMissed: string | null = flag('no-fog') ? 'not asked for' : null;
  for (let round = 1; round <= rounds && fogMissed === null; round += 1) {
    try {
      if (fog === null) {
        await openGame(page, server.url, async (opened) => {
          const founded = await foundHouse(opened);
          fog = {
            name: 'fog',
            what: `the fog of war over all but what the house at ${founded.seat} has seen, from its seat`,
            ...founded,
          };
        });
      } else {
        await openGame(page, server.url);
      }
      await levelUp();
      await record('fog', round, await goTo(page, fog!, HELD_AT, quiet));
    } catch (problem) {
      fogMissed = `no house could be founded: ${String(problem).split('\n')[0]}`;
    }
  }
  if (fogMissed !== null) console.log(`  the fog: not measured, ${fogMissed}`);

  const out = {
    measuredAt: new Date().toISOString(),
    tree,
    code: codeOf(tree),
    machine: { renderer, card, chrome: browser.version(), headless, viewport: VIEWPORT, dpr: 1 },
    levels,
    fogLifted,
    contexts,
    places: [...places, ...(fog !== null && readings.has('fog') ? [fog as Place] : [])].map((place) => ({
      ...place,
      ...readings.get(place.name)!,
    })),
    fogMissed,
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

  // The run as a point: compared with the last point kept that was measured alike, and kept itself when asked.
  const point: Point = {
    method: METHOD,
    why,
    measuredAt: out.measuredAt,
    code: out.code,
    machine: {
      gpu: card?.name ?? renderer,
      driver: card?.driver ?? '',
      chrome: browser.version(),
      viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
      dpr: 1,
    },
    master: masterOf(tree),
    levels,
    places: out.places.map(keptPlace),
    fogMissed,
  };
  const kept = keptFile(HERE, 'shaders');
  if (flag('compare')) {
    const then = lastLike(readPoints(kept), point);
    if (then === null) {
      console.log('\nnothing kept to compare with, measured alike');
    } else {
      console.log(
        `\nagainst ${then.code.commit.slice(0, 8)} "${then.code.subject}" (${then.why}, measured ${then.measuredAt.slice(0, 10)}):`,
      );
      for (const line of said(whatMoved(point.places, then.places))) console.log(`  ${line}`);
    }
  }
  if (flag('record')) {
    keep(kept, point);
    console.log(`\nkept in ${kept}`);
  }
  console.log(`\n${file}\n${pictures}`);
} finally {
  await browser.close();
  await server.stop();
}
