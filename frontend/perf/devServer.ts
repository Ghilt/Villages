import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';

import { answers, startGame, stopGame, stopListening, until } from '../e2e/servers.ts';

/**
 * A dev server and a game server of the tool's own for the tree it measures, on ports the machine says are free, so
 * that nothing of any session's tree is touched: never the tree's own ports, which its quick start may hold, nor 8080,
 * which the page of a tree from before the per-tree ports would otherwise connect to. The game server keeps its world
 * in memory and is gone with the run; it is what sends the page where the trees stand, so without it the woods are
 * bare.
 */
export interface Servers {
  readonly url: string;
  /** The game server's port, for a built page told where it is. */
  readonly gamePort: number;
  stop(): Promise<void>;
}

/** A port nothing listens on now. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(typeof address === 'object' && address !== null ? address.port : 0));
    });
  });
}

/**
 * Refuses a tree whose page cannot be told where its game server is: it would connect to 8080, the main checkout's,
 * and the fog's measure would found a house in Adam's world. The page has read `VITE_GATEWAY_URL` since 2026-09-04.
 */
function refuseUnpointable(tree: string): void {
  const found = spawnSync('git', [
    '-C',
    tree,
    'grep',
    '-q',
    'VITE_GATEWAY_URL',
    '--',
    'frontend/apps/web/src',
  ]);
  if (found.status !== 0) {
    throw new Error(
      `the page of ${tree} does not read VITE_GATEWAY_URL, so it cannot be pointed at a game server of the tool's own`,
    );
  }
}

export async function startServers(tree: string, logs: string): Promise<Servers> {
  refuseUnpointable(tree);
  const port = await freePort();
  const gamePort = await freePort();
  mkdirSync(logs, { recursive: true });
  const game = startGame(
    gamePort,
    { store: 'memory', broker: 'in-process', database: 'villages-perf' },
    tree,
    'perf-game.log',
  );
  const out = openSync(join(logs, 'vite.log'), 'a');
  // On IPv4, so a connection to 127.0.0.1 says when it is up; Vite alone listens on ::1 only.
  spawn(`npx vite --port ${port} --strictPort --host 127.0.0.1`, {
    cwd: join(tree, 'frontend', 'apps', 'web'),
    shell: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, VITE_GATEWAY_URL: `ws://localhost:${gamePort}/ws` },
  }).unref();
  await until(() => answers(port), 180_000, `the dev server to answer on ${port}`);
  await game;
  return {
    // The gateway lets in a page from localhost only (WebSocketConfig.kt), whatever address the dev server is on.
    url: `http://localhost:${port}/`,
    gamePort,
    stop: async () => {
      await stopListening(port, 'the dev server');
      await stopGame(gamePort);
    },
  };
}
