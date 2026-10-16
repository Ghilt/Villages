/**
 * The history of swarm runs as the performance page reads it: `docs/experiments/performance/runs.jsonl`, one run a
 * line, written by `backend/load-bots` (`History.kt`) and never by the page. A line that is not a run is counted and
 * left out, so one broken line never hides the rest. See `docs/plans/bot-swarm.md`.
 */

export type TripKey = 'WELCOME' | 'ACCEPTED' | 'SNAPSHOT';

/** The three round trips a bot times, in the order the page shows them, with the words it shows them by. */
export const TRIPS: readonly { readonly key: TripKey; readonly words: string; readonly what: string }[] = [
  { key: 'WELCOME', words: 'welcome', what: 'hello to welcome' },
  { key: 'ACCEPTED', words: 'answer', what: 'a command to its answer' },
  { key: 'SNAPSHOT', words: 'cells', what: 'asking for a cell to being sent it' },
];

export interface Percentiles {
  readonly count: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
}

export interface Stage {
  readonly players: number;
  readonly warmUp: boolean;
  readonly rampMs: number;
  readonly trips: Partial<Record<TripKey, Percentiles | null>>;
  readonly failedTrips: number;
  readonly lostBots: number;
  readonly reasons: Record<string, number>;
  readonly reading: { readonly heapUsedMb: number; readonly heapTotalMb: number; readonly threads: number };
  readonly cpuMs: number;
  readonly bent: string | null;
}

export interface Run {
  readonly at: string;
  readonly code: { readonly commit: string; readonly branch: string; readonly dirty: boolean };
  readonly machine: {
    readonly name: string;
    readonly cpu: string;
    readonly cores: number;
    readonly memoryGb: number;
  };
  readonly settings: {
    readonly stages: readonly number[];
    readonly holdMs: number;
    readonly bendMs: number;
    readonly bendShare: number;
  };
  readonly serverHeapGb: number;
  readonly startupMs: number | null;
  readonly carried: number | null;
  readonly bentAt: number | null;
  readonly bent: string | null;
  readonly aborted: boolean;
  readonly abortedWhy: string | null;
  readonly stages: readonly Stage[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isRun(value: unknown): value is Run {
  return (
    isObject(value) &&
    typeof value.at === 'string' &&
    isObject(value.code) &&
    typeof value.code.commit === 'string' &&
    Array.isArray(value.stages) &&
    value.stages.every(
      (stage) => isObject(stage) && typeof stage.players === 'number' && isObject(stage.trips),
    )
  );
}

/** Every run in the file, oldest first, and how many lines were not runs. */
export function parseRuns(text: string): { readonly runs: readonly Run[]; readonly unreadable: number } {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const runs: Run[] = [];
  let unreadable = 0;
  for (const line of lines) {
    try {
      const parsed: unknown = JSON.parse(line);
      if (isRun(parsed)) runs.push(parsed);
      else unreadable++;
    } catch {
      unreadable++;
    }
  }
  return { runs: [...runs].sort((a, b) => a.at.localeCompare(b.at)), unreadable };
}

/** The stages a run was judged on: all but the warm-up. */
export const judged = (run: Run): readonly Stage[] => run.stages.filter((stage) => !stage.warmUp);

/** The p95 of one trip at one stage, when the stage made any. */
export const p95 = (stage: Stage | undefined, trip: TripKey): number | null =>
  stage?.trips[trip]?.p95 ?? null;

/**
 * A run by its commit, day and time, as a reader tells runs apart: `33bebf9 16 Oct 19:40`, with a mark when the tree
 * had changes beyond the commit. Two runs of one commit differ by the time.
 */
export function runName(run: Run): string {
  const when = new Date(run.at);
  const day = when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${run.code.commit.slice(0, 7)}${run.code.dirty ? '*' : ''} ${day} ${time}`;
}

/** The most players a run set out to reach: a run that carried them all was never pushed past them. */
export const rampedTo = (run: Run): number | null => run.settings.stages.at(-1) ?? null;

/** The judged stage of a run at exactly this many players, which is how two runs are compared under one load. */
export const stageAt = (run: Run, players: number): Stage | undefined =>
  judged(run).find((stage) => stage.players === players);

/**
 * The load the page compares runs at: the largest that every run carried without bending, so a later run is held to
 * the same and a stage where a server fell over is never read as a round trip.
 */
export function sharedLoad(runs: readonly Run[]): number | null {
  const each = runs.map(
    (run) =>
      new Set(
        judged(run)
          .filter((stage) => stage.bent === null)
          .map((stage) => stage.players),
      ),
  );
  const [first] = each;
  if (first === undefined) return null;
  const shared = [...first].filter((players) => each.every((set) => set.has(players)));
  return shared.length === 0 ? null : Math.max(...shared);
}
