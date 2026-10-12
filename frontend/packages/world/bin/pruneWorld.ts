import { execFileSync } from 'node:child_process';

import { mainCheckout, worldCacheDir } from './lib/checkouts.ts';
import { args } from './lib/flags.ts';
import { REPO } from './lib/paths.ts';
import { Shelf } from './lib/worldCache.ts';
import { pruneShelf } from './lib/worldPrune.ts';

/**
 * Says what on the world cache's shelf no tree uses any more, and with `--drop` takes it off: never an entry a tree
 * borrows, one a tree's record names, one being made or lent, or one made in the last week. See `lib/worldPrune.ts`
 * and decision record 0095.
 *
 *   node bin/pruneWorld.ts [--drop]
 */

const drop = args.includes('--drop');
const listed = execFileSync('git', ['-C', REPO, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' });
const trees = [
  mainCheckout(),
  ...listed
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length).trim()),
];
const shelf = new Shelf(worldCacheDir());
const rows = pruneShelf(shelf, { trees, drop });

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(0)} MB`;
for (const row of rows) {
  const day = row.madeAt.slice(0, 10);
  console.log(
    `${row.keep === null ? (drop ? 'dropped' : 'drop   ') : 'keep   '} ${row.step.padEnd(8)} ${row.key}  ` +
      `${megabytes(row.bytes).padStart(7)}  made ${day} in ${row.madeIn}${row.keep === null ? '' : `: ${row.keep}`}`,
  );
}
const going = rows.filter((row) => row.keep === null);
const sum = (some: typeof rows) => megabytes(some.reduce((total, row) => total + row.bytes, 0));
console.log(
  `\n${rows.length} entries in ${shelf.dir}, ${sum(rows)}: ${going.length} ${drop ? 'dropped' : 'to drop'}, ${sum(going)}` +
    (drop || going.length === 0 ? '' : '; --drop takes them off'),
);
