import { spawn } from 'node:child_process';
import { open, readFile, readdir, stat } from 'node:fs/promises';
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
  standsDirOf,
  worldDirOf,
} from '../../../packages/world/src/masters.ts';

/**
 * The dev server's errands for the debug map panel: what masters are in `world/master`, cutting one into
 * the world the browser draws, and furnishing it with a sprite map.
 *
 * This exists because a master is a 32768 pixel image and the browser draws map tiles. Nothing in a page
 * can turn one into the other, so switching to a master nobody has cut yet means running the world
 * commands, which is five minutes or so of Node. Doing that from here rather than from a terminal is the
 * whole point: the loop from a Photoshop save to looking at it becomes one dropdown.
 *
 * **Cutting furnishes too, and works out the rivers' flow**, because a repaint makes all of it stale and a
 * half-regenerated world is the confusing state. Furnishing on its own is the fast errand, half a minute, and
 * is what a change to `world/biomes.json` needs - which is the file somebody tuning a look edits over and over.
 *
 * Development only. There is no deployment yet, and when there is, the world will be cut before it.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');
const MASTER_DIR = resolve(REPO, 'world', 'master');
const BIOMES = resolve(REPO, 'world', 'biomes.json');
const WORLD_DIR = resolve(REPO, 'frontend', 'apps', 'web', 'public', 'world');
/** Where the generator writes the stands, which nothing here serves. See `standsDirOf` and decision 0067. */
const STANDS_DIR = resolve(REPO, 'world', 'stands');
const WORLD_PACKAGE = resolve(REPO, 'frontend', 'packages', 'world');

/** What the npm scripts give them, because both hold a whole master in memory at once. */
const HEAP_MB = 8192;

export interface MasterOnDisk {
  name: string;
  file: string;
  /** The master's size in pixels, read from the PNG header rather than by decoding it. */
  width: number;
  height: number;
  bytes: number;
  /** When the image was last saved, and when it was last cut into a world. Milliseconds. */
  editedAt: number;
  cutAt: number | null;
  /** When its sprite map was last worked out, or nothing if it has none and so grows nothing. */
  furnishedAt: number | null;
}

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
 * When this master was last cut, or nothing if it never has been.
 *
 * From the manifest the tiler writes last of all, because nothing else on disk knows: the outlines are
 * written minutes before the tiles are finished, and a directory's own time stops moving as soon as its
 * subdirectories exist. Either would have a world claiming to be current when it was not. A world cut
 * before the manifest existed falls back to the outlines, and reads a few minutes early.
 */
