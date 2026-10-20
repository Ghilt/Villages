import type { Page } from '@playwright/test';

import type { Perf } from './instrument.ts';
import type { LevelSetter } from './levels.ts';
import type { Place } from './places.ts';
import type { Frame } from './stats.ts';

/**
 * What the tool does to the game in the page, through what has long been there rather than anything made for it: the
 * map's handle `window.villagesMap` (a development build's, since 2026-09-04), the dev server's module addresses, the
 * page's own buttons, and `instrument`'s `__perf`.
 */

interface MapHandle {
  painter: { id?: string; context: { gl: unknown } };
  style?: { _loaded?: boolean };
  loaded(): boolean;
  areTilesLoaded(): boolean;
  isMoving(): boolean;
  redraw(): void;
  resize(): void;
  jumpTo(options: { center: [number, number]; zoom: number }): void;
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getCanvas(): HTMLCanvasElement;
}
type Window = { villagesMap?: MapHandle; __perf: Perf };

/**
 * Opens the game and readies it to be measured: whatever `first` does to it while it is as a player first finds it,
 * then the panes put away and the map's context named.
 */
export async function openGame(
  page: Page,
  url: string,
  first?: (page: Page) => Promise<void>,
): Promise<{ contexts: ReturnType<Perf['contexts']> }> {
  await page.goto(url);
  await page.waitForFunction(
    () => (globalThis as unknown as Window).villagesMap?.style?._loaded === true,
    null,
    {
      timeout: 120_000,
    },
  );
  // The sprite canvas is made once the map has loaded: a second context on the page.
  await page.waitForFunction(
    () => (globalThis as unknown as Window).__perf.contexts().filter((context) => context.shown).length >= 2,
    null,
    { timeout: 60_000 },
  );
  await first?.(page);
  return page.evaluate(async () => {
    const win = globalThis as unknown as Window;
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
    const map = win.villagesMap!;
    map.resize();
    win.__perf.name(map.painter.context.gl, 'map', () => map.painter.id ?? null);
    win.__perf.nameRest('sprites');
    return { contexts: win.__perf.contexts() };
  });
}

/** Sets every shader the tree has to a level, and says what each was before and is after. */
export async function setLevels(
  page: Page,
  setters: readonly LevelSetter[],
  level: string,
): Promise<{ defaults: Record<string, string>; applied: Record<string, string> }> {
  return page.evaluate(
    async ({ setters, level }) => {
      // The address the game itself imported the module by, which carries a `?t=` once the dev server has updated
      // it: another address would be another copy of the module, whose level the game never reads.
      const loaded = performance.getEntriesByType('resource').map((entry) => entry.name);
      const addressOf = (module: string) =>
        loaded.find((name) => new URL(name).pathname === module) ?? module;
      const defaults: Record<string, string> = {};
      const applied: Record<string, string> = {};
      for (const { module, setter, store } of setters) {
        const found = (await import(/* @vite-ignore */ addressOf(module))) as Record<string, unknown>;
        const read = () => {
          const held =
            store === null ? undefined : (found[store] as { get(): { level?: string } } | undefined);
          return held?.get().level ?? '?';
        };
        defaults[setter] = read();
        (found[setter] as (level: string) => void)(level);
        applied[setter] = read();
      }
      return { defaults, applied };
    },
    { setters: setters.map((setter) => ({ ...setter })), level },
  );
}

/** Lifts the fog of war, where the tree has one to lift. */
export async function liftFog(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const address = '/src/fog/fogOfWar.ts';
    try {
      const fog = (await import(/* @vite-ignore */ address)) as { setFogOfWar?: (on: boolean) => void };
      fog.setFogOfWar?.(false);
      return fog.setFogOfWar !== undefined;
    } catch {
      return false;
    }
  });
}

/**
 * Founds a house from the first seat the founding parchment offers, as a player does (and as the end-to-end test
 * does), and waits for the camera to come to rest over it. Hands back the seat's words and where the camera rests.
 */
