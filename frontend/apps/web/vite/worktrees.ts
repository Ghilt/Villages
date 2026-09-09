import { connect } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

import { worktreeHere, worktrees } from './worktreePort.ts';
import type { Worktree } from './worktreePort.ts';

/**
 * The dev server's answer to "which trees are there, and which of them are up".
 *
 * A session works in its own worktree and there are usually several at once, each a whole copy of the
 * world on its own branch. Until now one of them could serve and the others could not, and nothing on
 * the screen said which one you were looking at. This is the other half of decision record 0031: the
 * ports are worked out from the tree's name, and this says which of those ports are answering so the
 * page can offer them.
 *
 * Nothing is remembered between requests, on purpose. Worktrees are made and deleted constantly, so a
 * list held in memory would be wrong within the hour; `git worktree list` is asked every time, which is
 * a few milliseconds and is never stale.
 *
 * Development only, like the world API beside it.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');

/** Long enough for a listening socket on the loopback, short enough that eight of them are not a wait. */
const PROBE_MS = 300;

export interface WorktreeOnDisk extends Worktree {
  /** Whether anything is listening on its port. Not proof it is ours; nothing else uses this range. */
  running: boolean;
  /** Whether this is the tree serving the page that asked. */
  here: boolean;
}

/**
 * A connect rather than a request, because a dev server that is still starting up answers a socket long
 * before it answers a route, and "starting" is what we want to show rather than "absent".
 */
function connects(host: string, port: number): Promise<boolean> {
  return new Promise((settle) => {
    const socket = connect({ port, host });
    const done = (answer: boolean) => {
      socket.destroy();
      settle(answer);
    };
    socket.setTimeout(PROBE_MS);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/**
 * Is anything listening there?
 *
 * Both families, and this is not belt and braces. Vite binds to whatever `localhost` resolves to, which
 * on this machine is the IPv6 loopback, so asking 127.0.0.1 alone reported every server down including
 * the one answering the page that asked. `debug-quick-start.ps1` sidesteps the same trap by reading the
 * port table instead, and says so in a comment that would have saved an hour.
 */
async function listening(port: number): Promise<boolean> {
  const both = await Promise.all([connects('127.0.0.1', port), connects('::1', port)]);
  return both.includes(true);
}

async function listing(): Promise<{ here: string | null; worktrees: WorktreeOnDisk[] }> {
  const mine = worktreeHere(REPO);
  const found = worktrees(REPO);
  const up = await Promise.all(found.map((tree) => listening(tree.port)));

  return {
    here: mine.name,
    worktrees: found.map((tree, at) => ({
      ...tree,
      running: up[at] ?? false,
      here: tree.path === mine.path,
    })),
  };
}

export function worktreeApi(): Plugin {
  return {
    name: 'villages:worktrees',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/dev-api/worktrees', (request, response, next) => {
        const url = request.url ?? '/';
        if (request.method !== 'GET' || (url !== '/' && url !== '')) {
          next();
          return;
        }

        void listing().then(
          (found) => {
            response.setHeader('content-type', 'application/json');
            response.setHeader('cache-control', 'no-store');
            response.end(JSON.stringify(found));
          },
          (cause: Error) => {
            response.statusCode = 500;
            response.end(cause.message);
          },
        );
      });
    },
  };
}
