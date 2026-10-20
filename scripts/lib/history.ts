/**
 * Which commits `perf-history.ts` measures, and what each needs before it can be: main's landings read from its
 * reflog, a few spread evenly over a stretch of them, the world steps a commit's own quick start runs, and what is
 * already kept, so that a run stopped part way carries on where it was. See decision record 0106.
 */

/** A commit main came to hold, and when it first did. */
export interface Landing {
  readonly sha: string;
  readonly at: string;
}

/** What is measured, in the order a point is measured: the card's three first, the tests last. */
export const MEASURES = ['shaders', 'zoom', 'startup', 'tests'] as const;
export type Measure = (typeof MEASURES)[number];

/** A commit to measure, and which of the measures it is still owed. */
export interface HistoryPoint {
  readonly landing: Landing;
  readonly measures: readonly Measure[];
}

/** A world step a commit's quick start runs: the npm script and what it is given after `--`. */
export interface WorldStep {
  readonly script: string;
  readonly args: readonly string[];
}

/**
 * Main's reflog, `git reflog show --date=iso-strict --format="%H %gd" main`, newest first, as landings oldest first:
 * each commit once, at the first time main held it.
 */
export function landingsOf(reflog: string): Landing[] {
  const seen = new Set<string>();
  const landings: Landing[] = [];
  const lines = reflog.trim().split(/\r?\n/).reverse();
  for (const line of lines) {
    const match = /^([0-9a-f]{40}) \S+@\{([^}]+)\}/.exec(line.trim());
    if (match === null || seen.has(match[1]!)) continue;
    seen.add(match[1]!);
    landings.push({ sha: match[1]!, at: match[2]! });
  }
  return landings;
}

/**
 * `count` landings from `from` up to `until` (or the last), spread evenly in time: for each of `count` evenly spaced
 * times from the first landing to the last, the nearest landing not yet taken. The first and the last are always
 * among them; every landing when there are no more than `count`.
 */
export function spread(
  landings: readonly Landing[],
  from: string,
  until: string | null,
  count: number,
): Landing[] {
  const time = (landing: Landing) => Date.parse(landing.at);
  const within = landings.filter(
    (landing) => time(landing) >= Date.parse(from) && (until === null || time(landing) < Date.parse(until)),
  );
  if (within.length <= count) return within;
  if (count <= 0) return [];
  const first = time(within[0]!);
  const last = time(within.at(-1)!);
  const taken = new Set<Landing>();
  for (let index = 0; index < count; index += 1) {
    const target = count === 1 ? last : first + ((last - first) * index) / (count - 1);
    const nearest = within
      .filter((landing) => !taken.has(landing))
      .reduce((best, landing) =>
        Math.abs(time(landing) - target) < Math.abs(time(best) - target) ? landing : best,
      );
    taken.add(nearest);
  }
  return within.filter((landing) => taken.has(landing));
}

/**
 * The world steps a commit's quick start runs, in its order, read from `debug-quick-start.ps1`: each `world:` script
 * named in quotes - `@('run', 'world:tile')`, `@('run', '--silent', 'world:ready')`, `Said 'world:art'` - with the
 * quoted arguments that follow it in the same list, `'world:paint', '--', '--config-only'`. Each once. A step the
 * quick start ran only when its output was missing is run whatever is there; the steps make the same files again.
 */
export function worldStepsOf(quickStart: string): WorldStep[] {
  const steps: WorldStep[] = [];
  const code = quickStart
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
  for (const match of code.matchAll(/'(world:[\w-]+)'((?:\s*,\s*'[^']*')*)/g)) {
    const script = match[1]!;
    if (steps.some((step) => step.script === script)) continue;
    const args = [...match[2]!.matchAll(/'([^']*)'/g)].map((arg) => arg[1]!);
    steps.push({ script, args: args[0] === '--' ? args.slice(1) : args });
  }
  return steps;
}

/** The commits a measure's history file already keeps as history: what a run carried on passes over. */
export function keptHistory(text: string): Set<string> {
  const kept = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    try {
      const point = JSON.parse(line) as { why?: string; code?: { commit?: string } } | null;
      if (point?.why === 'history' && typeof point.code?.commit === 'string') kept.add(point.code.commit);
    } catch {
      // not a point
    }
  }
  return kept;
}

/**
 * The points of a backfill: `count` landings spread from `drawnFrom` measured by every measure, the drawn ones only
 * since the world they draw was the one drawn now; and `earlierTests` more spread from `testsFrom` up to `drawnFrom`,
 * the tests alone. Each owes only the measures not already kept for it; a point owed nothing is left out.
 */
export function planOf(
  landings: readonly Landing[],
  options: { drawnFrom: string; testsFrom: string; count: number; earlierTests: number },
  kept: Readonly<Record<Measure, ReadonlySet<string>>>,
  measures: readonly Measure[] = MEASURES,
): HistoryPoint[] {
  const owed = (landing: Landing, of: readonly Measure[]): HistoryPoint => ({
    landing,
    measures: of.filter((measure) => measures.includes(measure) && !kept[measure].has(landing.sha)),
  });
  return [
    ...spread(landings, options.testsFrom, options.drawnFrom, options.earlierTests).map((landing) =>
      owed(landing, ['tests']),
    ),
    ...spread(landings, options.drawnFrom, null, options.count).map((landing) => owed(landing, MEASURES)),
  ].filter((point) => point.measures.length > 0);
}

/** About how many minutes each piece of a point takes on this machine: its world, its install, each measure. */
export const MINUTES: Readonly<Record<Measure | 'world' | 'install', number>> = {
  shaders: 12,
  zoom: 4,
  startup: 4,
  tests: 5,
  world: 8,
  install: 3,
};

/** About how many minutes a plan takes: every measure owed, an install a point, and a world for a drawn point. */
export function minutesFor(points: readonly HistoryPoint[]): number {
  return points.reduce(
    (sum, point) =>
      sum +
      MINUTES.install +
      (point.measures.some((measure) => measure !== 'tests') ? MINUTES.world : 0) +
      point.measures.reduce((each, measure) => each + MINUTES[measure], 0),
    0,
  );
}
