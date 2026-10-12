import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { WORLD_STEPS, forMaster } from './worldSteps.ts';
import type { StepName, WorldStep } from './worldSteps.ts';

/**
 * A world step's fingerprint: a hash of everything its output is made from, which is what the world cache files
 * it under (decision record 0095). Two trees with the same inputs work out the same one, and any change to one of
 * them moves it, so a world on the shelf under a fingerprint is the world those inputs make.
 *
 * Made of:
 * - the step as the table declares it - its tool, its options, what it reads and makes;
 * - the tool's own code and every file it imports at run time, followed import by import, `import type` skipped
 *   because it is gone before the code runs;
 * - the versions of the libraries the world package installs;
 * - the bytes of every file it is made from, or that a file is absent, and the master's name;
 * - the fingerprints of the steps it reads the output of.
 *
 * Never a date: a date says when a file was saved, and git gives every file of a new checkout the date of the
 * checkout, which is what made every tree build its world again from nothing.
 */

/** What a fingerprint is made of, kept beside every entry so that a change can be named. */
export interface Parts {
  step: string;
  master: string | null;
  code: Record<string, string>;
  libraries: Record<string, string>;
  from: Record<string, string>;
  after: Record<string, string>;
}

export interface Fingerprint {
  step: WorldStep;
  key: string;
  parts: Parts;
  /** The inputs the step cannot be made without that are not there. Empty when it can be made. */
  missing: string[];
}

/** What a file has been found to hash to, by where it is on the disk and its size and date, so a second ask is free. */
export class HashMemo {
  private readonly known = new Map<string, string>();
  private changed = false;
  private readonly file: string | undefined;

  constructor(file?: string) {
    this.file = file;
    if (file !== undefined && existsSync(file)) {
      try {
        for (const [at, hash] of Object.entries(
          JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>,
        )) {
          this.known.set(at, hash);
        }
      } catch {
        // A memo that cannot be read is a memo of nothing: everything is hashed again.
      }
    }
  }

  /** The hash of the file at `path`, or of the part of its JSON named `part`, or `absent`. */
  hashOf(path: string, part?: string): string {
    let stat;
    try {
      stat = statSync(path);
    } catch {
      return 'absent';
    }
    // The file's own number on the disk is part of it, so that a hard link in another tree shares what was found.
    const at = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${resolve(path)}${part === undefined ? '' : `#${part}`}`;
    const shared = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}${part === undefined ? '' : `#${part}`}`;
    const found = this.known.get(stat.ino === 0 ? at : shared);
    if (found !== undefined) {
      return found;
    }
    const bytes = readFileSync(path);
    const hash =
      part === undefined
        ? sha(bytes)
        : sha(JSON.stringify((JSON.parse(bytes.toString('utf8')) as Record<string, unknown>)[part] ?? null));
    this.known.set(stat.ino === 0 ? at : shared, hash);
    this.changed = true;
    return hash;
  }

  /** Keeps what was found for the next run, written beside and renamed over, so two runs at once lose nothing worse than a memo. */
  save(): void {
    if (this.file === undefined || !this.changed) {
      return;
    }
    mkdirSync(dirname(this.file), { recursive: true });
    const beside = `${this.file}.${process.pid}`;
    writeFileSync(beside, JSON.stringify(Object.fromEntries(this.known)));
    renameSync(beside, this.file);
    this.changed = false;
  }
}

export const sha = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

/** Runtime imports of a TypeScript file: relative ones, `import type` and `export type` left out. */
const IMPORTS =
  /(?:^|[\n;])\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;

/** The tool's code and everything it imports at run time, each by its path from `root` and its hash. */
export function codeOf(tool: string, root: string, memo: HashMemo): Record<string, string> {
  const code: Record<string, string> = {};
  const waiting = [resolve(root, tool)];
  while (waiting.length > 0) {
    const file = waiting.pop()!;
    const named = relative(root, file).replaceAll('\\', '/');
    if (named in code || !existsSync(file)) {
      continue;
    }
    code[named] = memo.hashOf(file);
    for (const found of readFileSync(file, 'utf8').matchAll(IMPORTS)) {
      if (found[1] === undefined) {
        waiting.push(resolve(dirname(file), found[2]!));
      }
    }
  }
  return Object.fromEntries(Object.entries(code).sort(([a], [b]) => a.localeCompare(b)));
}

