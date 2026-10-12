import { borrowSources } from './lib/sharedSources.ts';

/**
 * Gives this worktree a hard link to each of the main checkout's downloads it lacks, and says so in a line: what the
 * quick start runs before it makes the world. See `lib/sharedSources.ts` and decision record 0095.
 *
 *   node bin/borrowSources.ts
 */

console.log(borrowSources().said);
