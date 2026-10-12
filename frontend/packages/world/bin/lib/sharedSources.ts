import { existsSync, linkSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { isMainCheckout, mainCheckout } from './checkouts.ts';
import { isLink, linkTarget, removeHere } from './links.ts';
import { REPO } from './paths.ts';

/**
 * The downloads the world is built from - Natural Earth, ETOPO, the land cover, 4.9 GB in all - are the main
 * checkout's, fetched once, and a worktree borrows each file it lacks by hard link rather than fetching its own.
 * Before this every fresh tree downloaded ETOPO's 444 MB for the relief and carried no names at all, because the
 * names are read from Natural Earth and nobody fetched it there. See decision record 0095.
 *
 * A file the tree already has is its own and is left alone, whatever its size. A junction where the folder should
 * be, which three trees were given by hand, is taken away, the link alone: `git worktree remove` would otherwise
 * empty the main checkout's downloads through it (experiment 0019).
 */

export interface Borrowed {
  /** What to say about it, in a line. */
  said: string;
  /** How many files were given a name here, and their size. */
  files: number;
  bytes: number;
}

function filesUnder(folder: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      found.push(...filesUnder(path));
    } else if (entry.isFile()) {
      found.push(path);
    }
  }
  return found;
}

const gigabytes = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

/** Gives the tree at `root` a hard link to every file of the main checkout's downloads it lacks. */
export function borrowSources(root = REPO): Borrowed {
  const here = join(root, 'world', 'source');
  if (isMainCheckout(root)) {
    return { said: "this checkout's own, which every worktree borrows", files: 0, bytes: 0 };
  }
  const main = join(mainCheckout(root), 'world', 'source');
  if (!existsSync(main)) {
    return { said: 'not borrowed: the main checkout has none to lend', files: 0, bytes: 0 };
  }

  let unlinked = '';
  if (isLink(here)) {
    unlinked = `, in place of a junction to ${linkTarget(here)}`;
    removeHere(here);
  }

  let files = 0;
  let bytes = 0;
  let own = 0;
  for (const there of filesUnder(main)) {
    const mine = join(here, relative(main, there));
    if (existsSync(mine)) {
      own += 1;
      continue;
    }
    mkdirSync(dirname(mine), { recursive: true });
    linkSync(there, mine);
    files += 1;
    bytes += statSync(there).size;
  }

  if (files === 0) {
    return { said: `all here${own > 0 ? `, ${own} files` : ''}${unlinked}`, files, bytes };
  }
  return {
    said: `borrowed from the main checkout by hard link: ${files} files, ${gigabytes(bytes)}${unlinked}`,
    files,
    bytes,
  };
}
