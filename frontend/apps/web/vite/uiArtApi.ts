import { spawn } from 'node:child_process';
import { existsSync, readFileSync, watch } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin, ViteDevServer } from 'vite';

import { oneCutAtATime } from './artApi.ts';

/**
 * The dev server keeps the interface's pictures cut: whenever a picture in `world/ui/` is saved, or a
 * border's `.json` beside it, and every time the server starts, it runs `npm run world:ui` again, and when
 * that changed what is cut it tells the page, which reads the list again and draws the new pictures.
 *
 * So the loop for an interface picture is the sprites' loop: save a picture over a placeholder, look at
 * /admin/inspect-ui-components. A cut that finds nothing new writes nothing and says nothing.
 *
 * Development only, like `artApi.ts`. See decision record 0068.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');
const UI_DIR = resolve(REPO, 'world', 'ui');
const WORLD_PACKAGE = resolve(REPO, 'frontend', 'packages', 'world');
const LIST = resolve(REPO, 'frontend', 'apps', 'web', 'public', 'ui', 'ui.json');

/** What the page listens for, `UI_CUT` in `ui/art/pictures.ts`. */
export const UI_CUT = 'villages:ui-cut';

/** How long after the last save before cutting, because a paint program writes a file in several goes. */
const SETTLE_MS = 300;

const PICTURES = new Set(['.png', '.webp', '.jpg', '.jpeg']);

/**
 * Whether a changed file is one the cut reads: a picture in a kind's folder, or a border's file. The
 * moodboard is not read by a cut, and `placeholders.json` is written by one, so neither sets it off.
 */
export function isUiSource(file: string): boolean {
  const path = file.replaceAll('\\', '/');
  if (!path.includes('/')) {
    return false;
  }
  const extension = extname(path).toLowerCase();
  return PICTURES.has(extension) || (extension === '.json' && path.startsWith('borders/'));
}

function cut(server: ViteDevServer, why: string): Promise<boolean> {
  const log = server.config.logger;
  log.info(`[ui] ${why}: cutting world/ui`);
  return new Promise((settle) => {
    const child = spawn(process.execPath, ['bin/cutUi.ts'], { cwd: WORLD_PACKAGE, windowsHide: true });
    let said = '';
    child.stdout.on('data', (chunk: Buffer) => (said += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (said += chunk.toString('utf8')));
    child.on('error', (cause) => {
      log.error(`[ui] could not run the cut: ${cause.message}`);
      settle(false);
    });
    child.on('close', (code) => {
      // The summary and anything that went wrong, rather than a line a picture.
      for (const line of said.split(/\r?\n/)) {
        if (/^(ui:|world:ui failed|forgot)/.test(line)) {
          (code === 0 ? log.info : log.error)(`[ui] ${line}`);
        }
      }
      settle(code === 0);
    });
  });
}

/** The version of the list as it stands on disk, or nothing in a tree that has never been cut. */
function listNow(): string | null {
  if (!existsSync(LIST)) {
    return null;
  }
  try {
    return (JSON.parse(readFileSync(LIST, 'utf8')) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

export function uiArtApi(): Plugin {
  return {
    name: 'villages:ui-art',
    apply: 'serve',
    configureServer(server) {
      let waiting: ReturnType<typeof setTimeout> | null = null;
      const cutAndSay = oneCutAtATime(
        (why) => cut(server, why),
        listNow,
        () => server.ws.send({ type: 'custom', event: UI_CUT }),
      );

      void cutAndSay(existsSync(LIST) ? 'the server started' : 'no interface pictures cut in this tree yet');
      if (!existsSync(UI_DIR)) {
        return;
      }
      const watcher = watch(UI_DIR, { recursive: true }, (_, file) => {
        if (file === null || !isUiSource(file)) {
          return;
        }
        if (waiting !== null) {
          clearTimeout(waiting);
        }
        waiting = setTimeout(() => {
          waiting = null;
          void cutAndSay(`world/ui/${file.replaceAll('\\', '/')} was saved`);
        }, SETTLE_MS);
      });
      server.httpServer?.on('close', () => watcher.close());
    },
  };
}
