import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, watch } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin, ViteDevServer } from 'vite';

import { isPicture, oneCutAtATime } from './artApi.ts';

/**
 * The dev server keeps the critters' pictures cut, as `artApi.ts` keeps the scenery's: every time it starts, and
 * whenever a picture in `world/sprites/critters/` or `world/critters.json` is saved, it runs `npm run world:critters`,
 * which draws a placeholder strip for any kind with no picture and cuts them all into an atlas; when the atlas changed
 * it tells the page, which reads the new one. Save a picture over a placeholder, look at the pictures' page.
 *
 * It sends the atlas itself, `/art/critters.json` and `.webp`, found on disk when asked for: Vite knows the files of
 * its public folder from when it started, and the first cut in a tree writes them a moment after that, so Vite would
 * answer with the page until a restart. Development only. See docs/plans/living-world.md.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');
const CRITTERS_DIR = resolve(REPO, 'world', 'sprites', 'critters');
const CRITTERS = resolve(REPO, 'world', 'critters.json');
const WORLD_PACKAGE = resolve(REPO, 'frontend', 'packages', 'world');
const ART = resolve(REPO, 'frontend', 'apps', 'web', 'public', 'art');
const ATLAS = resolve(ART, 'critters.json');
/** What the atlas is sent as, by the file asked for. */
const SENT: Record<string, string> = { 'critters.json': 'application/json', 'critters.webp': 'image/webp' };

/** What the page listens for when the critters are cut again. */
export const CRITTERS_CUT = 'villages:critters-cut';

/** How long after the last save before cutting, because a paint program writes a file in several goes. */
const SETTLE_MS = 300;

function cut(server: ViteDevServer, why: string): Promise<boolean> {
  const log = server.config.logger;
  log.info(`[critters] ${why}: cutting world/sprites/critters`);
  return new Promise((settle) => {
    const child = spawn(process.execPath, ['bin/cutCritters.ts'], { cwd: WORLD_PACKAGE, windowsHide: true });
    let said = '';
    child.stdout.on('data', (chunk: Buffer) => (said += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (said += chunk.toString('utf8')));
    child.on('error', (cause) => {
      log.error(`[critters] could not run the cut: ${cause.message}`);
      settle(false);
    });
    child.on('close', (code) => {
      for (const line of said.split(/\r?\n/).filter((one) => one.trim() !== '')) {
        (code === 0 ? log.info : log.error)(`[critters] ${line}`);
      }
      settle(code === 0);
    });
  });
}

const atlasNow = (): string | null => (existsSync(ATLAS) ? readFileSync(ATLAS, 'utf8') : null);

export function crittersArtApi(): Plugin {
  return {
    name: 'villages:critters-art',
    apply: 'serve',
    configureServer(server) {
      // Connect strips the mount path, so a request for /art/critters.json is "/critters.json" here.
      server.middlewares.use('/art', (request, response, next) => {
        const file = (request.url ?? '').split('?')[0]!.replace(/^\//, '');
        const type = SENT[file];
        if (request.method !== 'GET' || type === undefined || !existsSync(resolve(ART, file))) {
          next();
          return;
        }
        response.setHeader('Content-Type', type);
        response.setHeader('Cache-Control', 'no-store');
        createReadStream(resolve(ART, file)).pipe(response);
      });
      let waiting: ReturnType<typeof setTimeout> | null = null;
      const cutAndSay = oneCutAtATime(
        (why) => cut(server, why),
        atlasNow,
        () => server.ws.send({ type: 'custom', event: CRITTERS_CUT }),
      );
      void cutAndSay(existsSync(ATLAS) ? 'the server started' : 'no critters cut in this tree yet');
      const soon = (why: string) => {
        if (waiting !== null) clearTimeout(waiting);
        waiting = setTimeout(() => {
          waiting = null;
          void cutAndSay(why);
        }, SETTLE_MS);
      };
      mkdirSync(CRITTERS_DIR, { recursive: true });
      const watchers = [
        watch(CRITTERS_DIR, (_, file) => {
          if (file !== null && isPicture(file)) soon(`${file} was saved`);
        }),
        // The list is watched through its folder, which outlives an editor saving the file by replacing it.
        watch(dirname(CRITTERS), (_, file) => {
          if (file === basename(CRITTERS)) soon('world/critters.json was saved');
        }),
      ];
      server.httpServer?.on('close', () => watchers.forEach((watcher) => watcher.close()));
    },
  };
}
