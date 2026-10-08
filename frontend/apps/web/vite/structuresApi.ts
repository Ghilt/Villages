import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

/**
 * The dev server's catalogue of structures: `world/structures.json` at `/structures.json`, read again on every ask
 * and sent without a cache, so a number Adam changes in it is what the page shows on its next reload. The game
 * server reads the same file once, when it starts. Development only, as the portraits are; a built page will read a
 * copy cut beside the structures' sprites. See docs/plans/structures.md.
 */

const here = dirname(fileURLToPath(import.meta.url));
const CATALOGUE = resolve(here, '..', '..', '..', '..', 'world', 'structures.json');

export function structuresApi(): Plugin {
  return {
    name: 'structures',
    configureServer(server) {
      server.middlewares.use('/structures.json', (_request, response) => {
        readFile(CATALOGUE, 'utf8').then(
          (text) => {
            response.setHeader('Content-Type', 'application/json');
            response.setHeader('Cache-Control', 'no-store');
            response.end(text);
          },
          (unread: unknown) => {
            response.statusCode = 500;
            response.end(`world/structures.json could not be read: ${String(unread)}`);
          },
        );
      });
    },
  };
}
