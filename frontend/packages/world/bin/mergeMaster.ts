import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

import { byId, toRgb } from '../src/palette.ts';
import type { Palette, Rgb } from '../src/palette.ts';
import { encodeIndexedPng } from '../src/png.ts';

import { readMaster } from './lib/master.ts';
import { PALETTE } from './lib/paths.ts';

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
const names = byId(palette);

function classesOf(path: string) {
  const raster = readMaster(path, palette);
  console.log(`read ${raster.width} by ${raster.height} from ${path}`);
  return raster;
}

const before = classesOf(original);
const after = classesOf(edited);
const target = classesOf(fresh);

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
