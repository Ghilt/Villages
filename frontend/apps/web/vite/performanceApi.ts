import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

/**
 * The dev server's histories of performance, `docs/experiments/performance/<name>.jsonl`, as their tools wrote them:
 * the bot swarm's runs, and the points the performance tool keeps of the shaders, the start, the zoom and the tests,
 * one a line, read fresh on every ask so a run just finished is on the performance page at a reload. Empty when nothing
 * has been written yet. Development only, as every page beside the game is. See decision record 0106.
 */

const here = dirname(fileURLToPath(import.meta.url));
const HISTORIES = resolve(here, '..', '..', '..', '..', 'docs', 'experiments', 'performance');

/** The histories the page may ask for, by name: `/performance/shaders.jsonl`. */
export const KEPT = ['runs', 'shaders', 'startup', 'zoom', 'tests'] as const;

export function performanceApi(): Plugin {
  return {
    name: 'villages-performance',
    configureServer(server) {
      server.middlewares.use('/performance', (request, response, next) => {
        const name = /^\/(\w+)\.jsonl$/.exec(request.url ?? '')?.[1];
        if (name === undefined || !(KEPT as readonly string[]).includes(name)) {
          next();
          return;
        }
        readFile(join(HISTORIES, `${name}.jsonl`), 'utf8')
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
