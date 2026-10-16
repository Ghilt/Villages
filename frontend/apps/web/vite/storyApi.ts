import { existsSync, watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

/**
 * The story for its inspect page: `/story-document/` sends `docs/STORY.md` as it is written, read again on every ask
 * and sent without a cache, and when it changes on disk the page is told, `villages:story-changed`, and reads it
 * again. The page parses it; this only reads the file. Development only, and on purpose: the story is the truth
 * no player begins knowing, so nothing that is built carries it.
 */

const here = dirname(fileURLToPath(import.meta.url));
const DOCUMENT = resolve(here, '..', '..', '..', '..', 'docs', 'STORY.md');

/** Let a burst of writes settle - an editor saves in several - before the page is told. */
const SETTLE_MS = 150;

/** What the hot-reload channel carries when the story changes on disk. */
export const STORY_CHANGED = 'villages:story-changed';

export function storyApi(): Plugin {
  return {
    name: 'villages:story',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/story-document', (request, response, next) => {
        if (request.method !== 'GET') {
          next();
          return;
        }
        readFile(DOCUMENT, 'utf8').then(
          (document) => {
            response.setHeader('Content-Type', 'application/json');
            response.setHeader('Cache-Control', 'no-store');
            response.end(JSON.stringify({ document }));
          },
          (unread: unknown) => {
            response.statusCode = 500;
            response.end(`docs/STORY.md could not be read: ${String(unread)}`);
          },
        );
      });

      let waiting: ReturnType<typeof setTimeout> | undefined;
      // The document's folder rather than the document: an editor that saves by renaming over a file ends a watch of it.
      const watcher =
        existsSync(DOCUMENT) &&
        watch(dirname(DOCUMENT), (_, name) => {
          if (name !== 'STORY.md') return;
          clearTimeout(waiting);
          waiting = setTimeout(() => server.ws.send({ type: 'custom', event: STORY_CHANGED }), SETTLE_MS);
        });
      server.httpServer?.on('close', () => watcher !== false && watcher.close());
    },
  };
}
