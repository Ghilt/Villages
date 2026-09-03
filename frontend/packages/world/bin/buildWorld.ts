import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { warpCollection } from '../src/geometry.ts';
import type { FeatureCollection } from '../src/geometry.ts';
import type { WarpConfig } from '../src/warp.ts';

import { SOURCE_DIR, WARP_CONFIG, WARPED_DIR } from './paths.ts';

/**
 * Warps the real Earth, and writes the result as raw material.
 *
 * The world the game plays on is painted by hand now, so this is no longer how the world is shaped: it is
 * a way to produce a different Earth to start painting from, when a recognisable one is not wanted. Feed
 * its output into the master build. See docs/adr/0018.
 */

interface LayerSpec {
  name: string;
  source: string;
  keep?: string[];
}

type WarpFile = WarpConfig & { layers: LayerSpec[] };

const config = JSON.parse(await readFile(WARP_CONFIG, 'utf8')) as WarpFile;
await mkdir(WARPED_DIR, { recursive: true });

const summary: string[] = [];

for (const layer of config.layers) {
  const raw = await readFile(resolve(SOURCE_DIR, `${layer.source}.geojson`), 'utf8').catch(() => {
    throw new Error(
      `${layer.source} is missing. Run "npm run world:fetch --prefix frontend" to download the raw material.`,
    );
  });

  const source = JSON.parse(raw) as FeatureCollection;
  const warped = warpCollection(source, config, layer.keep ?? []);
  const body = JSON.stringify(warped);
  await writeFile(resolve(WARPED_DIR, `${layer.name}.geojson`), body);

  summary.push(
    `${layer.name.padEnd(8)} ${String(warped.features.length).padStart(6)} features  ` +
      `${(body.length / 1048576).toFixed(2)} MB`,
  );
}

const octaves = config.noise
  .map((octave) => `${octave.cellsX}x${octave.cellsY} at ${octave.amplitude}`)
  .join(', ');
console.log(`warped with ${config.controls.length} controls and wobble in degrees: ${octaves}`);
console.log();
console.log(summary.join('\n'));
console.log(`\ninto ${WARPED_DIR}`);
