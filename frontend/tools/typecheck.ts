import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, resolve } from 'node:path';

import { PROJECTS } from './projects.ts';

/**
 * The frontend's typecheck, `npm run typecheck`: every project's `tsc --noEmit` at once rather than one after another,
 * and each incremental, its build info kept in `node_modules/.cache/tsc/`, so a project nothing touched since the last
 * check is checked in a moment. One after another the eleven took 16 s (2026-10-20). It says each project that failed
 * with all of what the compiler said, and ends with 1 when any did.
 */

const FRONTEND = resolve(import.meta.dirname, '..');
const TSC = join(FRONTEND, 'node_modules', 'typescript', 'bin', 'tsc');
const CACHE = join(FRONTEND, 'node_modules', '.cache', 'tsc');

interface Checked {
  readonly project: string;
  readonly code: number;
  readonly said: string;
  readonly ms: number;
}

function check(project: string): Promise<Checked> {
  const began = Date.now();
  const info = join(CACHE, `${project.replace(/[\\/.]/g, '-')}.tsbuildinfo`);
  const args = [TSC, '--noEmit', '--incremental', '--tsBuildInfoFile', info, '-p', project];
  return new Promise((done) => {
    const child = spawn(process.execPath, args, { cwd: FRONTEND });
    let said = '';
    child.stdout.on('data', (chunk: Buffer) => (said += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (said += chunk.toString()));
    child.on('error', (error) => done({ project, code: 1, said: String(error), ms: Date.now() - began }));
    child.on('close', (code) => done({ project, code: code ?? 1, said, ms: Date.now() - began }));
  });
}

/** Runs `work` over `items` with at most `width` at once, keeping their order in what it answers. */
async function atMost<T, R>(items: readonly T[], width: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(width, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]!);
    }
  });
  await Promise.all(lanes);
  return results;
}

mkdirSync(CACHE, { recursive: true });
const began = Date.now();
// Each compiler wants a core and a few hundred megabytes; half the machine's threads leaves room for the rest of it.
const checked = await atMost([...PROJECTS], Math.max(2, Math.floor(availableParallelism() / 2)), check);
const failed = checked.filter((each) => each.code !== 0);
for (const each of failed) {
  console.log(`\n${each.project} failed:\n${each.said.trimEnd()}`);
}
const seconds = ((Date.now() - began) / 1000).toFixed(1);
console.log(
  failed.length === 0
    ? `${checked.length} projects typecheck, in ${seconds} s`
    : `\n${failed.length} of ${checked.length} projects do not typecheck: ${failed.map((each) => each.project).join(', ')}`,
);
// The answer is the exit code, set rather than given to process.exit, which on Windows can cut what was printed short.
process.exitCode = failed.length === 0 ? 0 : 1;
