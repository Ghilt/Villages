import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { scriptsRunBy, slowestFiles, specTimes, vitestDuration } from '../lib/record.ts';

const suite = (name: string, tests: number, seconds: number) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="villages.${name}" tests="${tests}" skipped="0" failures="0" errors="0" time="${seconds}">\n</testsuite>`;

describe('reading where the checks spent their time', () => {
  it("reads Vitest's account of its time, coloured or not, the whole and each stage in milliseconds", () => {
    const log = [
      ' Test Files  233 passed (233)',
      '\u001b[2m   Duration \u001b[22m 14.85s\u001b[2m (transform 32.70s, setup 0ms, import 63.33s, tests 55.55s, environment 34ms)\u001b[22m',
    ].join('\n');
    assert.deepEqual(vitestDuration(log), {
      whole: 14850,
      transform: 32700,
      setup: 0,
      import: 63330,
      tests: 55550,
      environment: 34,
    });
  });

  it('reads a Vitest duration of more than a minute, and none from a log without one', () => {
    assert.deepEqual(vitestDuration('   Duration  1m 2.5s (tests 70.00s)'), { whole: 62500, tests: 70000 });
    assert.equal(vitestDuration('no summary at all'), null);
  });

  it("names the slowest test files of Vitest's report from the folder it ran in, the slowest first", () => {
    const report = JSON.stringify({
      testResults: [
        { name: 'E:\\tree\\frontend\\apps\\web\\src\\a.test.ts', startTime: 1000, endTime: 1040 },
        { name: 'E:\\tree\\frontend\\apps\\web\\src\\b.test.ts', startTime: 1000, endTime: 1900 },
        { name: 'E:\\tree\\frontend\\packages\\world\\c.test.ts', startTime: 1000, endTime: 1300 },
      ],
    });
    assert.deepEqual(slowestFiles(report, 'E:\\tree\\frontend', 2), [
      { name: 'apps/web/src/b.test.ts', ms: 900 },
      { name: 'packages/world/c.test.ts', ms: 300 },
    ]);
    assert.deepEqual(slowestFiles('not json', 'E:\\tree'), []);
  });

  it("sums the backend's specs by module, and names the slowest by module and spec", () => {
    const reports = [
      { module: 'domain', xml: suite('domain.HouseSpec', 10, 0.5) },
      { module: 'gateway', xml: suite('gateway.GatewaySessionsSpec', 3, 4.25) },
      { module: 'domain', xml: suite('domain.FateSpec', 5, 1.5) },
    ];
    assert.deepEqual(specTimes(reports, 2), {
      modules: [
        { name: 'gateway', ms: 4250, tests: 3 },
        { name: 'domain', ms: 2000, tests: 15 },
      ],
      slowest: [
        { name: 'gateway: GatewaySessionsSpec', ms: 4250 },
        { name: 'domain: FateSpec', ms: 1500 },
      ],
    });
  });

  it('splits a script that only runs others into their names, and leaves any other whole', () => {
    assert.deepEqual(scriptsRunBy('npm run typecheck && npm run lint && npm run test'), [
      'typecheck',
      'lint',
      'test',
    ]);
    assert.equal(scriptsRunBy('vitest run'), null);
    assert.equal(scriptsRunBy('npm run lint && vitest run'), null);
    assert.equal(scriptsRunBy(''), null);
  });
});
