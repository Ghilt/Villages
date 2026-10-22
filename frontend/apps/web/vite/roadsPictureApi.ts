import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

/**
 * The picture of every road a master has, `world/ground/<master>/roads.png`, for the Roads renderer. It says where
 * every road is, which no player is served, since a road reaches the page only through the fog; so the dev server
 * hands it out as it does Adam's other instruments, and nothing else of that folder. See `bin/lib/roadsPicture.ts` in
 * the world package.
 */

const here = dirname(fileURLToPath(import.meta.url));
const GROUND = resolve(here, '..', '..', '..', '..', 'world', 'ground');

/** The master a request names, `/roads-picture/<master>`, or null for anything else, a way out of the folder above all. */
export function masterAsked(url: string): string | null {
  const name = /^\/([\w.-]+)$/.exec(url.split('?')[0] ?? '')?.[1];
  return name === undefined || name.startsWith('.') ? null : name;
}

export function roadsPictureApi(): Plugin {
  return {
    name: 'villages-roads-picture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/roads-picture', (request, response, next) => {
        const master = masterAsked(request.url ?? '');
        if (master === null) {
          next();
          return;
        }
        readFile(resolve(GROUND, master, 'roads.png'))
          .then((picture) => {
            response.setHeader('Content-Type', 'image/png');
            response.setHeader('Cache-Control', 'no-store');
            response.end(picture);
          })
          .catch(() => {
            response.statusCode = 404;
            response.end(
              `no picture of the roads of ${master}: npm run world:roads --prefix frontend makes it`,
            );
          });
      });
    },
  };
}
