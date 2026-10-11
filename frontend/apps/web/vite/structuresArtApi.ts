import { spawn } from 'node:child_process';
import { existsSync, readFileSync, watch } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin, ViteDevServer } from 'vite';

import { isPicture, oneCutAtATime } from './artApi.ts';

/**
 * The dev server keeps the structures' pictures cut, as `artApi.ts` keeps the scenery's: every time it starts, and
 * whenever a picture in `world/structures/` is saved, it runs `npm run world:structures`, which draws a placeholder
 * for any picture missing and packs them all into an atlas; when the atlas changed it tells the page, which draws
 * from the new one. Save a picture over a placeholder, look at the map. Development only. See
 * docs/plans/structures.md.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');
const STRUCTURES_DIR = resolve(REPO, 'world', 'structures');
const WORLD_PACKAGE = resolve(REPO, 'frontend', 'packages', 'world');
const ATLAS = resolve(REPO, 'frontend', 'apps', 'web', 'public', 'art', 'structures.json');

/** What the page listens for, `STRUCTURES_CUT` in `sprites/structureAtlas.ts`. */
export const STRUCTURES_CUT = 'villages:structures-cut';

/** How long after the last save before cutting, because a paint program writes a file in several goes. */
const SETTLE_MS = 300;

function cut(server: ViteDevServer, why: string): Promise<boolean> {
  const log = server.config.logger;
  log.info(`[structures] ${why}: cutting world/structures`);
  return new Promise((settle) => {
    const child = spawn(process.execPath, ['bin/cutStructures.ts'], {
      cwd: WORLD_PACKAGE,
      windowsHide: true,
    });
    let said = '';
    child.stdout.on('data', (chunk: Buffer) => (said += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (said += chunk.toString('utf8')));
    child.on('error', (cause) => {
      log.error(`[structures] could not run the cut: ${cause.message}`);
      settle(false);
    });
    child.on('close', (code) => {
      for (const line of said.split(/\r?\n/).filter((one) => one.trim() !== '')) {
        (code === 0 ? log.info : log.error)(`[structures] ${line}`);
      }
      settle(code === 0);
    });
  });
}

const atlasNow = (): string | null => (existsSync(ATLAS) ? readFileSync(ATLAS, 'utf8') : null);

export function structuresArtApi(): Plugin {
  return {
    name: 'villages:structures-art',
    apply: 'serve',
    configureServer(server) {
      let waiting: ReturnType<typeof setTimeout> | null = null;
      const cutAndSay = oneCutAtATime(
        (why) => cut(server, why),
        atlasNow,
        () => server.ws.send({ type: 'custom', event: STRUCTURES_CUT }),
      );
      void cutAndSay(
        existsSync(ATLAS) ? 'the server started' : 'no pictures of structures cut in this tree yet',
      );
      if (!existsSync(STRUCTURES_DIR)) {
        return;
      }
      const watcher = watch(STRUCTURES_DIR, (_, file) => {
        if (file === null || !isPicture(file)) {
          return;
        }
        if (waiting !== null) {
          clearTimeout(waiting);
        }
        waiting = setTimeout(() => {
          waiting = null;
          void cutAndSay(`${file} was saved`);
        }, SETTLE_MS);
      });
      server.httpServer?.on('close', () => watcher.close());
    },
  };
}
