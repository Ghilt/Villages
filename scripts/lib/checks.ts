import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reading what each of the repository's checks said, for `check.ts`: how many tests ran, passed, failed and were
 * skipped, and which ones failed, from the backend's test reports, Vitest's summary and Node's test runner.
 */

export interface Tally {
  readonly tests: number;
  readonly failed: number;
  readonly skipped: number;
  /** What failed, by name: a spec and its case, or a test file. */
  readonly failures: readonly string[];
}

const attribute = (tag: string, name: string): number =>
  Number(new RegExp(` ${name}="([0-9]+)"`).exec(tag)?.[1] ?? 0);

/** The JUnit reports Gradle writes, one a spec: every case counted, and each failed one named. */
export function readJUnit(reports: readonly string[]): Tally {
  let tests = 0;
  let failed = 0;
  let skipped = 0;
  const failures: string[] = [];
  for (const xml of reports) {
    const suite = /<testsuite\b[^>]*>/.exec(xml)?.[0];
    if (suite === undefined) continue;
    tests += attribute(suite, 'tests');
    skipped += attribute(suite, 'skipped');
    failed += attribute(suite, 'failures') + attribute(suite, 'errors');
    const spec = /\bname="([^"]*)"/.exec(suite)?.[1]?.split('.').pop() ?? '?';
    for (const failing of xml.matchAll(/<testcase name="([^"]*)"[^>]*>\s*<(?:failure|error)\b/g)) {
      failures.push(`${spec}: ${unescape(failing[1]!)}`);
    }
  }
  return { tests, failed, skipped, failures };
}

/**
 * Every module's test reports in a tree's backend, each with its module, as Gradle left them, written since `since`: everything when the check passed,
 * because a module whose tests did not need running keeps its last and they are still true; and only what this
 * run wrote when it failed, so that a build that broke before any test ran is not counted as the last one's.
 */
export function backendReports(root: string, since: number): { module: string; xml: string }[] {
  const backend = join(root, 'backend');
  return readdirSync(backend, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      module: entry.name,
      folder: join(backend, entry.name, 'build', 'test-results', 'test'),
    }))
    .filter(({ folder }) => existsSync(folder))
    .flatMap(({ module, folder }) =>
      readdirSync(folder)
        .filter((file) => file.endsWith('.xml') && statSync(join(folder, file)).mtimeMs >= since)
        .map((file) => ({ module, xml: readFileSync(join(folder, file), 'utf8') })),
    );
}

/** Vitest's last summary, `Tests  1376 passed | 1 failed (1377)`, and every test it marked failed. */
export function readVitest(coloured: string): Tally | null {
  const log = plain(coloured);
  const line = [...log.matchAll(/^\s*Tests\s+(.+)\(([0-9]+)\)\s*$/gm)].pop();
  if (line === undefined) return null;
  const count = (word: string) => Number(new RegExp(`([0-9]+) ${word}`).exec(line[1]!)?.[1] ?? 0);
  const failures = [...new Set([...log.matchAll(/^\s*FAIL\s+(.+?)\s*$/gm)].map((m) => m[1]!))];
  return { tests: Number(line[2]), failed: count('failed'), skipped: count('skipped'), failures };
}

/** Node's own test runner, `ℹ tests 52` and the rest, and every test it crossed out. */
export function readNodeTest(log: string): Tally | null {
  const count = (word: string) => Number(new RegExp(`^ℹ ${word} ([0-9]+)`, 'm').exec(log)?.[1] ?? NaN);
  if (Number.isNaN(count('tests'))) return null;
  const failures = [...new Set([...log.matchAll(/^\s*✖ (.+?)(?: \([0-9.]+ms\))?$/gm)].map((m) => m[1]!))];
  return { tests: count('tests'), failed: count('fail'), skipped: count('skipped'), failures };
}

/**
 * Playwright's list summary, `1 passed (39.7s)` and its kin, and every test it numbered as failed - `1) e2e/... ›
 * the map ... ───` - without the rule it draws after the name.
 */
export function readPlaywright(coloured: string): Tally | null {
  const log = plain(coloured);
  const count = (word: string) => Number(new RegExp(`^\\s+([0-9]+) ${word}\\b`, 'm').exec(log)?.[1] ?? 0);
  const [passed, failed, skipped] = [count('passed'), count('failed'), count('skipped')];
  if (passed + failed + skipped === 0) return null;
  const failures = [
    ...new Set([...log.matchAll(/^\s+[0-9]+\) (.+)$/gm)].map((m) => m[1]!.replace(/[─\s]+$/, ''))),
  ];
  return { tests: passed + failed + skipped, failed, skipped, failures };
}

/**
 * Which step of `npm run check` was under way when it stopped: npm says each one as it starts it, and the steps
 * run one after another until one fails.
 */
export function lastStep(log: string): string | null {
  // "> villages-frontend@0.0.0 lint", and not the command under it, "> vitest run", which has no version.
  return [...log.matchAll(/^> \S+@\S+ (\w+)$/gm)].pop()?.[1] ?? null;
}

/** A length of time as a person says it: 9s, 2m 41s. */
export function took(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

/** What a log said last, the lines worth reading when something failed: no blank lines and no stack frames. */
export function tail(log: string, lines = 25): string[] {
  return log
    .split(/\r?\n/)
    .map(plain)
    .filter((line) => line.trim() !== '' && !/^\s+at /.test(line))
    .slice(-lines);
}

/** A line without the colours a terminal would have drawn it in. */
function plain(line: string): string {
  return line.replace(/\u001b\[[0-9;]*m/g, '');
}

function unescape(text: string): string {
  return text
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}
