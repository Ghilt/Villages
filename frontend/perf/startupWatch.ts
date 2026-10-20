/**
 * What the start's measure hangs on the page before anything of it runs, handed to Playwright's `addInitScript` whole,
 * so it may use nothing from outside itself. It notes, in milliseconds since the page opened, when each mark of the
 * start is first seen - the map's canvas, its style, the sprite canvas, the map drawn, the loading screen up and
 * lifted - every long task the browser reports, and every animation frame, so the gaps between frames say where the
 * start stuttered. It reads only what a built page has as well (the DOM), and the map's handle where a development
 * build has it.
 */
export function watchStartup(): void {
  const at: Record<string, number> = {};
  const longTasks: { at: number; ms: number }[] = [];
  const frames: number[] = [];
  const mark = (name: string) => {
    at[name] ??= performance.now();
  };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push({ at: entry.startTime, ms: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    // A browser without long tasks says nothing of them.
  }
  const tick = (now: number) => {
    frames.push(now);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  type MapHandle = { style?: { _loaded?: boolean }; loaded(): boolean; areTilesLoaded(): boolean };
  setInterval(() => {
    const map = (globalThis as unknown as { villagesMap?: MapHandle }).villagesMap;
    if (document.querySelector('canvas.maplibregl-canvas') !== null) mark('map');
    if (map?.style?._loaded === true) mark('style');
    if (at['map'] !== undefined && document.getElementsByTagName('canvas').length >= 2) mark('sprites');
    if (at['style'] !== undefined && map !== undefined && map.loaded() && map.areTilesLoaded()) mark('drawn');
    if (document.querySelector('.ui-loading') !== null) mark('screen');
    if (document.querySelector('.ui-loading--lifted') !== null) mark('lifted');
  }, 16);
  (globalThis as unknown as { __startup: unknown }).__startup = { at, longTasks, frames };
}

/** What `watchStartup` hangs on the page, as the tool reads it. */
export interface Watched {
  at: Record<string, number>;
  longTasks: { at: number; ms: number }[];
  frames: number[];
}
