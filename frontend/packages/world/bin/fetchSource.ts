import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { SOURCE_DIR, WARP_CONFIG } from './paths.ts';

/**
 * Downloads the raw material for our world: Natural Earth, which is public domain and holds coastlines,
 * lakes and rivers and nothing else. No roads, no buildings, no shops, which is exactly what a world seen
 * from above wants. Run once; the files are not committed.
 */

const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

interface WarpFile {
  layers: { name: string; source: string }[];
}

const config = JSON.parse(await readFile(WARP_CONFIG, 'utf8')) as WarpFile;

await mkdir(SOURCE_DIR, { recursive: true });

for (const layer of config.layers) {
  const target = resolve(SOURCE_DIR, `${layer.source}.geojson`);
  if (existsSync(target)) {
    console.log(`have    ${layer.source}`);
    continue;
  }

  const url = `${BASE}/${layer.source}.geojson`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  await writeFile(target, body);
  console.log(`fetched ${layer.source} (${(body.byteLength / 1048576).toFixed(2)} MB)`);
}

console.log(`\nNatural Earth, public domain, from ${BASE}`);
console.log(`into ${SOURCE_DIR}`);