async function cutWhen(name: string): Promise<number | null> {
  const world = resolve(WORLD_DIR, worldDirOf(name));
  try {
    const manifest = JSON.parse(await readFile(resolve(world, 'tiles', 'cut.json'), 'utf8')) as {
      at?: string;
    };
    const at = Date.parse(manifest.at ?? '');
    if (!Number.isNaN(at)) {
      return at;
    }
  } catch {
    // No manifest, so fall through to the outlines, which is a world cut before this existed.
  }
  try {
    return (await stat(resolve(world, 'terrain.geojson'))).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * When this master's sprite map was last worked out, or nothing if it has none.
 *
 * From the manifest the generator writes last of all, for the reason `cutWhen` gives: a directory's time
 * stops moving once its subdirectories exist, so it would claim a world that was not finished. There is
 * no older fallback, because a master with no manifest has no sprite map and grows nothing at all.
 *
 * **Both halves, or it is not furnished.** The stands go where only the game server reads them, and a master
 * furnished before they moved has a manifest and no stands there: its woods are gone, and saying so is what
 * puts the button to furnish it again in front of whoever is looking. See decision record 0067.
 */
async function furnishedWhen(name: string): Promise<number | null> {
  const at = async (file: string): Promise<number | null> => {
    try {
      const manifest = JSON.parse(await readFile(file, 'utf8')) as { at?: string };
      const when = Date.parse(manifest.at ?? '');
      return Number.isNaN(when) ? null : when;
    } catch {
      return null;
    }
  };
  const [map, stands] = await Promise.all([
    at(resolve(WORLD_DIR, worldDirOf(name), 'sprites', 'biome', 'map.json')),
    at(resolve(STANDS_DIR, standsDirOf(name), 'stands.json')),
  ]);
  return map === null || stands === null ? null : Math.min(map, stands);
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

/**
 * When `world/biomes.json` was last saved.
 *
 * Beside the masters rather than inside each one, because it belongs to none of them: it is one
 * hand-edited file that every master's sprite map is generated through. Somebody tuning a look edits it
 * and nothing else, so without this the panel would go on saying every world was furnished and current
 * while all of them were a table out of date.
 */
async function tunedWhen(): Promise<number | null> {
  try {
    return (await stat(BIOMES)).mtimeMs;
  } catch {
    return null;
  }
}

async function masters(): Promise<MasterOnDisk[]> {
  const found: MasterOnDisk[] = [];
  for (const file of await readdir(MASTER_DIR)) {
    const name = masterNameOf(file);
    if (name === null || !isSafeMasterName(name)) {
      continue;
    }
    const path = resolve(MASTER_DIR, file);
    const [details, shape, cut, furnished] = await Promise.all([
      stat(path),
      pngShape(path),
      cutWhen(name),
      furnishedWhen(name),
    ]);
    if (!details.isFile() || shape === null) {
      continue;
    }
    found.push({
      name,
      file,
      width: shape.width,
      height: shape.height,
      bytes: details.size,
      editedAt: details.mtimeMs,
      cutAt: cut,
      furnishedAt: furnished,
    });
  }

  // The default first, then the rest as they were last saved, newest first: the master somebody has
  // just been painting is the one they want to look at.
  return found.sort((left, right) => {
    if (left.name === DEFAULT_MASTER) {
      return -1;
    }
    if (right.name === DEFAULT_MASTER) {
      return 1;
    }
    return right.editedAt - left.editedAt;
  });
}

/** Runs one world command against one master, handing back each line as it is printed. */
function run(script: string, file: string, say: (line: string) => void): Promise<number> {
  return new Promise((settle) => {
    const child = spawn(
      process.execPath,
      [`--max-old-space-size=${HEAP_MB}`, `bin/${script}`, resolve(MASTER_DIR, file)],
      { cwd: WORLD_PACKAGE, windowsHide: true },
    );

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
      say(`could not run ${script}: ${cause.message}`);
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

/** One at a time: each command holds eight gigabytes of heap, and two of them would be unkind. */
let busy: string | null = null;

/** The master a browser asked for, or a reason it cannot be had. Both errands need the same check. */
async function chosen(name: string, response: ServerResponse): Promise<MasterOnDisk | null> {
  if (busy !== null) {
    response.statusCode = 409;
    response.end(`already working on ${busy}\n`);
    return null;
  }
  // The name arrives from a browser and becomes a path, so it is checked against the folder rather than
  // merely sanitised: only a master that is really there can be asked for.
  const found = (await masters()).find((candidate) => candidate.name === name);
  if (found === undefined) {
    response.statusCode = 404;
    response.end(`no master called ${name} in world/master\n`);
    return null;
  }
  return found;
}

/** Opens a plain-text response the browser can read a line at a time while it waits. */
function streaming(response: ServerResponse): (line: string) => void {
  response.statusCode = 200;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  return (line: string): void => {
    response.write(`${line}\n`);
  };
}

/** Works out one master's biomes and stands. Half a minute, and all a biomes.json edit needs. */
async function furnish(name: string, response: ServerResponse): Promise<void> {
  const found = await chosen(name, response);
  if (found === null) {
    return;
  }
  busy = name;
  const say = streaming(response);
  try {
    say(`furnishing ${found.file}`);
    const made = await run('generateSpriteMap.ts', found.file, say);
    say(made === 0 ? `done: ${name} is furnished` : `failed: furnishing ${name} exited with ${made}`);
  } catch (cause) {
    say(`failed: ${(cause as Error).message}`);
  } finally {
    busy = null;
    response.end();
  }
}

/**
 * Cuts one master, writing each line the commands print straight down the response as it happens, so
 * the browser can put them in the debug log while it waits.
 */
async function cut(name: string, response: ServerResponse): Promise<void> {
  const found = await chosen(name, response);
  if (found === null) {
    return;
  }

  busy = name;
  const say = streaming(response);

  try {
    say(`cutting ${found.file}, ${found.width} by ${found.height}`);
    const traced = await run('importMaster.ts', found.file, say);
    if (traced !== 0) {
      say(`failed: tracing ${name} exited with ${traced}`);
      return;
    }
    const tiled = await run('tileWorld.ts', found.file, say);
    if (tiled !== 0) {
      say(`failed: cutting ${name} exited with ${tiled}`);
      return;
    }
    // Which way its rivers run, for the water: under a minute, and without it they stand still. See 0081.
    const flowed = await run('flowWorld.ts', found.file, say);
    if (flowed !== 0) {
      say(`failed: working out ${name}'s rivers exited with ${flowed}`);
      return;
    }
    // A repaint makes the sprite map stale as surely as it makes the tiles stale, so the two are never
    // left out of step: pressing cut gives back a whole world rather than a bare one.
    const made = await run('generateSpriteMap.ts', found.file, say);
    if (made !== 0) {
      say(`failed: furnishing ${name} exited with ${made}`);
      return;
    }
    say(`done: ${name} is ready`);
  } catch (cause) {
    say(`failed: ${(cause as Error).message}`);
  } finally {
    busy = null;
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

      // Connect strips the mount path, so the listing is "/" and an errand is "/<name>/cut" or
      // "/<name>/furnish".
      server.middlewares.use('/world-api/masters', (request, response, next) => {
        const url = request.url ?? '/';

        if (request.method === 'GET' && (url === '/' || url === '')) {
          void Promise.all([masters(), tunedWhen()]).then(
            ([found, tunedAt]) => {
              response.setHeader('content-type', 'application/json');
              response.setHeader('cache-control', 'no-store');
              response.end(JSON.stringify({ masters: found, cutting: busy, tunedAt }));
            },
            (cause: Error) => {
              response.statusCode = 500;
              response.end(cause.message);
            },
          );
          return;
        }

        const asked = /^\/([^/]+)\/(cut|furnish)\/?$/.exec(url);
        if (request.method === 'POST' && asked !== null) {
          const name = decodeURIComponent(asked[1]!);
          void (asked[2] === 'cut' ? cut(name, response) : furnish(name, response));
          return;
        }

        next();
      });
    },
  };
}
