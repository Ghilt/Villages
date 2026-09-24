import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

/**
 * The dev server's portraits: what is in `world/portraits/`, and each picture in it.
 *
 * Adam's folder, which he saves pictures into by hand; the server picks a character's portrait from the
 * same folder and the page draws it from here. **Nothing is cached**, so a picture saved over another is
 * the one drawn on the next reload, which is the whole loop: paint, save, reload, look.
 *
 * Development only, like `worldApi.ts`, and a coupling to the repository's layout that is named as such:
 * when there is a deployment the portraits will be published with it, and this goes. See
 * `docs/plans/characters-and-key-figures.md`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');
const PORTRAITS_DIR = resolve(REPO, 'world', 'portraits');

/** A portrait's key: what the server keeps, and the file's name without `.png`. The server's own rule. */
const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The longest key the server keeps, `CharacterDecider.LONGEST_PORTRAIT_KEY`. */
const LONGEST_KEY = 40;

/** The keys of the pictures among these file names, in order: every `.png` whose name is a key. */
export function portraitKeys(files: readonly string[]): string[] {
  return files
    .filter((file) => file.endsWith('.png'))
    .map((file) => file.slice(0, -'.png'.length))
    .filter((key) => KEY.test(key) && key.length <= LONGEST_KEY)
    .sort();
}

async function keysOnDisk(): Promise<string[]> {
  try {
    return portraitKeys(await readdir(PORTRAITS_DIR));
  } catch {
    // No folder is no portraits, which is what the server makes of it too.
    return [];
  }
}

export function portraitsApi(): Plugin {
  return {
    name: 'villages:portraits',
    apply: 'serve',
    configureServer(server) {
      // Connect strips the mount path, so the listing is "/" and a picture is "/<key>.png".
      server.middlewares.use('/portraits', (request, response, next) => {
        const url = (request.url ?? '/').split('?')[0]!;
        if (request.method !== 'GET') {
          next();
          return;
        }

        if (url === '/' || url === '') {
          void keysOnDisk().then((portraits) => {
            response.setHeader('content-type', 'application/json');
            response.setHeader('cache-control', 'no-store');
            response.end(JSON.stringify({ portraits }));
          });
          return;
        }

        const asked = /^\/([^/]+)\.png$/.exec(url);
        if (asked === null) {
          next();
          return;
        }
        // The key arrives from a browser and becomes a path, so it is checked against the folder rather
        // than merely sanitised: only a picture that is really there can be asked for.
        const key = decodeURIComponent(asked[1]!);
        void keysOnDisk().then(async (keys) => {
          if (!keys.includes(key)) {
            response.statusCode = 404;
            response.end(`no portrait called ${key} in world/portraits\n`);
            return;
          }
          try {
            const bytes = await readFile(resolve(PORTRAITS_DIR, `${key}.png`));
            response.setHeader('content-type', 'image/png');
            response.setHeader('cache-control', 'no-store');
            response.end(bytes);
          } catch (cause) {
            response.statusCode = 500;
            response.end((cause as Error).message);
          }
        });
      });
    },
  };
}
