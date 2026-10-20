import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  keptHistory,
  landingsOf,
  minutesFor,
  planOf,
  spread,
  withLongerScannerWait,
  worldStepsOf,
} from '../lib/history.ts';
import type { Landing } from '../lib/history.ts';

const sha = (n: number) => String(n).padStart(40, 'a');
const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}T12:00:00+02:00`;
const landing = (n: number): Landing => ({ sha: sha(n), at: day(n) });
const none = {
  shaders: new Set<string>(),
  zoom: new Set<string>(),
  startup: new Set<string>(),
  tests: new Set<string>(),
};

describe('the history to measure', () => {
  it("reads main's reflog as landings, oldest first, each commit at the first time main held it", () => {
    const reflog = [
      `${sha(3)} main@{${day(3)}} merge claude/three: Fast-forward`,
      `${sha(2)} main@{${day(2)}} merge claude/two: Fast-forward`,
      `${sha(1)} main@{${day(2)}} reset: moving to ${sha(1)}`,
      `${sha(1)} main@{${day(1)}} commit (initial): chore: begin`,
    ].join('\n');
    assert.deepEqual(landingsOf(reflog), [landing(1), landing(2), landing(3)]);
  });

  it('spreads a number of landings evenly in time, the first and the last always among them', () => {
    const landings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20].map(landing);
    assert.deepEqual(
      spread(landings, day(1), null, 3).map((each) => each.at),
      [day(1), day(10), day(20)],
    );
    assert.deepEqual(
      spread(landings, day(2), day(5), 10).map((each) => each.at),
      [day(2), day(3), day(4)],
    );
  });

  it('reads the world steps a quick start runs, in order, each once, with what follows its --', () => {
    const before = [
      "# The world. world:fetch is not run here: 'world:fetch' in a comment is not a step.",
      "Ensure 'tiles\\cut.json' 'cutting' @('run', 'world:tile') 'the world is cut' $Painted",
      "Ensure '..\\..\\paint.json' 'writing' @('run', 'world:paint', '--', '--config-only') 'written' @($a)",
      "$said = @(Said 'world:art')",
      "$said = @(Said 'world:art')",
    ].join('\n');
    assert.deepEqual(worldStepsOf(before), [
      { script: 'world:tile', args: [] },
      { script: 'world:paint', args: ['--config-only'] },
      { script: 'world:art', args: [] },
    ]);
    const after =
      "Run 'making the world current' $Npm @('run', '--silent', 'world:ready') $Frontend\n$s = @(Said 'world:ui')";
    assert.deepEqual(
      worldStepsOf(after).map((step) => step.script),
      ['world:ready', 'world:ui'],
    );
  });

  it('finds what a history file already keeps as history, and nothing else', () => {
    const text = [
      JSON.stringify({ why: 'history', code: { commit: sha(1) } }),
      JSON.stringify({ why: 'to-main', code: { commit: sha(2) } }),
      'not a point',
    ].join('\n');
    assert.deepEqual([...keptHistory(text)], [sha(1)]);
  });

  it('plans the drawn points from the world drawn now, the tests alone before it, and only what is still owed', () => {
    const landings = [1, 2, 3, 4, 5, 6, 7, 8].map(landing);
    const kept = { ...none, shaders: new Set([sha(8)]) };
    const points = planOf(
      landings,
      { drawnFrom: day(5), testsFrom: day(1), count: 2, earlierTests: 2 },
      kept,
    );
    assert.deepEqual(
      points.map((point) => [point.landing.at.slice(8, 10), point.measures.join(',')]),
      [
        ['01', 'tests'],
        ['04', 'tests'],
        ['05', 'shaders,zoom,startup,tests'],
        ['08', 'zoom,startup,tests'],
      ],
    );
    assert.equal(minutesFor(points.slice(0, 1)), 3 + 5);
  });

  it("lengthens an old world tool's wait for the virus scanner, and leaves any other file alone", () => {
    const old = [
      'if (attempt >= 6 || (code !== "EBUSY")) throw error;',
      'Atomics.wait(sleeper, 0, 0, 50 * 2 ** attempt);',
    ].join('\n');
    const longer = withLongerScannerWait(old);
    assert.match(longer ?? '', /attempt >= 95 \|\|/);
    assert.match(longer ?? '', /Math\.min\(50 \* 2 \*\* attempt, 2_000\)/);
    assert.equal(withLongerScannerWait('export function patiently() {}'), null);
  });
});
