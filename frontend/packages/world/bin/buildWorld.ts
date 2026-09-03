import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { warpCollection } from '../src/geometry.ts';
import type { FeatureCollection } from '../src/geometry.ts';
import type { WarpConfig } from '../src/warp.ts';

import { OUTPUT_DIR, SOURCE_DIR, WARP_CONFIG } from './paths.ts';

/**
 * Turns the real Earth into our world: reads the warp configuration and the Natural Earth layers, moves
 * every coordinate through the warp, and writes the result where the app can serve it.
 *
 * The output is the world the game treats as real. Nothing at runtime knows about the Earth it came from.
 */

interface LayerSpec {
  name: string;
  source: string;
  keep?: string[];
}

type WarpFile = WarpConfig & { layers: LayerSpec[] };

const config = JSON.parse(await readFile(WARP_CONFIG, 'utf8')) as WarpFile;
await mkdir(OUTPUT_DIR, { recursive: true });

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
  await writeFile(resolve(OUTPUT_DIR, `${layer.name}.geojson`), body);

  summary.push(
    `${layer.name.padEnd(8)} ${String(warped.features.length).padStart(6)} features  ` +
      `${(body.length / 1048576).toFixed(2)} MB`,
  );
}

console.log(`warped with ${config.controls.length} controls, wobble ${config.noise.amplitude} degrees\n`);
console.log(summary.join('\n'));
console.log(`\ninto ${OUTPUT_DIR}`);
