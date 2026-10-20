import type { Span, Spent } from '../apps/web/src/admin/performance/startupPoints.ts';

/**
 * What a start comes to, from what `watchStartup` saw and a CPU profile Chrome took: the long tasks and the gaps
 * between frames over a span of the start, what was fetched by kind, and where the CPU's time went by module and by
 * function. Every time is in milliseconds since the page opened.
 */

/** A gap between frames this long or longer is a stutter a player sees: three frames lost at sixty a second. */
export const JANKY_MS = 50;

export function spanOf(
  longTasks: readonly { at: number; ms: number }[],
  frames: readonly number[],
  from: number,
  to: number,
): Span {
  const tasks = longTasks.filter((task) => task.at >= from && task.at < to);
  const inside = frames.filter((frame) => frame >= from && frame <= to);
  const gaps = inside.slice(1).map((frame, i) => frame - inside[i]!);
  return {
    longTasks: {
      count: tasks.length,
      total: round(tasks.reduce((sum, task) => sum + task.ms, 0)),
      longest: round(Math.max(0, ...tasks.map((task) => task.ms))),
    },
    frames: inside.length,
    worstGap: round(Math.max(0, ...gaps)),
    janky: gaps.filter((gap) => gap >= JANKY_MS).length,
  };
}

const round = (ms: number) => Math.round(ms * 10) / 10;

/** What a fetched address is, for counting: the code, the map's tiles, pictures, the world's data, or else. */
export function kindOf(address: string): string {
  const path = address.replace(/^https?:\/\/[^/]+/, '').split('?')[0]!;
  if (/\/tiles\/\d+\//.test(path)) return 'tiles';
  if (/\.(ts|tsx|js|mjs|jsx|css)$/.test(path) || path.startsWith('/@') || path.includes('/node_modules/'))
    return 'code';
  if (/\.(png|webp|jpe?g|svg|gif)$/.test(path)) return 'pictures';
  if (/\.(json|bin|pbf|geojson)$/.test(path) || path.startsWith('/world')) return 'world';
  return 'other';
}

export function requestsByKind(
  entries: readonly { name: string; transferSize: number; encodedBodySize: number }[],
): Record<string, { count: number; kb: number }> {
  const kinds: Record<string, { count: number; kb: number }> = {};
  for (const entry of entries) {
    const kind = (kinds[kindOf(entry.name)] ??= { count: 0, kb: 0 });
    kind.count += 1;
    kind.kb += Math.max(entry.transferSize, entry.encodedBodySize) / 1024;
  }
  for (const kind of Object.values(kinds)) kind.kb = Math.round(kind.kb);
  return kinds;
}

/** A CPU profile as Chrome's Profiler hands it over. */
export interface Profile {
  nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number } }[];
  samples?: number[];
  timeDeltas?: number[];
}

/**
 * Where a module's code is, in words: the game's own file by its path, a package by its name, the world package by
 * its file, and the profiler's own stand-ins for the time that is not a script's.
 */
export function moduleOf(url: string, functionName = ''): string {
  if (url === '') {
    if (functionName === '(idle)') return '(idle)';
    if (functionName === '(garbage collector)') return '(garbage collector)';
    if (functionName === '(program)') return '(the browser)';
    return '(native)';
  }
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]!;
  const dep = /\/node_modules\/\.vite\/deps\/([^/]+?)(?:\.js)?$/.exec(path)?.[1];
  // Vite flattens a package's name: `.` to `__`, `/` to `_` (`pixi.js` is `pixi__js`).
  if (dep !== undefined) {
    return dep.startsWith('chunk-') ? 'a shared package chunk' : dep.replace(/__/g, '.').replace(/_/g, '/');
  }
  const pkg = /\/node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(path)?.[1];
  if (pkg !== undefined) return pkg;
  const world = /\/packages\/([^/]+)\/src\/(.+)$/.exec(path);
  if (world !== null) return `@villages/${world[1]}: ${world[2]}`;
  const own = /\/src\/(.+)$/.exec(path)?.[1];
  if (own !== undefined) return own;
  return path;
}

/** The milliseconds of the CPU each function, and each module, spent in itself over a profile, the most first. */
export function spentIn(profile: Profile): {
  functions: Spent[];
  modules: Spent[];
  busy: number;
  idle: number;
  gc: number;
} {
  const byNode = new Map(profile.nodes.map((node) => [node.id, node]));
  const selfMs = new Map<number, number>();
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  // A sample's time is the gap to the next one: the time until the profiler looked again.
  samples.forEach((id, i) => selfMs.set(id, (selfMs.get(id) ?? 0) + (deltas[i + 1] ?? 0) / 1000));
  const functions = new Map<string, number>();
  const modules = new Map<string, number>();
  let idle = 0;
  let gc = 0;
  let busy = 0;
  for (const [id, ms] of selfMs) {
    const frame = byNode.get(id)?.callFrame;
    if (frame === undefined) continue;
    const module = moduleOf(frame.url, frame.functionName);
    if (module === '(idle)') {
      idle += ms;
      continue;
    }
    if (module === '(garbage collector)') gc += ms;
    busy += ms;
    modules.set(module, (modules.get(module) ?? 0) + ms);
    const name = `${frame.functionName || '(anonymous)'}${frame.url === '' ? '' : ` ${module}:${frame.lineNumber + 1}`}`;
    functions.set(name, (functions.get(name) ?? 0) + ms);
  }
  const most = (map: Map<string, number>, count: number) =>
    [...map]
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([name, ms]) => ({ name, ms: round(ms) }));
  return {
    functions: most(functions, 15),
    modules: most(modules, 12),
    busy: round(busy),
    idle: round(idle),
    gc: round(gc),
  };
}

/** The programs the page waited on compiling up to a moment, the longest first, to the millisecond. */
export function compiledOf(
  watched: { compiles?: readonly { at: number; ms: number; name: string }[] },
  until: number,
): { name: string; ms: number }[] {
  return (watched.compiles ?? [])
    .filter((compile) => compile.at <= until)
    .sort((a, b) => b.ms - a.ms)
    .map((compile) => ({ name: compile.name, ms: Math.round(compile.ms) }));
}

/** The load whose start was the middle one of several, which stands for them. */
export function middleOf<L extends { ready: number | null }>(loads: readonly L[]): L | null {
  const ready = loads.filter((load) => load.ready !== null).sort((a, b) => a.ready! - b.ready!);
  return ready[Math.floor((ready.length - 1) / 2)] ?? loads[0] ?? null;
}
