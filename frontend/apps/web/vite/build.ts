import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

/**
 * The dev server's answer to "which build am I looking at".
 *
 * There are a dozen checkouts of this repository on the machine and each one can serve. Knowing which
 * branch and which commit is on the screen used to mean reading the tab strip and trusting it, and the
 * day that went wrong cost an hour: a game server six days old still answering on its port, a page that
 * looked exactly like the right one, and an error message about a JSON type id. The page says so in the
 * corner now.
 *
 * Asked of git on every request rather than baked in at startup, because a dev server outlives a merge:
 * Vite serves from disk, so after `git merge` the code on the screen is the new code and a number
 * remembered from startup would be the old one. A few milliseconds, never stale.
 *
 * Development only, like the world and worktree APIs beside it. A built page has no dev server to ask
 * and shows what it can without one.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');

export interface BuildHere {
  /** The branch this tree has checked out, or empty when git cannot say. */
  branch: string;
  /** The short commit it stands on, or empty when git cannot say. */
  commit: string;
  /** Whether tracked files differ from that commit. */
  dirty: boolean;
}

/** Run git and give back what it said, trimmed. Injected so this can be tested without a repository. */
export type RunGit = (args: string[]) => string;

/** Whatever git answers, or nothing: a corner label is never worth failing a page for. */
function tried(ask: () => string): string {
  try {
    return ask().trim();
  } catch {
    return '';
  }
}

export function describeBuild(git: RunGit): BuildHere {
  return {
    branch: tried(() => git(['rev-parse', '--abbrev-ref', 'HEAD'])),
    commit: tried(() => git(['rev-parse', '--short', 'HEAD'])),
    // Tracked changes only. The masters Adam paints are untracked on purpose, and a badge that always
    // said "changed" would say nothing at all.
    dirty: tried(() => git(['status', '--porcelain', '--untracked-files=no'])) !== '',
  };
}

export function buildApi(): Plugin {
  return {
    name: 'villages:build',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/dev-api/build', (request, response, next) => {
        const url = request.url ?? '/';
        if (request.method !== 'GET' || (url !== '/' && url !== '')) {
          next();
          return;
        }

        const said = describeBuild((args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }));

        response.setHeader('content-type', 'application/json');
        response.setHeader('cache-control', 'no-store');
        response.end(JSON.stringify(said));
      });
    },
  };
}
