import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { basename, resolve } from 'node:path';

import { toRgb } from '../src/palette.ts';
import type { Palette, Rgb } from '../src/palette.ts';
import { encodeIndexedPng } from '../src/png.ts';
import { TILE_SIZE, cutTile, tileAddresses, tileCount } from '../src/tiles.ts';

import { DEFAULT_MASTER, masterNameOf, worldDirOf } from '../src/masters.ts';

import { flag, named } from './lib/flags.ts';
import { readMaster } from './lib/master.ts';
import { ownFolder, writtenAt } from './lib/outputs.ts';
import { OUTPUT_DIR, PALETTE, RENDER, masterAt } from './lib/paths.ts';

/**
 * Cuts the world into map tiles, in the colours it is drawn in.
 *
 * The terrain is pixels rather than outlines, because thirty-two classes over a world this detailed come
 * to well over a hundred thousand shapes, most of which any servable threshold throws away. As tiles it
 * costs nothing and arrives only where the player is looking. See docs/adr/0019.
 *
 *   node bin/tileWorld.ts [master.png] [--zoom 6] [--out directory]
 *
 * Each master is cut into its own directory, named after it, so several worlds can exist at once and
 * the debug map panel can load any of them.
 */

const masterPath = masterAt(named[0]);
const master = masterNameOf(basename(masterPath)) ?? DEFAULT_MASTER;
const outputDir = flag('out') ?? writtenAt(resolve(OUTPUT_DIR, worldDirOf(master), 'tiles'));
ownFolder(outputDir, 'the tiles');

const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette;
const render = JSON.parse(await readFile(RENDER, 'utf8')) as {
  sea: string;
  colours: Record<string, string>;
};

const missing = palette.classes.filter((terrain) => render.colours[terrain.name] === undefined);
if (missing.length > 0) {
  throw new Error(`world/render.json has no colour for ${missing.map((terrain) => terrain.name).join(', ')}`);
}

/** Class id to the colour it is drawn in, in palette order, ready for an indexed PNG. */
const drawnAs: Rgb[] = [];
for (let id = 0; id <= Math.max(...palette.classes.map((terrain) => terrain.id)); id += 1) {
  const terrain = palette.classes.find((candidate) => candidate.id === id);
  drawnAs.push(toRgb(terrain === undefined ? render.sea : render.colours[terrain.name]!));
}

const world = readMaster(masterPath, palette);

/**
 * The zoom at which a tile pixel is a master pixel, taken from the master itself rather than written
 * down: 256 tile pixels times two to the zoom is the width of the world. Cutting further would only
 * stretch what is already there; cutting less would throw away detail somebody painted.
 */
const nativeZoom = Math.round(Math.log2(world.width / TILE_SIZE));
const maxZoom = flag('zoom') === undefined ? nativeZoom : Number(flag('zoom'));

console.log(
  `read ${master}, ${world.width} by ${world.height}, detail running out at zoom ` +
    `${nativeZoom}; cutting ${tileCount(maxZoom)} tiles`,
);

const deflate = (data: Uint8Array) => new Uint8Array(deflateSync(data, { level: 9 }));
let written = 0;
let bytes = 0;
let lastZoom = -1;

for (const address of tileAddresses(maxZoom)) {
  if (address.zoom !== lastZoom) {
    lastZoom = address.zoom;
    await mkdir(resolve(outputDir, String(address.zoom)), { recursive: true });
  }
  const columnDir = resolve(outputDir, String(address.zoom), String(address.x));
  if (address.y === 0) {
    await mkdir(columnDir, { recursive: true });
  }

  const tile = cutTile(world, address);
  const png = encodeIndexedPng(tile, drawnAs, deflate);
  await writeFile(resolve(columnDir, `${address.y}.png`), png);
  written += 1;
  bytes += png.length;

  if (written % 500 === 0) {
    console.log(`  ${written} tiles, ${(bytes / 1048576).toFixed(1)} MB`);
  }
}

/**
 * What was cut, written last of all.
 *
 * The debug map panel says when a master was last cut, and compares that against when the image was
 * last saved. Nothing else on disk can answer it: the outlines are written minutes before the tiles are
 * finished, so a world would claim to be current when it was not.
 */
await writeFile(
  resolve(outputDir, 'cut.json'),
  `${JSON.stringify({ master, at: new Date().toISOString(), tiles: written, bytes, maxZoom }, null, 2)}\n`,
);

console.log(`\n${written} tiles, ${(bytes / 1048576).toFixed(1)} MB, ${TILE_SIZE} pixels square`);
console.log(`average ${(bytes / written / 1024).toFixed(1)} kB a tile`);
console.log(`into ${outputDir}`);
