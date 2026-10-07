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
 * the world the browser draws, furnishing it with a sprite map, and working out where its land came from.
 *
 * This exists because a master is a 32768 pixel image and the browser draws map tiles. Nothing in a page
 * can turn one into the other, so switching to a master nobody has cut yet means running the world
 * commands, which is five minutes or so of Node. Doing that from here rather than from a terminal is the
 * whole point: the loop from a Photoshop save to looking at it becomes one dropdown.
 *
 * **Cutting does everything a repaint makes stale**: the tiles, the rivers' flow, the sprite map, the ground map
 * the game server reads, and the origin map with the names carried through it, because a half-regenerated world
 * is the confusing state, a stale ground map offers a river that is not there any more, and a stale origin map
 * puts real names on the wrong ground. The quick start does the same, by itself, for a master saved since. The other errands mend one thing apart: furnishing,
 * half a minute, is what a change to `world/biomes.json` needs; the origin, two minutes, a master cut before
 * there was one; the names, a second, a change to `world/names/1790.json`.
 *
 * Development only. There is no deployment yet, and when there is, the world will be cut before it.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');
const MASTER_DIR = resolve(REPO, 'world', 'master');
const BIOMES = resolve(REPO, 'world', 'biomes.json');
/** The review of 1790 the names are carried from. See `docs/plans/real-world-names.md`. */
const REVIEW = resolve(REPO, 'world', 'names', '1790.json');
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
  /** When its origin map was last worked out, and its names last carried through it, or nothing if never. */
  originAt: number | null;
  namedAt: number | null;
}

/** An errand's steps: each a world command and what it was doing, should it fail. */
export const ERRANDS = {
  cut: [
    ['importMaster.ts', 'tracing'],
    ['tileWorld.ts', 'cutting'],
    // Which way its rivers run, for the water: under a minute, and without it they stand still. See 0081.
    ['flowWorld.ts', "working out the rivers' flow of"],
    ['generateSpriteMap.ts', 'furnishing'],
    // What the game server reads the looking circle off, seconds; a stale one offers a river that is gone (0084).
    ['groundWorld.ts', 'reading the ground of'],
    // Where its land came from, and the names carried through that, which a repaint leaves on the wrong ground.
    ['originWorld.ts', 'working out the origin of'],
  ],
  furnish: [['generateSpriteMap.ts', 'furnishing']],
  origin: [['originWorld.ts', 'working out the origin of']],
  names: [['namesWorld.ts', 'carrying the names of']],
} as const satisfies Record<string, readonly (readonly [string, string])[]>;

type Errand = keyof typeof ERRANDS;

/** What the last line says when an errand went through. The page reads `done:` as success. */
const DONE: Record<Errand, string> = {
  cut: 'is ready',
  furnish: 'is furnished',
  origin: 'has its origin worked out and its names carried',
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

/** When a file was last written, or nothing if it is not there. */
async function savedAt(path: string): Promise<number | null> {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return null;
  }
}

/** The time a manifest says it was written at, which is when what it describes was finished. */
async function manifestAt(path: string): Promise<number | null> {
  try {
    const when = Date.parse((JSON.parse(await readFile(path, 'utf8')) as { at?: string }).at ?? '');
    return Number.isNaN(when) ? null : when;
  } catch {
    return null;
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
  return (
    (await manifestAt(resolve(world, 'tiles', 'cut.json'))) ?? savedAt(resolve(world, 'terrain.geojson'))
  );
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
  const [map, stands] = await Promise.all([
    manifestAt(resolve(WORLD_DIR, worldDirOf(name), 'sprites', 'biome', 'map.json')),
    manifestAt(resolve(STANDS_DIR, standsDirOf(name), 'stands.json')),
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

async function masters(): Promise<MasterOnDisk[]> {
  const found: MasterOnDisk[] = [];
  for (const file of await readdir(MASTER_DIR)) {
    const name = masterNameOf(file);
    if (name === null || !isSafeMasterName(name)) {
      continue;
    }
    const path = resolve(MASTER_DIR, file);
    const world = resolve(WORLD_DIR, worldDirOf(name));
    // The origin map's description is written after its picture, and the names last of all, so each one's
    // time is when that part was finished.
    const [details, shape, cut, furnished, originAt, namedAt] = await Promise.all([
      stat(path),
      pngShape(path),
      cutWhen(name),
      furnishedWhen(name),
      savedAt(resolve(world, 'origin', 'origin.json')),
      savedAt(resolve(world, 'names.json')),
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
      originAt,
      namedAt,
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

/** The master a browser asked for, or a reason it cannot be had. Every errand needs the same check. */
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

/**
 * Runs one errand's steps against one master in turn, stopping at the first that fails, and writes each line
 * the commands print straight down the response as it happens, so the browser can put them in the debug log
 * while it waits. The last line is `done:` only if every step was.
 */
async function errand(name: string, which: Errand, response: ServerResponse): Promise<void> {
  const found = await chosen(name, response);
  if (found === null) {
    return;
  }
  busy = name;
  response.statusCode = 200;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  const say = (line: string): void => void response.write(`${line}\n`);
  try {
    say(
      `${which === 'cut' ? 'cutting' : ERRANDS[which][0][1]} ${found.file}, ${found.width} by ${found.height}`,
    );
    for (const [script, doing] of ERRANDS[which]) {
      const code = await run(script, found.file, say);
      if (code !== 0) {
        say(`failed: ${doing} ${name} exited with ${code}`);
        return;
      }
    }
    say(`done: ${name} ${DONE[which]}`);
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

      // Connect strips the mount path, so the listing is "/" and an errand is "/<name>/<errand>".
      server.middlewares.use('/world-api/masters', (request, response, next) => {
        const url = request.url ?? '/';

        if (request.method === 'GET' && (url === '/' || url === '')) {
          // When world/biomes.json and the review of 1790 were saved, beside the masters rather than inside
          // each, because each belongs to none of them and every master is made through it.
          void Promise.all([masters(), savedAt(BIOMES), savedAt(REVIEW)]).then(
            ([found, tunedAt, reviewedAt]) => {
              response.setHeader('content-type', 'application/json');
              response.setHeader('cache-control', 'no-store');
              response.end(JSON.stringify({ masters: found, cutting: busy, tunedAt, reviewedAt }));
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
