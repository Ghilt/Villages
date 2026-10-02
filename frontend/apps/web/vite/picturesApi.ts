import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

/**
 * A folder of Adam's pictures, served by the dev server as it stands: what is in it, and each picture in it.
 *
 * He saves pictures into it by hand and the page draws them from here. **Nothing is cached**, so a picture
 * saved over another is the one drawn on the next reload, which is the whole loop: paint, save, reload, look.
 * The portraits and the scenes are two of them.
 *
 * Development only, like `worldApi.ts`, and a coupling to the repository's layout that is named as such:
 * when there is a deployment the pictures will be published with it, and this goes.
 */

/** A picture's key: the file's name without `.png`, which is what a character or a dialogue names. */
const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The keys of the pictures among these file names, in order: every `.png` whose name is a key. */
export function pictureKeys(files: readonly string[], longest: number): string[] {
  return files
    .filter((file) => file.endsWith('.png'))
    .map((file) => file.slice(0, -'.png'.length))
    .filter((key) => KEY.test(key) && key.length <= longest)
    .sort();
}

export interface Pictures {
  /** The plugin's name, and the path the folder is served at: `portraits` is `/portraits/`. */
  readonly name: string;
  /** The folder itself. */
  readonly folder: string;
  /** The longest key the folder's pictures are named in, which is the rule whoever names them keeps. */
  readonly longest: number;
}

export function picturesApi({ name, folder, longest }: Pictures): Plugin {
  async function keysOnDisk(): Promise<string[]> {
    try {
      return pictureKeys(await readdir(folder), longest);
    } catch {
      // No folder is no pictures, which is what everything that reads it makes of it too.
      return [];
    }
  }

  return {
    name: `villages:${name}`,
    apply: 'serve',
    configureServer(server) {
      // Connect strips the mount path, so the listing is "/" and a picture is "/<key>.png".
      server.middlewares.use(`/${name}`, (request, response, next) => {
        const url = (request.url ?? '/').split('?')[0]!;
        if (request.method !== 'GET') {
          next();
          return;
        }

        if (url === '/' || url === '') {
          void keysOnDisk().then((keys) => {
            response.setHeader('content-type', 'application/json');
            response.setHeader('cache-control', 'no-store');
            response.end(JSON.stringify({ [name]: keys }));
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
            response.end(`no picture called ${key} in world/${name}\n`);
            return;
          }
          try {
            const bytes = await readFile(resolve(folder, `${key}.png`));
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
