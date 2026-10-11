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
