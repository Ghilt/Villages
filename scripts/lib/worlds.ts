/**
 * Which worlds belong to a worktree that is gone, for `drop-gone-worlds.ts`. Every checkout keeps its world in a
 * database named after it (decision record 0092), carried by RabbitMQ in a virtual host of the same name (0094),
 * and a worktree deleted leaves both behind. So one name says both, and one rule finds the gone ones of either.
 */

/** The longest name MongoDB takes for a database. */
const LONGEST = 63;

/**
 * The database a checkout keeps its world in, as the game server names it - `StoreConfig.kt`'s `databaseFor`,
 * held to the same cases by a test: `villages` for the main checkout, and for a worktree `villages-` and its
 * folder's name, lower case, anything MongoDB would refuse made a dash, and no longer than MongoDB takes.
 */
export function databaseFor(folder: string | null): string {
  if (folder === null) return 'villages';
  return `villages-${folder.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`.slice(0, LONGEST);
}

/**
 * The world a checkout's end-to-end test keeps while it runs, as `frontend/e2e/servers.ts` names it: `villages-e2e-`
 * and the folder's name, or `main`. The test drops it after itself; one a run left behind is its checkout's until the
 * checkout is gone, so a drop never takes the world from under a test that is running.
 */
export function testWorldFor(folder: string | null): string {
  return `villages-e2e-${(folder ?? 'main').toLowerCase().replace(/[^a-z0-9-]/g, '-')}`.slice(0, LONGEST);
}

/** A checkout of the repository, as git lists it. */
export interface Checkout {
  /** Its folder's name, or null for the main checkout. */
  readonly folder: string | null;
  /** Git still lists it, but its folder is gone: `git worktree prune` would forget it. */
  readonly gone: boolean;
}

/** `git worktree list --porcelain`: a record a checkout, the main one first, blank lines between. */
export function readWorktrees(porcelain: string): Checkout[] {
  return porcelain
    .split(/\r?\n\r?\n/)
    .map((record) => record.trim())
    .filter((record) => record.startsWith('worktree '))
    .map((record, i) => {
      const path = /^worktree (.+)$/m.exec(record)![1]!.trim();
      return {
        folder: i === 0 ? null : (path.split(/[\\/]/).pop() ?? path),
        gone: /^prunable\b/m.test(record),
      };
    });
}

/**
 * The worlds that belong to no checkout there is: every database or virtual host of the game's, `villages` or
 * `villages-` anything, whose name is not the world, or the test's world, of a checkout git still has a folder for.
 */
export function goneWorlds(names: readonly string[], checkouts: readonly Checkout[]): string[] {
  const here = checkouts.filter((c) => !c.gone);
  const kept = new Set([
    ...here.map((c) => databaseFor(c.folder)),
    ...here.map((c) => testWorldFor(c.folder)),
  ]);
  return names
    .filter((name) => (name === 'villages' || name.startsWith('villages-')) && !kept.has(name))
    .sort();
}
