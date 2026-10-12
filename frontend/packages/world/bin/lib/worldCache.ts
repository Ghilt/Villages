import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import { isMainCheckout } from './checkouts.ts';
import { linkFiles, linkOnTheWay, linkTarget, patiently, placeFile, removeHere } from './links.ts';
import type { Parts } from './worldKeys.ts';
import { forMaster } from './worldSteps.ts';
import type { StepName, WorldStep } from './worldSteps.ts';

/**
 * The world cache: one shelf for the machine, an entry a world step and fingerprint, made once and never written
 * again, which every tree borrows by hard link (decision record 0095, `docs/plans/world-cache.md`).
 *
 *   <shelf>/<step>/<fingerprint>/            an entry: what the step made, laid out as in the repository,
 *                                            `key.json` last, naming what it was made from and every file in it
 *   <shelf>/<step>/<fingerprint>.making-...  an entry being made; never borrowed
 *   <shelf>/locks/                           who is making what (`locks.ts`)
 *   <shelf>/trash/                           entries on their way out
 *
 * Nothing here runs a tool: `readyWorld.ts` decides what to make, and this files it and lends it.
 */

/** What an entry is, written last into it: the fingerprint's parts, and the size and date of every file. */
export interface KeyFile {
  step: StepName;
  key: string;
  master: string | null;
  madeIn: string;
  madeAt: string;
  parts: Parts;
  files: Record<string, { size: number; mtimeMs: number }>;
}

/** The tree's own record of what it borrowed: for each master, or `*` for the styles, the fingerprint of each step. */
export type Borrowed = Record<string, Partial<Record<StepName, string>>>;

/** A tree's name as the world cache knows it: the folder of a worktree, or `main`. */
export const treeNameOf = (root: string): string => (isMainCheckout(root) ? 'main' : basename(root));

const posix = (path: string) => path.split('\\').join('/');

function filesUnder(root: string, folder = root): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(root, path));
    else if (entry.isFile()) found.push(posix(relative(root, path)));
  }
  return found;
}

export class Shelf {
  readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  entryOf(step: StepName, key: string): string {
    return join(this.dir, step, key);
  }

  /** The entry's `key.json`, when there is a whole entry for that step and fingerprint. */
  has(step: StepName, key: string): KeyFile | undefined {
    const at = join(this.entryOf(step, key), 'key.json');
    try {
      return JSON.parse(readFileSync(at, 'utf8')) as KeyFile;
    } catch {
      return undefined;
    }
  }

  /** What the tool printed as it made the entry, said again whenever it is borrowed. */
  saidBy(step: StepName, key: string): string {
    try {
      return readFileSync(join(this.entryOf(step, key), 'said.txt'), 'utf8');
    } catch {
      return '';
    }
  }

  /** A new folder beside the shelf for a tool to make an entry in, with `--into`. */
  making(step: StepName, key: string): string {
    const at = join(this.dir, step, `${key}.making-${process.pid}-${Date.now().toString(36)}`);
    mkdirSync(at, { recursive: true });
    return at;
  }

  /**
   * Files what a tool made in `making` as the entry for `step` and `key`, whole or not at all: everything the step
   * declares must be there, `key.json` goes in last, and the folder is renamed into place in one move. When another
   * tree filed the same entry first, its is kept and this one thrown away. Returns the entry, or why it was not filed.
   */
  file(
    making: string,
    made: { step: WorldStep; key: string; master: string; parts: Parts; said: string; madeIn: string },
  ): { entry?: string; problem?: string } {
    const { step, key } = made;
    const absent = step.makes
      .filter((one) => one.optional !== true && !existsSync(join(making, forMaster(one.path, made.master))))
      .map((one) => forMaster(one.path, made.master));
    if (absent.length > 0) {
      removeHere(making);
      return { problem: `it made no ${absent[0]}` };
    }
    const files: KeyFile['files'] = {};
    for (const path of filesUnder(making)) {
      const stat = statSync(join(making, path));
      files[path] = { size: stat.size, mtimeMs: stat.mtimeMs };
    }
    writeFileSync(join(making, 'said.txt'), made.said);
    const keyFile: KeyFile = {
      step: step.name,
      key,
      master: step.perMaster ? made.master : null,
      madeIn: made.madeIn,
      madeAt: new Date().toISOString(),
      parts: made.parts,
      files,
    };
    writeFileSync(join(making, 'key.json'), `${JSON.stringify(keyFile, null, 1)}\n`);
    const entry = this.entryOf(step.name, key);
    try {
      renameSync(making, entry);
    } catch (error) {
      if (this.has(step.name, key) === undefined) {
        throw error;
      }
      removeHere(making);
    }
    return { entry };
  }

  /** What is wrong with an entry: a file gone, or a file whose size or date is not what it was filed with. */
  problemsWith(step: StepName, key: string): string[] {
    const keyFile = this.has(step, key);
    if (keyFile === undefined) {
      return ['it is not there'];
    }
    const problems: string[] = [];
    for (const [path, filed] of Object.entries(keyFile.files)) {
      let stat;
      try {
        stat = statSync(join(this.entryOf(step, key), path));
      } catch {
        problems.push(`${path} is gone`);
        continue;
      }
      if (stat.size !== filed.size || stat.mtimeMs !== filed.mtimeMs) {
        problems.push(`${path} was written since it was filed`);
      }
      if (problems.length >= 3) break;
    }
    return problems;
  }

