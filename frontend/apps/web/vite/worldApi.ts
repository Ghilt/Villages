import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { open, readdir, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

// Reached by a relative path rather than as `@villages/world`: Vite bundles a config's relative imports
// itself, where a bare workspace specifier is left for Node to resolve, and what it would find is
// TypeScript source.
import {
  DEFAULT_MASTER,
  isSafeMasterName,
  masterNameOf,
  worldDirOf,
} from '../../../packages/world/src/masters.ts';
import { worldCacheDir } from '../../../packages/world/bin/lib/checkouts.ts';
import { heldBy } from '../../../packages/world/bin/lib/locks.ts';
import { Shelf, treeNameOf } from '../../../packages/world/bin/lib/worldCache.ts';
import { HashMemo } from '../../../packages/world/bin/lib/worldKeys.ts';
import { statesOf } from '../../../packages/world/bin/lib/worldState.ts';
import type { Standing } from '../../../packages/world/bin/lib/worldState.ts';

/**
 * The dev server's errands for the debug map panel: what masters are in `world/master`, where each of their world
 * steps stands in this tree, and making one current.
 *
 * This exists because a master is a 32768 pixel image and the browser draws map tiles. Nothing in a page can turn
 * one into the other, so switching to a master nobody has cut yet means running the world commands. Doing that
 * from here rather than from a terminal is the whole point: the loop from a Photoshop save to looking at it
 * becomes one dropdown.
 *
 * **Every errand is `world:ready`**, the one way the world is made (decision record 0095): a step the world cache
 * has for this tree's inputs is borrowed in seconds, and one nobody has made is made, once for every tree. Cutting
 * makes every step current; furnishing, the origin and the names make theirs and every step made from them. What
 * is stale is told from fingerprints, never from dates, and so is why: a palette saved, a tool's code changed.
 *
 * Development only. There is no deployment yet, and when there is, the world will be cut before it.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');
const MASTER_DIR = resolve(REPO, 'world', 'master');
const WORLD_DIR = resolve(REPO, 'frontend', 'apps', 'web', 'public', 'world');
const WORLD_PACKAGE = resolve(REPO, 'frontend', 'packages', 'world');

/** Where one world step of a master stands in this tree, and why when it is not current. */
export interface StepOnDisk {
  name: string;
  standing: Standing;
  why: string[];
}

export interface MasterOnDisk {
  name: string;
  file: string;
  /** The master's size in pixels, read from the PNG header rather than by decoding it. */
  width: number;
  height: number;
  bytes: number;
  /** Whether this tree has its tiles at all, current or not: whether the map can draw it without waiting. */
  drawn: boolean;
  steps: StepOnDisk[];
}

/** What each errand asks `world:ready` for: every step, or one and the steps made from it. */
export const ERRANDS = {
  cut: [],
  furnish: ['--only', 'sprites'],
  origin: ['--only', 'origin'],
  names: ['--only', 'names'],
} as const satisfies Record<string, readonly string[]>;

type Errand = keyof typeof ERRANDS;

/** What the last line says when an errand went through. The page reads `done:` as success. */
const DONE: Record<Errand, string> = {
  cut: 'is ready',
  furnish: 'is furnished',
  origin: 'has its origin worked out, its names carried and its height fitted',
  names: 'has its names carried',
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * How wide and tall a PNG is, from its first twenty-four bytes.
 *
 * The masters are twenty-five megabytes each and there are several, so the listing reads the header and
 * nothing else. IHDR is always the first chunk, and its first two fields are the dimensions.
 */
async function pngShape(path: string): Promise<{ width: number; height: number } | null> {
  let file;
  try {
    file = await open(path, 'r');
    const head = Buffer.alloc(24);
    const { bytesRead } = await file.read(head, 0, 24, 0);
    if (bytesRead < 24 || !PNG_SIGNATURE.every((byte, at) => head[at] === byte)) {
      return null;
    }
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  } catch {
    return null;
  } finally {
    await file?.close();
  }
}

/**
 * Whether a request is for stands under the page's world: the records in `stands/`, or the readable copy of the
 * fullest of them. The generator writes neither there any more, but a master furnished before they moved keeps
 * them on disk until it is furnished again, and serving them would hand any page every wood in the world, which
 * the gateway hands out only as far as a house has seen. Read as the file system would read it, so no spelling
 * of the same path gets past. See decision record 0067.
 */
export function asksForStands(url: string): boolean {
  let path = (url.split('?')[0] ?? '').split('#')[0] ?? '';
  try {
    path = decodeURIComponent(path);
  } catch {
    // Tested as it came, which is the only way a server that cannot decode it could look it up.
  }
  const plain = posix.normalize(path.replaceAll('\\', '/')).toLowerCase();
  return /^\/world\/masters\/[^/]+\/sprites\/[^/]+\/(stands(\/|$)|busiest-chunk\.json$)/.test(plain);
}

/** The world cache, and what its files hash to, kept between listings so a second costs a look at each file. */
let shelf: Shelf | null = null;
let memo: HashMemo | null = null;

async function masters(): Promise<MasterOnDisk[]> {
  shelf ??= new Shelf(worldCacheDir(REPO));
  memo ??= new HashMemo(shelf.hashesFile());
  const found: MasterOnDisk[] = [];
  for (const file of await readdir(MASTER_DIR)) {
    const name = masterNameOf(file);
    if (name === null || !isSafeMasterName(name)) {
      continue;
    }
    const path = resolve(MASTER_DIR, file);
    const [details, shape] = await Promise.all([stat(path), pngShape(path)]);
    if (!details.isFile() || shape === null) {
      continue;
    }
    found.push({
      name,
      file,
      width: shape.width,
      height: shape.height,
      bytes: details.size,
      drawn: existsSync(resolve(WORLD_DIR, worldDirOf(name), 'tiles', 'cut.json')),
      steps: statesOf(name, REPO, shelf, memo).map(({ name: step, standing, why }) => ({
        name: step,
        standing,
        why,
      })),
    });
  }
  memo.save();

  // The default first, then the rest by name: which was painted last is no longer told from a date, which git
  // sets to the moment of checkout.
  return found.sort((left, right) => {
    if (left.name === DEFAULT_MASTER) {
      return -1;
    }
    if (right.name === DEFAULT_MASTER) {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });
}

/** Who is making this tree's world just now - this panel, the quick start, a terminal - or nothing. */
function working(): string | null {
  shelf ??= new Shelf(worldCacheDir(REPO));
  return heldBy(shelf.lockOfTree(treeNameOf(REPO))) ?? null;
}

/** Runs `world:ready` for one master, handing back each line as it is printed. */
function ready(file: string, words: readonly string[], say: (line: string) => void): Promise<number> {
  return new Promise((settle) => {
    const child = spawn(process.execPath, ['bin/readyWorld.ts', resolve(MASTER_DIR, file), ...words], {
      cwd: WORLD_PACKAGE,
      windowsHide: true,
    });

    let rest = '';
    const take = (chunk: Buffer): void => {
      rest += chunk.toString('utf8');
      const lines = rest.split(/\r?\n/);
      rest = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim() !== '') {
          say(line.trimEnd());
        }
      }
    };

    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (cause) => {
      say(`could not run world:ready: ${cause.message}`);
      settle(-1);
    });
    child.on('close', (code) => {
      if (rest.trim() !== '') {
        say(rest.trimEnd());
      }
      settle(code ?? -1);
    });
  });
}

