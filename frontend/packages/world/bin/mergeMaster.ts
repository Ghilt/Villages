import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

import { PNG } from 'pngjs';

import { byId, preparePalette, snapPrepared, toRgb } from '../src/palette.ts';
import type { Palette, Rgb } from '../src/palette.ts';
import { createRaster } from '../src/raster.ts';
import { encodeIndexedPng } from '../src/png.ts';

import { PALETTE } from './paths.ts';

/**
 * Replays hand edits onto a freshly built master.
 *
 * The master build improves from time to time, and rebuilding it would throw away everything painted by
 * hand since. This compares an edited master against the one it was painted on top of, and applies only
 * the pixels that actually differ to a new master. Edits survive; everything untouched comes out clean.
 *
 *   node bin/mergeMaster.ts <original> <edited> <fresh> <out>
 */

const [original, edited, fresh, out] = process.argv.slice(2);
if (original === undefined || edited === undefined || fresh === undefined || out === undefined) {
  console.error('usage: node bin/mergeMaster.ts <original> <edited> <fresh> <out>');
  console.error('  original  the master the edits were painted on top of');
  console.error('  edited    that master after editing');
  console.error('  fresh     a newly built master to carry the edits onto');
  console.error('  out       where to write the result');
  process.exit(2);
}

const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette;
const prepared = preparePalette(palette);
const names = byId(palette);

async function classesOf(path: string) {
  const png = PNG.sync.read(await readFile(path));
  const raster = createRaster(png.width, png.height);
  const remembered = new Int16Array(1 << 24).fill(-1);

  for (let index = 0; index < raster.cells.length; index += 1) {
    const at = index * 4;
    const red = png.data[at]!;
    const green = png.data[at + 1]!;
    const blue = png.data[at + 2]!;
    const colour = (red << 16) | (green << 8) | blue;
    let id = remembered[colour]!;
    if (id < 0) {
      id = snapPrepared([red, green, blue], prepared).id;
      remembered[colour] = id;
    }
    raster.cells[index] = id;
  }

  console.log(`read ${png.width} by ${png.height} from ${path}`);
  return raster;
}

const before = await classesOf(original);
const after = await classesOf(edited);
const target = await classesOf(fresh);

if (before.cells.length !== after.cells.length || after.cells.length !== target.cells.length) {
  throw new Error('the three masters are not the same size, so their pixels cannot be compared');
}

const changes = new Map<string, number>();
let applied = 0;

for (let index = 0; index < after.cells.length; index += 1) {
  const was = before.cells[index]!;
  const is = after.cells[index]!;
  if (was === is) {
    continue;
  }
  target.cells[index] = is;
  applied += 1;
  const label = `${names.get(was)?.name ?? was} to ${names.get(is)?.name ?? is}`;
  changes.set(label, (changes.get(label) ?? 0) + 1);
}

const square = (pixels: number) => `${(pixels * 5.8).toFixed(0)} sq km`;
console.log(`\n${applied} pixels were edited, about ${square(applied)}:`);
for (const [label, count] of [...changes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${label.padEnd(36)} ${String(count).padStart(9)} pixels, ${square(count)}`);
}

const index = byId(palette);
const colours: Rgb[] = [];
for (let id = 0; id <= Math.max(...palette.classes.map((terrain) => terrain.id)); id += 1) {
  colours.push(toRgb(index.get(id)?.colour ?? '#ff00ff'));
}
const png = encodeIndexedPng(target, colours, (data) => new Uint8Array(deflateSync(data, { level: 9 })));
await writeFile(out, png);

console.log(`\n${(png.length / 1048576).toFixed(2)} MB written to ${out}`);
