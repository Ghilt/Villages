import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';

import { PNG } from 'pngjs';

import { preparePalette, snapPrepared, toRgb } from '../src/palette.ts';
import type { Palette, Rgb } from '../src/palette.ts';
import { createRaster } from '../src/raster.ts';
import type { ClassRaster } from '../src/raster.ts';
import { encodeIndexedPng } from '../src/png.ts';
import { TILE_SIZE, cutTile, tileAddresses, tileCount } from '../src/tiles.ts';

import { MASTER_DIR, OUTPUT_DIR, PALETTE, RENDER } from './paths.ts';

/**
 * Cuts the world into map tiles, in the colours it is drawn in.
 *
 * The terrain is pixels rather than outlines, because thirty-two classes over a world this detailed come
 * to well over a hundred thousand shapes, most of which any servable threshold throws away. As tiles it
 * costs nothing and arrives only where the player is looking. See docs/adr/0019.
 *
 *   node bin/tileWorld.ts [--zoom 6] [--out directory]
 */

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? undefined : args[at + 1];
};

const outputDir = flag('out') ?? resolve(OUTPUT_DIR, 'tiles');

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

const prepared = preparePalette(palette);
const decoded = PNG.sync.read(await readFile(resolve(MASTER_DIR, 'terrain.png')));
const world: ClassRaster = createRaster(decoded.width, decoded.height);
const remembered = new Int16Array(1 << 24).fill(-1);

for (let index = 0; index < world.cells.length; index += 1) {
  const at = index * 4;
  const red = decoded.data[at]!;
  const green = decoded.data[at + 1]!;
  const blue = decoded.data[at + 2]!;
  const colour = (red << 16) | (green << 8) | blue;
  let id = remembered[colour]!;
  if (id < 0) {
    id = snapPrepared([red, green, blue], prepared).id;
    remembered[colour] = id;
  }
  world.cells[index] = id;
}

/**
 * The zoom at which a tile pixel is a master pixel, taken from the master itself rather than written
 * down: 256 tile pixels times two to the zoom is the width of the world. Cutting further would only
 * stretch what is already there; cutting less would throw away detail somebody painted.
 */
const nativeZoom = Math.round(Math.log2(decoded.width / TILE_SIZE));
const maxZoom = flag('zoom') === undefined ? nativeZoom : Number(flag('zoom'));

console.log(
  `read ${decoded.width} by ${decoded.height}, detail running out at zoom ${nativeZoom}; ` +
    `cutting ${tileCount(maxZoom)} tiles`,
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

console.log(`\n${written} tiles, ${(bytes / 1048576).toFixed(1)} MB, ${TILE_SIZE} pixels square`);
console.log(`average ${(bytes / written / 1024).toFixed(1)} kB a tile`);
console.log(`into ${outputDir}`);
