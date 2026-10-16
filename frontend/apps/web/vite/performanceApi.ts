import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

/**
 * The dev server's history of swarm runs, `docs/experiments/performance/runs.jsonl`, as the swarm wrote it: one run a
 * line, read fresh on every ask so a run just finished is on the performance page at a reload. Empty when no run has
 * been written yet. Development only, as every page beside the game is. See `docs/plans/bot-swarm.md`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const RUNS = resolve(here, '..', '..', '..', '..', 'docs', 'experiments', 'performance', 'runs.jsonl');

export const RUNS_PATH = '/performance/runs.jsonl';

export function performanceApi(): Plugin {
  return {
    name: 'villages-performance',
    configureServer(server) {
      server.middlewares.use(RUNS_PATH, (_request, response) => {
        readFile(RUNS, 'utf8')
          .catch(() => '')
          .then((text) => {
            response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
            response.setHeader('Cache-Control', 'no-store');
            response.end(text);
          });
      });
    },
  };
}
