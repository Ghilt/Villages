import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

/**
 * The marks' pictures, `world/sprites/marks/`, as the pictures' inspect page reads them: `/sprite-marks/` lists every
 * `.png` in the folder and in its folders, by its path under it without the `.png`, each saying whether it is still the
 * placeholder the tools drew - its bytes the ones `world/sprites/placeholders.json` remembers - and
 * `/sprite-marks/<path>.png` sends one. Nothing cached, so a picture saved over another is the one shown on the next
 * reload. Development only, as the portraits are. See docs/plans/catalogues.md.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SPRITES = resolve(here, '..', '..', '..', '..', 'world', 'sprites');
const MARKS = resolve(SPRITES, 'marks');
const PLACEHOLDERS = resolve(SPRITES, 'placeholders.json');

/** Every mark's picture by its path under the folder, `castle` or `structures/castle`, and whether it is a placeholder. */
async function marks(): Promise<{ key: string; placeholder: boolean }[]> {
  if (!existsSync(MARKS)) return [];
  const drawn = existsSync(PLACEHOLDERS)
    ? (JSON.parse(await readFile(PLACEHOLDERS, 'utf8')) as Record<string, string>)
    : {};
  const entries = await readdir(MARKS, { recursive: true, withFileTypes: true });
  const pictures = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.png'));
  return Promise.all(
    pictures.map(async (entry) => {
      const file = resolve(entry.parentPath, entry.name);
      const key = relative(MARKS, file)
        .split(sep)
        .join('/')
        .replace(/\.png$/, '');
      const hash = createHash('sha256')
        .update(await readFile(file))
        .digest('hex');
      return { key, placeholder: drawn[`marks/${key}.png`] === hash };
    }),
  ).then((found) => found.sort((a, b) => a.key.localeCompare(b.key)));
}

export function spriteMarksApi(): Plugin {
  return {
    name: 'villages:sprite-marks',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/sprite-marks', (request, response, next) => {
        const url = decodeURIComponent((request.url ?? '/').split('?')[0]!);
        if (request.method !== 'GET') {
          next();
          return;
        }
        if (url === '/' || url === '') {
          void marks().then((found) => {
            response.setHeader('content-type', 'application/json');
            response.setHeader('cache-control', 'no-store');
            response.end(JSON.stringify({ marks: found }));
          });
          return;
        }
        // The path arrives from a browser and becomes a file, so it is checked against what is really there.
        const key = url.replace(/^\//, '').replace(/\.png$/, '');
        void marks().then(async (found) => {
          if (!found.some((one) => one.key === key)) {
            response.statusCode = 404;
            response.end(`no mark called ${key} in world/sprites/marks\n`);
            return;
          }
          response.setHeader('content-type', 'image/png');
          response.setHeader('cache-control', 'no-store');
          response.end(await readFile(resolve(MARKS, `${key}.png`)));
        });
      });
    },
  };
}