export async function foundHouse(
  page: Page,
): Promise<{ seat: string; lat: number; lon: number; zoom: number }> {
  const offered = page.locator('button.parchment').first();
  await offered.waitFor({ state: 'visible', timeout: 60_000 });
  const seat = (await offered.innerText()).split('\n')[0]!.trim();
  await offered.click();
  await offered.waitFor({ state: 'detached', timeout: 60_000 }).catch(() => undefined);
  // Still for a second running: the camera flies to the seat once the house is the player's.
  await page.waitForFunction(
    () => {
      const win = globalThis as unknown as Window & { __stillSince?: number };
      const map = win.villagesMap!;
      if (map.isMoving()) win.__stillSince = undefined;
      else win.__stillSince ??= performance.now();
      return win.__stillSince !== undefined && performance.now() - win.__stillSince > 1_000;
    },
    null,
    { timeout: 60_000, polling: 100 },
  );
  const at = await page.evaluate(() => {
    const map = (globalThis as unknown as Window).villagesMap!;
    return { ...map.getCenter(), zoom: map.getZoom() };
  });
  return { seat, lat: at.lat, lon: at.lng, zoom: at.zoom };
}

/** Puts the camera over a place with the wall clock held, and draws until the map has all it needs there. */
export async function goTo(page: Page, place: Place, heldAt: number, quiet: () => boolean): Promise<boolean> {
  await page.evaluate(
    ({ lat, lon, zoom, heldAt }) => {
      const win = globalThis as unknown as Window;
      win.__perf.nameRest('sprites');
      win.__perf.holdClock(heldAt);
      win.villagesMap!.jumpTo({ center: [lon, lat], zoom });
    },
    { ...place, heldAt },
  );
  // Settled once the map's tiles are in and for about two seconds every burst draws the same things the same number of
  // times: the land's mask in, and the stands the game server sends over its socket, which no fetch shows, grown into
  // the scenery. Nothing fetched for a second as well, for the first three seconds: a page just opened goes on
  // fetching what it paints ahead of the camera for the way out (`paintTheWayOut`) long after this place is drawn.
  const began = Date.now();
  const giveUp = began + 60_000;
  let last = '';
  let same = 0;
  while (Date.now() < giveUp) {
    const { tiles, counts } = await page.evaluate(async () => {
      const win = globalThis as unknown as Window;
      const map = win.villagesMap!;
      win.__perf.count();
      for (let i = 0; i < 5; i += 1) map.redraw();
      const counts = win.__perf.counts();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { tiles: map.areTilesLoaded(), counts };
    });
    const said = JSON.stringify(Object.entries(counts).sort());
    same = said === last && tiles && (quiet() || Date.now() - began > 3_000) ? same + 1 : 0;
    last = said;
    if (same >= 12) return true;
  }
  return false;
}

/** Draws frames back to back, untimed, so the card is at its working clock before anything is timed. */
export async function warm(page: Page, bursts = 5, frames = 60): Promise<void> {
  for (let i = 0; i < bursts; i += 1) {
    await page.evaluate((frames) => {
      const map = (globalThis as unknown as Window).villagesMap!;
      for (let f = 0; f < frames; f += 1) map.redraw();
    }, frames);
    await page.waitForTimeout(30);
  }
}

/** Draws frames back to back, timed by what drew or as a whole, and hands them back once the card has answered. */
export async function burst(
  page: Page,
  frames: number,
  how: 'attributed' | 'whole',
): Promise<{ frames: Frame[]; disjoint: boolean; lost: number }> {
  return page.evaluate(
    async ({ frames, how }) => {
      const win = globalThis as unknown as Window;
      const map = win.villagesMap!;
      const cpu = new Map<number, number>();
      win.__perf.record(how);
      for (let f = 0; f < frames; f += 1) {
        const frame = win.__perf.startFrame();
        const began = performance.now();
        map.redraw();
        win.__perf.endFrame();
        cpu.set(frame, performance.now() - began);
      }
      win.__perf.record('off');
      const got = await win.__perf.collect();
      return {
        frames: [...cpu].map(([frame, ms]) => ({
          cpu: ms,
          keys: got.frames[frame] ?? {},
          runs: got.runs[frame] ?? {},
        })),
        disjoint: got.disjoint,
        lost: got.lost,
      };
    },
    { frames, how },
  );
}
