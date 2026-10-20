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

  // How long the page waited on the graphics driver to compile each program: the first question asked of a program
  // that needs it linked blocks until it is, and the land's took 27 s on a fresh profile (2026-10-20). Named as Pixi
  // names them, `#define SHADER_NAME land-fragment`; the map's programs by their first words.
  const compiles: { at: number; ms: number; name: string }[] = [];
  const sources = new WeakMap<WebGLShader, string>();
  const attached = new WeakMap<WebGLProgram, WebGLShader[]>();
  const asked = new WeakSet<WebGLProgram>();
  const gl2 = WebGL2RenderingContext.prototype;
  const shaderSource = gl2.shaderSource;
  gl2.shaderSource = function (this: WebGL2RenderingContext, shader: WebGLShader, source: string) {
    sources.set(shader, source);
    shaderSource.call(this, shader, source);
  };
  const attachShader = gl2.attachShader;
  gl2.attachShader = function (this: WebGL2RenderingContext, program: WebGLProgram, shader: WebGLShader) {
    attached.set(program, [...(attached.get(program) ?? []), shader]);
    attachShader.call(this, program, shader);
  };
  const nameOf = (program: WebGLProgram): string => {
    const text = (attached.get(program) ?? []).map((shader) => sources.get(shader) ?? '').join('\n');
    const named = /#define SHADER_NAME (\S+)/.exec(text)?.[1]?.replace(/-(fragment|vertex)(-\d+)?$/, '');
    return named ?? text.replace(/\s+/g, ' ').trim().slice(0, 40);
  };
  const getProgramParameter = gl2.getProgramParameter;
  gl2.getProgramParameter = function (this: WebGL2RenderingContext, program: WebGLProgram, which: number) {
    const began = performance.now();
    const value: unknown = getProgramParameter.call(this, program, which);
    const ms = performance.now() - began;
    if (!asked.has(program)) {
      asked.add(program);
      if (ms >= 20) compiles.push({ at: began, ms, name: nameOf(program) });
    }
    return value;
  };
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
  (globalThis as unknown as { __startup: unknown }).__startup = { at, longTasks, frames, compiles };
}

/** What `watchStartup` hangs on the page, as the tool reads it. */
export interface Watched {
  at: Record<string, number>;
  longTasks: { at: number; ms: number }[];
  frames: number[];
  /** The programs whose compiling the page waited on 20 ms or more, when and for how long. */
  compiles: { at: number; ms: number; name: string }[];
}
