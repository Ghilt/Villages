import { describe, expect, it } from 'vitest';

import { lineOf } from './shaderPoints';
import { readTestsPoints, stepOf } from './testsPoints';
import type { TestsPoint } from './testsPoints';

const point = (
  commit: string,
  at: string,
  cpu = '13th Gen Intel(R) Core(TM) i5-13500, 20 threads',
): TestsPoint => ({
  method: 1,
  why: 'history',
  measuredAt: '2026-10-20T08:00:00.000Z',
  code: { commit, subject: `the ${commit} commit`, landedAt: at, dirty: false },
  machine: { cpu, memory: '32 GB', os: 'win32 10.0.26300' },
  docker: true,
  ms: 300_000,
  parts: [
    {
      name: 'backend',
      passed: true,
      ms: 120_000,
      steps: [
        { name: 'compile', ms: 20_000 },
        { name: 'check', ms: 100_000 },
      ],
      tests: 900,
      failed: 0,
      skipped: 0,
    },
    {
      name: 'e2e',
      passed: false,
      notRun: 'no end-to-end test in this tree',
      ms: 0,
      steps: [],
      tests: null,
      failed: 0,
      skipped: 0,
    },
  ],
});

describe('the tests’ points', () => {
  it('reads a point a line, and counts the lines that are not points', () => {
    const text = [JSON.stringify(point('aaaaaaa1', '2026-09-03T10:00:00+02:00')), '{"method":1}', ''].join(
      '\n',
    );
    const { points, unreadable } = readTestsPoints(text);
    expect(points.map((each) => each.code.commit)).toEqual(['aaaaaaa1']);
    expect(unreadable).toBe(1);
  });

  it('draws as one line only the points measured on the latest one’s CPU, in the order their code was the game’s', () => {
    const points = [
      point('bbbbbbb2', '2026-10-10T10:00:00+02:00'),
      point('ccccccc3', '2026-10-05T10:00:00+02:00', 'another CPU'),
      point('aaaaaaa1', '2026-09-03T10:00:00+02:00'),
    ];
    expect(lineOf(points).map((each) => each.code.commit)).toEqual(['aaaaaaa1', 'bbbbbbb2']);
  });

  it('finds a step of a part by its name, and none for a step or a part it does not have', () => {
    const backend = point('aaaaaaa1', '2026-09-03T10:00:00+02:00').parts[0];
    expect(stepOf(backend, 'compile')).toBe(20_000);
    expect(stepOf(backend, 'lint')).toBeNull();
    expect(stepOf(undefined, 'check')).toBeNull();
  });
});
