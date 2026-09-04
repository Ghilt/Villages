import { spawn } from 'node:child_process';
import { open, readFile, readdir, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
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

/**
 * The dev server's one errand for the debug map panel: what masters are in `world/master`, and cutting
 * one of them into the world the browser draws.
 *
 * This exists because a master is a 32768 pixel image and the browser draws map tiles. Nothing in a page
 * can turn one into the other, so switching to a master nobody has cut yet means running the two world
 * commands, which is five minutes or so of Node. Doing that from here rather than from a terminal is the
 * whole point: the loop from a Photoshop save to looking at it becomes one dropdown.
 *
 * Development only. There is no deployment yet, and when there is, the world will be cut before it.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');
const MASTER_DIR = resolve(REPO, 'world', 'master');
const WORLD_DIR = resolve(REPO, 'frontend', 'apps', 'web', 'public', 'world');
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

async function masters(): Promise<MasterOnDisk[]> {
  const found: MasterOnDisk[] = [];
  for (const file of await readdir(MASTER_DIR)) {
    const name = masterNameOf(file);
    if (name === null || !isSafeMasterName(name)) {
      continue;
    }
    const path = resolve(MASTER_DIR, file);
    const [details, shape, cut] = await Promise.all([stat(path), pngShape(path), cutWhen(name)]);
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
let cutting: string | null = null;

/**
 * Cuts one master, writing each line the commands print straight down the response as it happens, so
 * the browser can put them in the debug log while it waits.
 */
async function cut(name: string, response: ServerResponse): Promise<void> {
  if (cutting !== null) {
    response.statusCode = 409;
    response.end(`already cutting ${cutting}\n`);
    return;
  }

  // The name arrives from a browser and becomes a path, so it is checked against the folder rather than
  // merely sanitised: only a master that is really there can be asked for.
  const found = (await masters()).find((candidate) => candidate.name === name);
  if (found === undefined) {
    response.statusCode = 404;
    response.end(`no master called ${name} in world/master\n`);
    return;
  }

  cutting = name;
  response.statusCode = 200;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  const say = (line: string): void => {
    response.write(`${line}\n`);
  };

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
    say(`done: ${name} is ready`);
  } catch (cause) {
    say(`failed: ${(cause as Error).message}`);
  } finally {
    cutting = null;
    response.end();
  }
}

export function worldApi(): Plugin {
  return {
    name: 'villages:world-api',
    apply: 'serve',
    configureServer(server) {
      // Connect strips the mount path, so the listing is "/" and cutting one is "/<name>/cut".
      server.middlewares.use('/world-api/masters', (request, response, next) => {
        const url = request.url ?? '/';

        if (request.method === 'GET' && (url === '/' || url === '')) {
          void masters().then(
            (found) => {
              response.setHeader('content-type', 'application/json');
              response.setHeader('cache-control', 'no-store');
              response.end(JSON.stringify({ masters: found, cutting }));
            },
            (cause: Error) => {
              response.statusCode = 500;
              response.end(cause.message);
            },
          );
          return;
        }

        const asked = /^\/([^/]+)\/cut\/?$/.exec(url);
        if (request.method === 'POST' && asked !== null) {
          void cut(decodeURIComponent(asked[1]!), response);
          return;
        }

        next();
      });
    },
  };
}
