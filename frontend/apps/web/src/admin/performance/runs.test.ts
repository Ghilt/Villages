import { describe, expect, it } from 'vitest';

import { judged, p95, parseRuns, rampedTo, runName, sharedLoad, stageAt } from './runs';

const stage = (players: number, welcome: number, warmUp = false, bent: string | null = null) => ({
  players,
  warmUp,
  rampMs: 100,
  trips: { WELCOME: { count: players, p50: welcome / 2, p95: welcome, p99: welcome + 1 }, SNAPSHOT: null },
  failedTrips: 0,
  lostBots: 0,
  reasons: {},
  reading: { heapUsedMb: 100, heapTotalMb: 200, threads: 40 },
  cpuMs: 500,
  bent,
});

/** The one run a line holds; the test fails here if it holds none. */
function firstRun(text: string) {
  const [only] = parseRuns(text).runs;
  if (only === undefined) throw new Error('no run');
  return only;
}

const run = (at: string, commit: string, players: number[], bentAt?: number) => ({
  at,
  code: { commit, branch: 'claude/somewhere', dirty: false },
  machine: { name: 'BOX', cpu: 'a cpu', cores: 20, memoryGb: 32 },
  settings: { stages: players, holdMs: 60000, bendMs: 500, bendShare: 0.01 },
  serverHeapGb: 8,
  startupMs: 3000,
  carried: players.at(-1),
  bentAt: null,
  bent: null,
  aborted: false,
  abortedWhy: null,
  stages: [
    stage(50, 900, true),
    ...players.map((count) =>
      stage(count, count / 10, false, count === bentAt ? 'the server ran out of memory' : null),
    ),
  ],
});

describe('the history of runs', () => {
  it('reads every run, oldest first, and counts a line that is not one without losing the rest', () => {
    const text = [
      JSON.stringify(run('2026-10-17T10:00:00Z', 'bbbbbbbbbb', [100])),
      'not json',
      JSON.stringify({ an: 'object that is no run' }),
      JSON.stringify(run('2026-10-16T10:00:00Z', 'aaaaaaaaaa', [100, 1000])),
      '',
    ].join('\n');

    const { runs, unreadable } = parseRuns(text);

    expect(runs.map((each) => each.code.commit)).toEqual(['aaaaaaaaaa', 'bbbbbbbbbb']);
    expect(unreadable).toBe(2);
  });

  it('judges a run without its warm-up, and reads a trip that was not made as nothing', () => {
    const only = firstRun(JSON.stringify(run('2026-10-16T10:00:00Z', 'aaaaaaaaaa', [100, 1000])));

    expect(judged(only).map((each) => each.players)).toEqual([100, 1000]);
    expect(p95(stageAt(only, 1000), 'WELCOME')).toBe(100);
    expect(p95(stageAt(only, 1000), 'SNAPSHOT')).toBeNull();
    expect(p95(stageAt(only, 50), 'WELCOME')).toBeNull();
  });

  it('compares runs at the largest load every one of them carried without bending', () => {
    const { runs } = parseRuns(
      [
        run('2026-10-16T10:00:00Z', 'a', [100, 1000, 2500]),
        run('2026-10-17T10:00:00Z', 'b', [100, 1000, 2500], 2500),
      ]
        .map((each) => JSON.stringify(each))
        .join('\n'),
    );

    expect(sharedLoad(runs)).toBe(1000);
    expect(sharedLoad([])).toBeNull();
  });

  it('names a run by its commit, day and time, and knows how far it set out to go', () => {
    const only = firstRun(JSON.stringify(run('2026-10-16T10:00:00Z', '33bebf97abcdef', [100])));
    expect(runName(only)).toMatch(/^33bebf9 16 Oct \d\d:\d\d$/);
    expect(rampedTo(only)).toBe(100);
  });
});
