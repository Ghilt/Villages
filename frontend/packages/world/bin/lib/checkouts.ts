import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { REPO } from './paths.ts';

/**
 * Where the repository every checkout shares lives, worked out from `.git` as git keeps it rather than by asking
 * git: a directory in the main checkout, and in a worktree a file naming the worktree's own folder inside the
 * main checkout's `.git`, whose `commondir` names the shared one. The same telling-apart the game server does
 * to name its database (decision record 0092).
 */
export function commonGitDir(root = REPO): string {
  const dotGit = join(root, '.git');
  if (statSync(dotGit).isDirectory()) {
    return dotGit;
  }
  const said = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'));
  if (said === null) {
    throw new Error(`${dotGit} names no repository`);
  }
  const own = resolve(root, said[1]!.trim());
  const common = join(own, 'commondir');
  return existsSync(common) ? resolve(own, readFileSync(common, 'utf8').trim()) : own;
}

/** The main checkout: the folder the shared `.git` is in, Adam's own, where the master is painted. */
export function mainCheckout(root = REPO): string {
  return dirname(commonGitDir(root));
}

/** Whether `root` is the main checkout rather than a worktree of it. */
export function isMainCheckout(root = REPO): boolean {
  return statSync(join(root, '.git')).isDirectory();
}

/** The world cache: one shelf for every checkout on the machine, inside the shared `.git`, which git never looks into (0095). */
export function worldCacheDir(root = REPO): string {
  return join(commonGitDir(root), 'world-cache');
}
