import { spawn } from 'node:child_process';
import { existsSync, readFileSync, watch } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin, ViteDevServer } from 'vite';

/**
 * The dev server keeps the art cut: whenever a picture in `world/sprites/` is saved, and every time the
 * server starts, it runs `npm run world:art` again - all but `structures/` and `critters/`, which `structuresArtApi.ts`
 * and `crittersArtApi.ts` cut - and when that changed the atlas it tells the page,
 * which lets go of the old atlas and draws the new one.
 *
 * So the loop for a sprite is the portraits' loop without the reload: save a picture over a
 * placeholder, look at the map. Cutting at every start, rather than only in a tree that has never been
 * cut, is what puts a picture saved while nothing was running on the map, and a rule a merge changed:
 * an atlas that was there used to be drawn as it was until the next save. It costs a couple of seconds
 * when nothing is new, because every cut is kept, and then nothing is written and the page hears nothing.
 *
 * Development only, like `worldApi.ts`. See decision record 0059.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');
const SPRITES_DIR = resolve(REPO, 'world', 'sprites');
const WORLD_PACKAGE = resolve(REPO, 'frontend', 'packages', 'world');
const ATLAS = resolve(REPO, 'frontend', 'apps', 'web', 'public', 'art', 'scenery.json');

/** What the page listens for, `ART_CUT` in `sprites/PixiSpriteRenderer.ts`. */
export const ART_CUT = 'villages:art-cut';

/** How long after the last save before cutting, because a paint program writes a file in several goes. */
const SETTLE_MS = 300;

const PICTURES = new Set(['.png', '.webp', '.jpg', '.jpeg']);

/** Whether a changed file is one the cut reads, so the tool's own writes never set it off again. */
export function isPicture(file: string): boolean {
  return PICTURES.has(extname(file).toLowerCase());
}

/** Whether a file saved in `world/sprites/`, as the watcher names it, is one a cut of its own reads, left alone here. */
export function isCutElsewhere(file: string): boolean {
  const named = file.replaceAll('\\', '/');
  return named.startsWith('structures/') || named.startsWith('critters/');
}

function cut(server: ViteDevServer, why: string): Promise<boolean> {
  const log = server.config.logger;
  log.info(`[art] ${why}: cutting world/sprites`);
  return new Promise((settle) => {
    const child = spawn(process.execPath, ['bin/cutArt.ts'], { cwd: WORLD_PACKAGE, windowsHide: true });
    let said = '';
    child.stdout.on('data', (chunk: Buffer) => (said += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (said += chunk.toString('utf8')));
    child.on('error', (cause) => {
      log.error(`[art] could not run the cut: ${cause.message}`);
      settle(false);
    });
    child.on('close', (code) => {
      // The summary and anything that went wrong, rather than a line a sprite.
      for (const line of said.split(/\r?\n/)) {
        if (/^(scenery|marks|world:art failed|not a kind)/.test(line)) {
          (code === 0 ? log.info : log.error)(`[art] ${line}`);
        }
      }
      settle(code === 0);
    });
  });
}

/** The atlas's frames as they stand on disk, or nothing in a tree that has never been cut. */
function atlasNow(): string | null {
  return existsSync(ATLAS) ? readFileSync(ATLAS, 'utf8') : null;
}

/**
 * Cuts one at a time, and tells the page only about a cut that changed the atlas.
 *
 * Pictures saved while a cut is running are cut once more when it is done, however many there were. A
 * cut that found nothing new says nothing, because the page lets go of every tree and gathers them all
 * again when it is told: for the atlas it already has, that is a blink of the whole map for nothing, and
 * every start of the server would be one.
 */
export function oneCutAtATime(
  cutTheFolder: (why: string) => Promise<boolean>,
  atlas: () => string | null,
  tellThePage: () => void,
): (why: string) => Promise<void> {
  let running = false;
  let again = false;
  const cutAndSay = async (why: string): Promise<void> => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    const before = atlas();
    const done = await cutTheFolder(why);
    running = false;
    if (done && atlas() !== before) {
      tellThePage();
    }
    if (again) {
      again = false;
      await cutAndSay('saved again while cutting');
    }
  };
  return cutAndSay;
}

export function artApi(): Plugin {
  return {
    name: 'villages:art',
    apply: 'serve',
    configureServer(server) {
      let waiting: ReturnType<typeof setTimeout> | null = null;
      const cutAndSay = oneCutAtATime(
        (why) => cut(server, why),
        atlasNow,
        () => server.ws.send({ type: 'custom', event: ART_CUT }),
      );

      void cutAndSay(existsSync(ATLAS) ? 'the server started' : 'no art cut in this tree yet');
      if (!existsSync(SPRITES_DIR)) {
        return;
      }
      const watcher = watch(SPRITES_DIR, { recursive: true }, (_, file) => {
        if (file === null || !isPicture(file) || isCutElsewhere(file)) {
          return;
        }
        if (waiting !== null) {
          clearTimeout(waiting);
        }
        waiting = setTimeout(() => {
          waiting = null;
          void cutAndSay(`${file.replaceAll('\\', '/')} was saved`);
        }, SETTLE_MS);
      });
      server.httpServer?.on('close', () => watcher.close());
    },
  };
}
