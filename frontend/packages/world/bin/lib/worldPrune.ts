import { existsSync, lstatSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { removeHere } from './links.ts';
import { heldBy } from './locks.ts';
import { readBorrowed } from './worldCache.ts';
import type { KeyFile, Shelf } from './worldCache.ts';
import { WORLD_STEPS } from './worldSteps.ts';
import type { StepName } from './worldSteps.ts';

/**
 * What clearing the world cache keeps and what it drops. A shelf entry is ~390 MB for a whole master's world, and a
 * repaint or a change to code every step runs files a new set, so entries no tree uses any more pile up. Clearing
 * never takes one a tree uses (decision record 0095): an entry is kept when
 *
 * - a file in it has another name: some tree borrows it, by hard link, whatever its record says;
 * - a tree that still exists says in its `borrowed.json` that it borrowed it;
 * - somebody is making or borrowing it just now: its lock is held;
 * - it was made in the last week, so a tree switching back to a branch finds it.
 *
 * Folders being made that nobody is making any more, a day old, go too, and whatever is left in the trash.
 */

export interface PruneRow {
  step: StepName;
  key: string;
  bytes: number;
  madeIn: string;
  madeAt: string;
  /** Why it stays, or null when it goes. */
  keep: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

/** Whether any file under `folder` has a name somewhere else. */
function lentOut(folder: string): boolean {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory() ? lentOut(path) : entry.isFile() && lstatSync(path).nlink > 1) {
      return true;
    }
  }
  return false;
}

/**
 * Every entry on the shelf and whether it stays, with `drop` taking off the ones that go. `trees` is every checkout
 * git knows of, the main one with them.
 */
export function pruneShelf(
  shelf: Shelf,
  options: { trees: readonly string[]; drop?: boolean; now?: number; keepDays?: number },
): PruneRow[] {
  const now = options.now ?? Date.now();
  const recent = now - (options.keepDays ?? 7) * DAY;
  const named = new Set<string>();
  for (const tree of options.trees) {
    for (const steps of Object.values(readBorrowed(tree))) {
      for (const [step, key] of Object.entries(steps)) named.add(`${step}/${key}`);
    }
  }

  const rows: PruneRow[] = [];
  for (const { name: step } of WORLD_STEPS) {
    const folder = join(shelf.dir, step);
    if (!existsSync(folder)) continue;
    for (const key of readdirSync(folder)) {
      const at = join(folder, key);
      if (key.endsWith('.lock') || !statSync(at).isDirectory()) continue;
      if (key.includes('.making-')) {
        const stale = heldBy(shelf.lockOfEntry(step, key.slice(0, key.indexOf('.'))));
        if (options.drop === true && stale === undefined && statSync(at).mtimeMs < now - DAY) removeHere(at);
        continue;
      }
      const filed: KeyFile | undefined = shelf.has(step, key);
      const bytes = Object.values(filed?.files ?? {}).reduce((sum, file) => sum + file.size, 0);
      const madeAt = filed?.madeAt ?? new Date(statSync(at).mtimeMs).toISOString();
      const keep =
        filed === undefined
          ? null
          : lentOut(at)
            ? 'a tree borrows it'
            : named.has(`${step}/${key}`)
              ? 'a tree says it borrowed it'
              : heldBy(shelf.lockOfEntry(step, key)) !== undefined
                ? 'it is being lent or made just now'
                : Date.parse(madeAt) > recent
                  ? 'it was made in the last week'
                  : null;
      rows.push({ step, key, bytes, madeIn: filed?.madeIn ?? 'nobody', madeAt, keep });
      if (keep === null && options.drop === true) {
        if (filed === undefined) removeHere(at);
        else shelf.discard(step, key);
      }
    }
  }
  if (options.drop === true) removeHere(join(shelf.dir, 'trash'));
  return rows;
}
