import { lstatSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { flag } from './flags.ts';
import { isLink, isShared, refuseLinked, removeHere } from './links.ts';
import { REPO } from './paths.ts';

/**
 * Where a world tool writes, and what it does first so that it never writes over a world it borrowed.
 *
 * Given `--into <folder>`, a tool writes everything it would have written under the repository under that folder
 * instead, laid out the same way: how the world cache has a tool make a new entry, beside the shelf, while the
 * tree goes on serving the world it has (decision record 0095). Without it a tool writes into the tree, as it
 * always did, and first takes back any part of its output the tree borrowed: the borrowed names go, the shelf's
 * files stay, and what the tool writes is the tree's own. Written into in place, a borrowed file would have
 * changed every tree's.
 */

const INTO = flag('into');

/** Where the tool writes what it would write at `path` in the repository. */
export function writtenAt(path: string): string {
  return INTO === undefined ? path : resolve(INTO, relative(REPO, path));
}

/** Whether a file under `folder` has another name: a folder of the world this tree borrowed. */
function holdsShared(folder: string): boolean {
  let entries;
  try {
    entries = readdirSync(folder, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    const path = join(folder, entry.name);
    if (entry.isDirectory() ? holdsShared(path) : isShared(path)) {
      return true;
    }
  }
  return false;
}

/**
 * Makes the folder at `path` - where `writtenAt` put it - the tool's own to write into: a junction there is taken
 * away, the link alone, and a borrowed folder is emptied of its borrowed names; a folder the tree made itself is
 * left as it is. Refuses, by throwing, when a junction stands above it, because whatever it points at is another
 * checkout's.
 */
export function ownFolder(path: string, what: string): void {
  if (INTO !== undefined) {
    return;
  }
  refuseLinked(dirname(path), REPO, what);
  if (isLink(path) || holdsShared(path)) {
    removeHere(path);
  }
}

/**
 * Empties the folder at `path` for a tool that makes it anew every time: whatever the tree had there, its own or
 * borrowed, goes with `removeHere`, which takes a borrowed file's name and never the world cache's file.
 */
export function freshFolder(path: string, what: string): void {
  if (INTO === undefined) {
    refuseLinked(dirname(path), REPO, what);
  }
  removeHere(path);
}

/** Makes the file at `path` the tool's own to write, as `ownFolder` makes a folder. */
export function ownFile(path: string, what: string): void {
  if (INTO !== undefined) {
    return;
  }
  refuseLinked(dirname(path), REPO, what);
  try {
    if (lstatSync(path).isSymbolicLink() || isShared(path)) {
      removeHere(path);
    }
  } catch {
    // Nothing there yet, which is the tool's to make.
  }
}
