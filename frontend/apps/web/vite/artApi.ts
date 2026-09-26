import { spawn } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin, ViteDevServer } from 'vite';

/**
 * The dev server keeps the art cut: whenever a picture in `world/sprites/` is saved, it runs
 * `npm run world:art` again and tells the page, which lets go of the old atlas and draws the new one.
 *
 * So the loop for a sprite is the portraits' loop without the reload: save a picture over a
 * placeholder, look at the map. And a tree that has never been cut is cut when the server starts, so a
 * fresh worktree draws scenery without anybody having to remember a command.
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

export function artApi(): Plugin {
  return {
    name: 'villages:art',
    apply: 'serve',
    configureServer(server) {
      let waiting: ReturnType<typeof setTimeout> | null = null;
      let running = false;
      let again = false;

      const cutAndSay = async (why: string): Promise<void> => {
        if (running) {
          again = true;
          return;
        }
        running = true;
        const done = await cut(server, why);
        running = false;
        if (done) {
          server.ws.send({ type: 'custom', event: ART_CUT });
        }
        if (again) {
          again = false;
          void cutAndSay('saved again while cutting');
        }
      };

      if (!existsSync(ATLAS)) {
        void cutAndSay('no art cut in this tree yet');
      }
      if (!existsSync(SPRITES_DIR)) {
        return;
      }
      const watcher = watch(SPRITES_DIR, { recursive: true }, (_, file) => {
        if (file === null || !isPicture(file)) {
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
