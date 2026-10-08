import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

import { asksForStands } from './worldApi.ts';

/**
 * The dev server hands out the page's world itself, the cut tiles, the heights and the rest under
 * `public/world`, and its watcher leaves that folder alone.
 *
 * Vite watches everything under its root so that a saved file can be reloaded, and `public/world` is fifty
 * thousand files of output once the junctions to the main checkout's tiles are followed, none of which a page
 * is ever reloaded for. Watched, they held fifty thousand handles and more than a core of the processor with
 * nobody asking for anything, and every file the dev server sent, a tile or its own client, waited about 70 ms
 * behind them. Unwatched, a tile is sent in 3 ms (2026-10-07, while the relief was not keeping up).
 *
 * Vite's own public folder cannot simply be told to stop watching, because outside a worktree it keeps a list
 * of the files in it and learns of new ones from the watcher: a tile cut while the server runs would be
 * unknown to it until a restart. So the world is sent from here, ahead of it, found on disk when asked for.
 * What is not there is left to Vite as it always was.
 */

const here = dirname(fileURLToPath(import.meta.url));
const WORLD_DIR = resolve(here, '..', 'public', 'world');

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.geojson': 'application/geo+json',
  '.bin': 'application/octet-stream',
};

/**
 * The file a request for the page's world names, or null when it asks for anything else or, however it is
 * spelt, for a path outside the world. The stands are never named here: see `asksForStands`.
 */
export function worldFileOf(url: string, worldDir: string = WORLD_DIR): string | null {
  const path = (url.split('?')[0] ?? '').split('#')[0] ?? '';
  let plain: string;
  try {
    plain = decodeURIComponent(path);
  } catch {
    return null;
  }
  // A backslash or a drive's colon would be read by Windows as a way out of the folder.
  if (!plain.startsWith('/world/') || /[\\:\0]/.test(plain) || asksForStands(url)) {
    return null;
  }
  const normal = posix.normalize(plain);
  if (!normal.startsWith('/world/')) {
    return null;
  }
  const file = resolve(worldDir, ...normal.slice('/world/'.length).split('/'));
  const within = relative(worldDir, file);
  return within === '' || within.startsWith('..') || within.startsWith(sep) || isAbsolute(within)
    ? null
    : file;
}

export function worldFiles(): Plugin {
  return {
    name: 'villages:world-files',
    apply: 'serve',
    config: () => ({ server: { watch: { ignored: ['**/public/world/**'] } } }),
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const file =
          request.method === 'GET' || request.method === 'HEAD' ? worldFileOf(request.url ?? '') : null;
        if (file === null) {
          next();
          return;
        }
        stat(file).then(
          (found) => {
            if (!found.isFile()) {
              next();
              return;
            }
            // As Vite's own public folder answers: asked again every time, and unchanged is a 304.
            const etag = `W/"${found.size}-${Math.floor(found.mtimeMs)}"`;
            response.setHeader(
              'content-type',
              TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
            );
            response.setHeader('cache-control', 'no-cache');
            response.setHeader('etag', etag);
            response.setHeader('last-modified', found.mtime.toUTCString());
            if (request.headers['if-none-match'] === etag) {
              response.statusCode = 304;
              response.end();
              return;
            }
            response.setHeader('content-length', found.size);
            if (request.method === 'HEAD') {
              response.end();
              return;
            }
            createReadStream(file)
              .on('error', () => response.destroy())
              .pipe(response);
          },
          () => next(),
        );
      });
    },
  };
}
