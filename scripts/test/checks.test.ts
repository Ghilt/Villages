import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lastStep, readJUnit, readNodeTest, readVitest, tail, took } from '../lib/checks.ts';

const passing = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="villages.occurrent.MarkersSpec" tests="4" skipped="0" failures="0" errors="0" time="0.1">
  <testcase name="a marker is passed" classname="villages.occurrent.MarkersSpec" time="0.05"/>
</testsuite>`;

const failing = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="villages.gateway.GatewaySessionsSpec" tests="3" skipped="1" failures="1" errors="0" time="0.2">
  <testcase name="hello is answered with &quot;welcome&quot;" classname="villages.gateway.GatewaySessionsSpec" time="0.1">
    <failure message="expected" type="AssertionFailedError">AssertionFailedError: expected</failure>
  </testcase>
  <testcase name="a takeover" classname="villages.gateway.GatewaySessionsSpec" time="0.1"/>
</testsuite>`;

describe("reading the checks' output", () => {
  it("counts every spec's cases from Gradle's reports, and names the failed ones by spec and case", () => {
    assert.deepEqual(readJUnit([passing, failing]), {
      tests: 7,
      failed: 1,
      skipped: 1,
      failures: ['GatewaySessionsSpec: hello is answered with "welcome"'],
    });
  });

  it("reads Vitest's summary, coloured or not, and names the files it failed", () => {
    const log = [
      ' \u001b[31mFAIL\u001b[39m  |web| src/stage/arrive.test.ts > something arriving on a phone > stays in the bay',
      ' Test Files  1 failed | 146 passed (147)',
      '      Tests  1 failed | 1376 passed (1377)',
    ].join('\n');
    assert.deepEqual(readVitest(log), {
      tests: 1377,
      failed: 1,
      skipped: 0,
      failures: ['|web| src/stage/arrive.test.ts > something arriving on a phone > stays in the bay'],
    });
    assert.equal(readVitest('no summary at all'), null);
  });

  it("reads Node's own test runner, and the tests it crossed out", () => {
    const log = ['✖ reads a master (3.2ms)', 'ℹ tests 52', 'ℹ pass 51', 'ℹ fail 1', 'ℹ skipped 0'].join('\n');
    assert.deepEqual(readNodeTest(log), { tests: 52, failed: 1, skipped: 0, failures: ['reads a master'] });
  });

  it("says which step of the frontend's check was under way, and not the command it ran", () => {
    const log = [
      '> villages-frontend@0.0.0 typecheck',
      '> tsc --noEmit -p apps/web',
      '> villages-frontend@0.0.0 test',
      '> vitest run',
    ].join('\n');
    assert.equal(lastStep(log), 'test');
    assert.equal(lastStep('nothing ran'), null);
  });

  it('says how long a part took as a person would, and leaves stack frames out of the last of a log', () => {
    assert.equal(took(9_400), '9s');
    assert.equal(took(161_000), '2m 41s');
    assert.deepEqual(tail('BUILD FAILED\n    at kotlin.Foo\n\nwhy it failed\n', 5), [
      'BUILD FAILED',
      'why it failed',
    ]);
  });
});
