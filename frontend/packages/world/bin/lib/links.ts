import {
  chmodSync,
  copyFileSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  utimesSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/**
 * Everything the world's tools do to a shared file, in one place, because a tree borrows its world from the world
 * cache and a write or a delete that reached the cache's own copy would change every tree's (decision record 0095).
 *
 * **A tree borrows by hard link, a file at a time, and never by junction.** A hard link is a second name for the
 * same file, so taking one away - by this code, by Explorer, or by `git worktree remove`, which deletes a tree - takes
 * the name and leaves the file to every other name it has. A junction is a folder that is another folder, and
 * `git worktree remove --force` empties the folder it points at, read-only files and all: what experiment 0019 found,
 * and why the dozen trees that junctioned the main checkout's tiles by hand are put right as they borrow.
 *
 * What a hard link does not protect against is a write made into it in place, which changes the file under every
 * name. So a borrowed file is never written: a tool refuses to, and anything that replaces one writes beside it and
 * renames over it, which replaces the name and leaves the shared file alone.
 */

/** Whether there is a link at `path`: a junction or a symbolic link. False when there is nothing there at all. */
export function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Where the link at `path` points, as an absolute path without Windows' `\\?\` prefix, or undefined when it is not one. */
export function linkTarget(path: string): string | undefined {
  if (!isLink(path)) {
    return undefined;
  }
  const said = readlinkSync(path)
    .replace(/^\\\\\?\\/, '')
    .replace(/^\\\?\?\\/, '');
  return resolve(dirname(path), said);
}

/** The same place, spelt the same way: Windows folds case and either slash, so two spellings of one folder compare equal. */
export function samePlace(one: string, other: string): boolean {
  const tidy = (path: string) => {
    const resolved = resolve(path).replace(/[\\/]+$/, '');
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  return tidy(one) === tidy(other);
}

/**
 * The first link met on the way from `root` down to `path`, `path` itself included and `root` not, or undefined.
 * A tool writing to `path` would write through it, into whatever it points at.
 */
export function linkOnTheWay(path: string, root: string): string | undefined {
  const below = relative(root, path);
  if (below === '' || below.startsWith('..') || isAbsolute(below)) {
    return isLink(path) ? path : undefined;
  }
  let at = root;
  for (const part of below.split(sep)) {
    at = join(at, part);
    if (isLink(at)) {
      return at;
    }
  }
  return undefined;
}

/** Refuses, by throwing, to let a tool write where a link stands between `root` and `path`: what is on the other side is another checkout's. */
export function refuseLinked(path: string, root: string, what: string): void {
  const link = linkOnTheWay(path, root);
  if (link !== undefined) {
    throw new Error(
      `not writing ${what}: ${link} is linked to ${linkTarget(link) ?? 'somewhere else'}, whose checkout makes it. ` +
        'npm run world:ready replaces the link with a world of this tree.',
    );
  }
}

const sleeper = new Int32Array(new SharedArrayBuffer(4));

const BUSY = new Set(['EBUSY', 'EPERM', 'ENOTEMPTY', 'EACCES']);

/**
 * How long a folder's rename waits for Windows to let go of the files in it. A folder cannot be renamed while any
 * file in it is open, and a virus scanner opens every file it sees made: on 2026-10-18 it held a tree's twenty
 * thousand freshly linked tiles for fifteen seconds, and for forty-five the next time they were borrowed.
 */
export const FOLDER_PATIENCE = 180_000;

/**
 * Runs `act` and tries again, for up to `within` milliseconds, while Windows says a file is busy: a virus scanner
 * holds a file it has just seen written for a moment, and a remove or rename in that moment fails with EBUSY or
 * EPERM. A file is let go of in a few seconds, the default; a folder of new files wants `FOLDER_PATIENCE`.
 * `waiting` is told once, when a second has gone by, how long it has waited, so that a long wait is not taken for a
 * hang.
 */
export function patiently<T>(
  act: () => T,
  { within = 3_000, waiting }: { within?: number; waiting?: (waited: number) => void } = {},
): T {
  const began = performance.now();
  let told = false;
  for (let attempt = 0; ; attempt++) {
    try {
      return act();
    } catch (error) {
      const waited = performance.now() - began;
      if (waited >= within || !BUSY.has((error as NodeJS.ErrnoException).code ?? '')) {
        throw error;
      }
      if (!told && waited >= 1_000) {
        told = true;
        waiting?.(waited);
      }
      Atomics.wait(sleeper, 0, 0, Math.min(50 * 2 ** attempt, 2_000, within - waited));
    }
  }
}

/**
 * Removes whatever is at `path`, and nothing a link points at: a link is unlinked where it stands, a folder is
 * emptied one entry at a time, each looked at with `lstat` first, and a hard link loses only its own name. What
 * every world tool uses in place of `rm -r`.
 */
export function removeHere(path: string): void {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return;
  }
  if (stat.isSymbolicLink()) {
    patiently(() => unlinkSync(path));
    return;
  }
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      removeHere(join(path, entry));
    }
    patiently(() => rmdirSync(path));
    return;
  }
  patiently(() => {
    try {
      unlinkSync(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EPERM' || stat.nlink > 1) {
        throw error;
      }
      chmodSync(path, 0o666);
      unlinkSync(path);
    }
  });
}

/**
 * Gives every file under the folder `from` a second name under the folder `to`, which becomes a folder of real
 * folders and hard-linked files: the same bytes on the disk once, however many trees borrow them. `to` must not be
 * there. The two must be on one drive, which every tree and the world cache are. Returns how many files it linked.
 */
export function linkFiles(from: string, to: string): number {
  mkdirSync(to, { recursive: true });
  let linked = 0;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const there = join(from, entry.name);
    const here = join(to, entry.name);
    if (entry.isDirectory()) {
      linked += linkFiles(there, here);
    } else if (entry.isFile()) {
      linkSync(there, here);
      linked += 1;
    }
  }
  return linked;
}

/**
 * Puts the file `from` at `to` in one move and with `from`'s date: made beside `to` and renamed over it, so a reader
 * never finds half a file, a reader that reloads on a date sees the date of what it was made from, and whatever was
 * at `to` - a hard link to a shared file among them - loses its name rather than its bytes. Hard-linked when
 * `hardLink` is asked, which is a borrow, and copied and writable when not.
 */
export function placeFile(from: string, to: string, hardLink = false): void {
  const made = statSync(from);
  mkdirSync(dirname(to), { recursive: true });
  const beside = `${to}.placing-${process.pid}`;
  removeHere(beside);
  if (hardLink) {
    linkSync(from, beside);
  } else {
    copyFileSync(from, beside);
    chmodSync(beside, 0o666);
    utimesSync(beside, made.atime, made.mtime);
  }
  if (isLink(to)) {
    patiently(() => unlinkSync(to));
  }
  patiently(() => renameSync(beside, to));
}

/** Whether the file at `path` has another name somewhere: a borrowed file, which must not be written in place. */
export function isShared(path: string): boolean {
  try {
    const stat = lstatSync(path);
    return stat.isFile() && stat.nlink > 1;
  } catch {
    return false;
  }
}
