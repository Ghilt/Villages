import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * No source file may pass 400 lines, and one already past it may only get shorter.
 *
 * `size-ceilings.txt`, at the repository root, lists every source file over the limit with its length today. A
 * listed file that grows fails here, and so does one that shrinks without its number coming down with it, and
 * one that is not listed and passes the limit. The files every mechanic used to grow by a few dozen lines were
 * exactly the long ones, so holding them is what makes a change find a place of its own. This half holds
 * everything that is not Kotlin, wherever it is in the repository; backend/arch-tests holds the Kotlin files to
 * the same list. See docs/adr/0072.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MOST = 400;

/** Source, as opposed to data and documents. Kotlin is the other half's. */
const SOURCE = /\.(ts|tsx|mts|cts|js|mjs|cjs|css|ps1|sh|cmd)$/;

/**
 * The repository's own files: tracked, or new and not ignored. Asking git rather than walking the disk is what
 * leaves out the other worktrees under `.claude/`, `node_modules` and every generated world.
 */
function sourceFiles(): string[] {
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return [...new Set(listed.split('\n').filter((path) => SOURCE.test(path)))].sort();
}

/** The list, as path to the length it may not pass. Blank lines and the comments at its head say nothing. */
function ceilings(): Map<string, number> {
  const ceilings = new Map<string, number>();
  for (const line of readFileSync(`${ROOT}size-ceilings.txt`, 'utf8').split('\n')) {
    const written = line.trim();
    if (written === '' || written.startsWith('#')) {
      continue;
    }
    const space = written.indexOf(' ');
    ceilings.set(written.slice(space + 1), Number(written.slice(0, space)));
  }
  return ceilings;
}

/** As an editor numbers them: every line break, and the last line when it has none. */
export function linesOf(text: string): number {
  let breaks = 0;
  for (const character of text) {
    if (character === '\n') {
      breaks++;
    }
  }
  return text.length > 0 && !text.endsWith('\n') ? breaks + 1 : breaks;
}

/** What is wrong, one sentence a file, saying what to do about it. */
export function problemsWith(measured: Map<string, number>, listed: Map<string, number>): string[] {
  const problems: string[] = [];
  for (const [path, lines] of measured) {
    const ceiling = listed.get(path);
    if (ceiling === undefined) {
      if (lines > MOST) {
        problems.push(`${path} is ${lines} lines, past ${MOST}: move something out of it`);
      }
    } else if (lines > ceiling) {
      problems.push(`${path} grew from ${ceiling} to ${lines} lines: move something out of it first`);
    } else if (lines <= MOST) {
      problems.push(`${path} is down to ${lines} lines: take it off size-ceilings.txt`);
    } else if (lines < ceiling) {
      problems.push(`${path} came down to ${lines} lines: lower its number in size-ceilings.txt`);
    }
  }
  for (const path of listed.keys()) {
    if (!measured.has(path)) {
      problems.push(`${path} is on size-ceilings.txt and is not in the tree: take it off`);
    }
  }
  return problems;
}

describe('the size ceilings', () => {
  it('hold every file but the Kotlin, which the backend holds', () => {
    const measured = new Map<string, number>();
    for (const path of sourceFiles()) {
      let text: string;
      try {
        text = readFileSync(`${ROOT}${path}`, 'utf8');
      } catch {
        // Deleted and not yet staged: it is not in the tree.
        continue;
      }
      measured.set(path, linesOf(text));
    }
    const listed = new Map([...ceilings()].filter(([path]) => SOURCE.test(path)));
    expect(problemsWith(measured, listed)).toEqual([]);
  });

  it('count lines as an editor numbers them', () => {
    expect(linesOf('')).toBe(0);
    expect(linesOf('one')).toBe(1);
    expect(linesOf('one\n')).toBe(1);
    expect(linesOf('one\ntwo')).toBe(2);
    expect(linesOf('one\r\ntwo\r\n')).toBe(2);
    expect(linesOf('one\n\n')).toBe(2);
  });

  it('say what to do about each file', () => {
    const listed = new Map([
      ['grew.ts', 500],
      ['shrank.ts', 500],
      ['small.ts', 500],
      ['gone.ts', 500],
      ['held.ts', 500],
    ]);
    const measured = new Map([
      ['grew.ts', 501],
      ['shrank.ts', 450],
      ['small.ts', 400],
      ['held.ts', 500],
      ['new.ts', 401],
      ['fine.ts', 400],
    ]);
    expect(problemsWith(measured, listed)).toEqual([
      'grew.ts grew from 500 to 501 lines: move something out of it first',
      'shrank.ts came down to 450 lines: lower its number in size-ceilings.txt',
      'small.ts is down to 400 lines: take it off size-ceilings.txt',
      'new.ts is 401 lines, past 400: move something out of it',
      'gone.ts is on size-ceilings.txt and is not in the tree: take it off',
    ]);
  });
});
