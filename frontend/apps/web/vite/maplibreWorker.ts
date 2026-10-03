import { readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';

import type { Plugin } from 'vite';

/**
 * MapLibre's worker, in a production build.
 *
 * MapLibre 6 starts its worker from the file beside its own module, `./maplibre-gl-worker.mjs` resolved
 * against `import.meta.url`, and the worker imports `./maplibre-gl-shared.mjs` in turn. The dev server
 * serves the package as it was installed, so both are where MapLibre looks. A build bundles MapLibre into
 * one of the page's chunks and copies neither, and a built page asked for `/assets/maplibre-gl-worker.mjs`,
 * was answered with the page itself, and its map never finished loading: the terrain drew and nothing
 * stood on it.
 *
 * So a build puts the worker, and whatever it imports from beside itself, next to whichever chunk MapLibre
 * was bundled into, as they were installed. MapLibre then finds its worker in a built page the way it does
 * on the dev server, which never sees any of this. See decision record 0080.
 */

/** MapLibre's own module, the one that works out where its worker is from its own address. */
const MAPLIBRE = /[\\/]maplibre-gl[\\/]dist[\\/]maplibre-gl\.mjs$/;

/** The worker, by the name MapLibre asks for it beside itself. */
export const WORKER = 'maplibre-gl-worker.mjs';

/** What a module imports from the folder it is in: `x.mjs` out of `from"./x.mjs"`, static or dynamic. */
const BESIDE = /\b(?:from|import)\s*\(?\s*["']\.\/([^"']+)["']/g;

/** The last line of an installed file, which points at a source map a build does not ship. */
const SOURCE_MAP = /\n\/\/# sourceMappingURL=[^\n]*\s*$/;

/** As much of a chunk of the build as this needs to know. */
export interface Chunk {
  fileName: string;
  moduleIds: readonly string[];
  code: string;
}

/** Where MapLibre was bundled, and where it was installed. */
export interface Bundled {
  /** The folder of the build that holds MapLibre's chunk, which is where it looks for its worker. */
  beside: string;
  /** The folder its files were installed in, on disk. */
  installed: string;
}

/**
 * Which chunk MapLibre was bundled into. The build fails here, rather than shipping a map that never loads,
 * when MapLibre is in none of them or no longer asks for its worker by the name it is copied under.
 */
export function whereMaplibreIs(chunks: readonly Chunk[]): Bundled {
  for (const chunk of chunks) {
    const maplibre = chunk.moduleIds.find((id) => MAPLIBRE.test(id));
    if (maplibre === undefined) {
      continue;
    }
    if (!chunk.code.includes(WORKER)) {
      throw new Error(
        `MapLibre no longer asks for ${WORKER} beside itself, so the build cannot put its worker where it looks. ` +
          'See apps/web/vite/maplibreWorker.ts and decision record 0080.',
      );
    }
    return { beside: posix.dirname(chunk.fileName), installed: dirname(maplibre) };
  }
  throw new Error(
    'MapLibre is in none of the chunks of the build, so there is nothing to put its worker beside. ' +
      'See apps/web/vite/maplibreWorker.ts and decision record 0080.',
  );
}

/** The worker and every file it imports from beside itself, by name, each read by `read`. */
export function workerFiles(read: (name: string) => string): Map<string, string> {
  const files = new Map<string, string>();
  const add = (name: string): void => {
    if (files.has(name)) {
      return;
    }
    const code = read(name);
    files.set(name, code.replace(SOURCE_MAP, '\n'));
    for (const [, imported] of code.matchAll(BESIDE)) {
      if (imported !== undefined) {
        add(imported);
      }
    }
  };
  add(WORKER);
  return files;
}

export function maplibreWorker(): Plugin {
  return {
    name: 'villages:maplibre-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((output) => output.type === 'chunk');
      const { beside, installed } = whereMaplibreIs(chunks);
      for (const [name, source] of workerFiles((file) => readFileSync(join(installed, file), 'utf8'))) {
        this.emitFile({ type: 'asset', fileName: posix.join(beside, name), source });
      }
    },
  };
}
