import { createHash } from 'node:crypto';
import { existsSync, watch } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

/**
 * The dev server's shelf of catalogues: every file under `world/catalogues/` at `/catalogues/<its path>`, read again
 * on every ask and sent without a cache, with the SHA-256 of its text in `X-Catalogue-Fingerprint`, which is what an
 * inspect page names when it asks the game server to save over it. `/catalogues/` lists them. When one changes on
 * disk, saved by hand or by the game server, the page is told, `villages:catalogue-changed` with the file's path, and
 * an inspect page reads it again. Development only, as the portraits are. See decision record 0097.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SHELF = resolve(here, '..', '..', '..', '..', 'world', 'catalogues');

/** Let a burst of writes settle - an editor saves in several - before the page is told. */
const SETTLE_MS = 150;

/** What the hot-reload channel carries when a catalogue changes on disk. */
export const CATALOGUE_CHANGED = 'villages:catalogue-changed';

export function catalogueApi(): Plugin {
  return {
    name: 'catalogues',
    configureServer(server) {
      server.middlewares.use('/catalogues', (request, response) => {
        const asked = decodeURIComponent((request.url ?? '/').split('?')[0]!).replace(/^\/+/, '');
        const reply = (status: number, body: string | Buffer, headers: Record<string, string> = {}) => {
          response.statusCode = status;
          response.setHeader('Cache-Control', 'no-store');
          for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
          response.end(body);
        };
        if (asked === '') {
          void listed().then(
            (files) => reply(200, JSON.stringify({ files }), { 'Content-Type': 'application/json' }),
            (unread: unknown) => reply(500, `world/catalogues could not be listed: ${String(unread)}`),
          );
          return;
        }
        const file = resolve(SHELF, asked);
        if (!file.startsWith(SHELF + sep) || !file.endsWith('.json')) {
          reply(404, `there is no catalogue at ${asked}`);
          return;
        }
        readFile(file).then(
          (bytes) =>
            reply(200, bytes, {
              'Content-Type': 'application/json',
              'X-Catalogue-Fingerprint': fingerprintOf(bytes),
            }),
          () => reply(404, `world/catalogues/${asked} could not be read`),
        );
      });

      if (!existsSync(SHELF)) return;
      const waiting = new Map<string, ReturnType<typeof setTimeout>>();
      const watcher = watch(SHELF, { recursive: true }, (_, name) => {
        if (name === null || !name.endsWith('.json')) return;
        const file = name.split(sep).join('/');
        clearTimeout(waiting.get(file));
        waiting.set(
          file,
          setTimeout(() => {
            waiting.delete(file);
            server.ws.send({ type: 'custom', event: CATALOGUE_CHANGED, data: { file } });
          }, SETTLE_MS),
        );
      });
      server.httpServer?.on('close', () => watcher.close());
    },
  };
}

/** The SHA-256 of a catalogue's bytes, in hex: what the game server works out of the same file. */
export function fingerprintOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Every catalogue file on the shelf, by its path under it, folders and all. */
async function listed(): Promise<string[]> {
  const entries = await readdir(SHELF, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => relative(SHELF, resolve(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
}