  /** Takes an entry off the shelf: moved aside in one move, so nothing borrows it from here on, then removed. */
  discard(step: StepName, key: string): void {
    const entry = this.entryOf(step, key);
    if (!existsSync(entry)) return;
    const aside = join(this.dir, 'trash', `${step}-${key}-${process.pid}-${Date.now().toString(36)}`);
    mkdirSync(dirname(aside), { recursive: true });
    renameSync(entry, aside);
    removeHere(aside);
  }

  lockOfTree(tree: string): string {
    return join(this.dir, 'locks', `tree-${tree}.lock`);
  }

  lockOfEntry(step: StepName, key: string): string {
    return join(this.dir, step, `${key}.lock`);
  }

  /** The machine's one lock around a tool that decodes a whole master: two at once want sixteen gigabytes. */
  lockOfHeavy(): string {
    return join(this.dir, 'locks', 'heavy.lock');
  }

  /** Where what each file hashes to is remembered, for every tree, by `worldKeys.ts`'s `HashMemo`. */
  hashesFile(): string {
    return join(this.dir, 'hashes.json');
  }
}

/**
 * Takes away a junction standing between `root` and `path`, the link alone, and gives the folder it showed back as
 * a real one whose files are hard links to the junction's: what a tree that junctioned the main checkout's whole
 * `public/world` by hand sees as before, its other masters included, with nothing left to delete through.
 */
export function splitJunctionsAbove(path: string, root: string): string[] {
  const split: string[] = [];
  for (
    let link = linkOnTheWay(dirname(path), root);
    link !== undefined;
    link = linkOnTheWay(dirname(path), root)
  ) {
    const target = linkTarget(link);
    removeHere(link);
    if (target !== undefined && existsSync(target)) {
      linkFiles(target, link);
    }
    split.push(`${posix(relative(root, link))}, a junction to ${target}`);
  }
  return split;
}

/**
 * Lends the entry at `entry` to the tree at `root`: each folder it makes is made again in the tree, beside where it
 * goes and moved into place, as hard links to the entry's files; each loose file is copied with the entry's date, in
 * the order the step lists them, data before manifest. A file the step makes only sometimes, missing from the entry,
 * goes from the tree too.
 */
export function borrow(entry: string, step: WorldStep, master: string, root: string): void {
  for (const made of step.makes) {
    const path = forMaster(made.path, master);
    const from = join(entry, path);
    const to = join(root, path);
    splitJunctionsAbove(to, root);
    if (!existsSync(from)) {
      removeHere(to);
      continue;
    }
    if (made.folder === true) {
      const beside = `${to}.borrowing-${process.pid}`;
      removeHere(beside);
      linkFiles(from, beside);
      removeHere(to);
      patiently(() => renameSync(beside, to));
    } else {
      placeFile(from, to);
    }
  }
}

/** Whether the tree at `root` serves the entry at `entry` for its step as it is: its files the entry's own, or copies of them. */
export function isBorrowed(
  entry: string,
  keyFile: KeyFile,
  step: WorldStep,
  master: string,
  root: string,
): boolean {
  for (const made of step.makes) {
    const path = posix(forMaster(made.path, master));
    const inEntry = Object.keys(keyFile.files).filter((file) =>
      made.folder === true ? file.startsWith(`${path}/`) : file === path,
    );
    if (inEntry.length === 0) {
      if (existsSync(join(root, path))) return false;
      continue;
    }
    // One file stands for its folder: a borrow is whole or is being made again.
    const sample = inEntry[0]!;
    let here;
    let there;
    try {
      here = statSync(join(root, sample));
      there = statSync(join(entry, sample));
    } catch {
      return false;
    }
    const same =
      made.folder === true
        ? here.ino === there.ino && here.dev === there.dev && here.ino !== 0
        : // A copy's date goes through milliseconds on its way, and loses what was finer.
          here.size === there.size && Math.abs(here.mtimeMs - there.mtimeMs) < 2;
    if (!same) return false;
  }
  return true;
}

/** Where a tree keeps its record of what it borrowed. */
export const borrowedFileOf = (root: string): string =>
  join(root, 'frontend', 'apps', 'web', 'public', 'world', 'borrowed.json');

export function readBorrowed(root: string): Borrowed {
  try {
    return JSON.parse(readFileSync(borrowedFileOf(root), 'utf8')) as Borrowed;
  } catch {
    return {};
  }
}

/** Writes down that the tree borrowed `key` for `step` of `master`, or `*` for a step the same for every master. */
export function noteBorrowed(root: string, master: string, step: StepName, key: string): void {
  const record = readBorrowed(root);
  record[master] = { ...record[master], [step]: key };
  const file = borrowedFileOf(root);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.${process.pid}`, `${JSON.stringify(record, null, 2)}\n`);
  renameSync(`${file}.${process.pid}`, file);
}