/**
 * Runs one errand against one master and writes each line `world:ready` prints straight down the response as it
 * happens, so the browser can put them in the debug log while it waits. The last line is `done:` only if it went
 * through. One run a tree at a time, whoever started it: the world cache's lock of this tree says who has it.
 */
async function errand(name: string, which: Errand, response: ServerResponse): Promise<void> {
  const holder = working();
  if (holder !== null) {
    response.statusCode = 409;
    response.end(`already working: ${holder}\n`);
    return;
  }
  // The name arrives from a browser and becomes a path, so it is checked against the folder rather than
  // merely sanitised: only a master that is really there can be asked for.
  const files = await readdir(MASTER_DIR);
  const file = files.find((one) => masterNameOf(one) === name && isSafeMasterName(name));
  if (file === undefined) {
    response.statusCode = 404;
    response.end(`no master called ${name} in world/master\n`);
    return;
  }
  response.statusCode = 200;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  const say = (line: string): void => void response.write(`${line}\n`);
  try {
    const code = await ready(file, ERRANDS[which], say);
    say(code === 0 ? `done: ${name} ${DONE[which]}` : `failed: world:ready for ${name} exited with ${code}`);
  } catch (cause) {
    say(`failed: ${(cause as Error).message}`);
  } finally {
    response.end();
  }
}

export function worldApi(): Plugin {
  return {
    name: 'villages:world-api',
    apply: 'serve',
    configureServer(server) {
      // Ahead of the public folder, so that no stands left in it by an older generator are served.
      server.middlewares.use((request, response, next) => {
        if (asksForStands(request.url ?? '')) {
          response.statusCode = 404;
          response.end();
          return;
        }
        next();
      });

      // Connect strips the mount path, so the listing is "/" and an errand is "/<name>/<errand>".
      server.middlewares.use('/world-api/masters', (request, response, next) => {
        const url = request.url ?? '/';

        if (request.method === 'GET' && (url === '/' || url === '')) {
          void masters().then(
            (found) => {
              response.setHeader('content-type', 'application/json');
              response.setHeader('cache-control', 'no-store');
              response.end(JSON.stringify({ masters: found, working: working() }));
            },
            (cause: Error) => {
              response.statusCode = 500;
              response.end(cause.message);
            },
          );
          return;
        }

        const asked = /^\/([^/]+)\/(cut|furnish|origin|names)\/?$/.exec(url);
        if (request.method === 'POST' && asked !== null) {
          void errand(decodeURIComponent(asked[1]!), asked[2] as Errand, response);
          return;
        }

        next();
      });
    },
  };
}