/** The versions of the libraries the world package installs, as installed, or `absent`. */
export function librariesOf(root: string): Record<string, string> {
  const own = JSON.parse(
    readFileSync(join(root, 'frontend', 'packages', 'world', 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const names = Object.keys({ ...own.dependencies, ...own.devDependencies }).sort();
  return Object.fromEntries(
    names.map((name) => {
      const at = join(root, 'frontend', 'node_modules', name, 'package.json');
      return [
        name,
        existsSync(at) ? (JSON.parse(readFileSync(at, 'utf8')) as { version: string }).version : 'absent',
      ];
    }),
  );
}

/** Puts a fingerprint's parts in one order, so that the same parts always hash to the same key. */
const keyOf = (parts: Parts): string => sha(JSON.stringify(parts)).slice(0, 24);

/**
 * Every step's fingerprint for the master `master`, in the order the steps are made, the ones it reads from
 * first. `root` is the tree whose inputs are read.
 */
export function fingerprintsOf(
  master: string,
  options: { root: string; memo: HashMemo; steps?: readonly WorldStep[] },
): Map<StepName, Fingerprint> {
  const { root, memo } = options;
  const steps = options.steps ?? WORLD_STEPS;
  const libraries = librariesOf(root);
  const done = new Map<StepName, Fingerprint>();
  for (const step of steps) {
    const from: Record<string, string> = {};
    const missing: string[] = [];
    for (const input of step.from) {
      const path = forMaster(input.path, master);
      const hash = memo.hashOf(join(root, path), input.part);
      from[input.part === undefined ? path : `${path}#${input.part}`] = hash;
      if (hash === 'absent' && input.optional !== true) {
        missing.push(path);
      }
    }
    const after: Record<string, string> = {};
    for (const before of step.after) {
      const made = done.get(before);
      if (made === undefined) {
        throw new Error(`${step.name} is listed before ${before}, which it reads from`);
      }
      after[before] = made.key;
      missing.push(...made.missing.map((path) => `${path}, for ${before}`));
    }
    // What the step reads and makes, and how its tool is told: not its words, its memory or whether it is heavy,
    // which change nothing it makes.
    const declared = {
      tool: step.tool,
      options: step.options,
      from: step.from,
      after: step.after,
      makes: step.makes,
    };
    const parts: Parts = {
      step: sha(JSON.stringify(declared)),
      master: step.perMaster ? master : null,
      code: codeOf(step.tool, root, memo),
      libraries,
      from,
      after,
    };
    done.set(step.name, { step, key: keyOf(parts), parts, missing });
  }
  return done;
}

/** What changed between the parts a fingerprint was made of then and now, a line each, in plain words. */
export function whatMoved(then: Parts | undefined, now: Parts): string[] {
  if (then === undefined) {
    return ['nothing was made before'];
  }
  const moved: string[] = [];
  if (then.step !== now.step) moved.push('the step itself was changed in worldSteps.ts');
  if (then.master !== now.master) moved.push(`it is another master, ${now.master}`);
  const differ = (was: Record<string, string>, is: Record<string, string>, say: (name: string) => string) => {
    for (const name of new Set([...Object.keys(was), ...Object.keys(is)])) {
      if (was[name] !== is[name]) {
        moved.push(
          is[name] === undefined || is[name] === 'absent'
            ? `${name} is gone`
            : was[name] === undefined || was[name] === 'absent'
              ? `${name} is new`
              : say(name),
        );
      }
    }
  };
  differ(then.from, now.from, (name) => `${name} changed`);
  differ(then.code, now.code, (name) => `${name}, its code, changed`);
  differ(then.libraries, now.libraries, (name) => `${name} is another version`);
  differ(then.after, now.after, (name) => `${name}, which it is made from, was made again`);
  return moved;
}
