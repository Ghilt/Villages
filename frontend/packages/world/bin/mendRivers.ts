import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import { RIVER, mendRivers, nearestSeaWater } from '../src/mendRivers.ts';
import { byId, toRgb } from '../src/palette.ts';
import type { Palette, Rgb } from '../src/palette.ts';
import { encodeIndexedPng } from '../src/png.ts';
import type { ClassRaster } from '../src/raster.ts';

import { flag, named } from './lib/flags.ts';
import { readMaster } from './lib/master.ts';
import { PALETTE } from './lib/paths.ts';

/**
 * Mends the breaks in a master's rivers, so that every river runs side to side, never corner to corner, all
 * the way to the sea. Only land is painted, only to river, and as little of it as joins the pieces.
 *
 *   node bin/mendRivers.ts <master.png> [--max-gap 8]
 *
 * Writes `<name>_mended_<date>.png` beside the master, which is a master, and `<name>_mended_audit_<date>.png`,
 * which is not: land grey, water as painted, every pixel the tool painted red, and the rivers it could not
 * take to the sea within the limit orange. The master itself is only read.
 */

const [input] = named;
if (input === undefined) {
  console.error('usage: node bin/mendRivers.ts <master.png> [--max-gap 8]');
  console.error(
    '  --max-gap  the longest gap bridged, in pixels; rivers further from the sea are left and listed',
  );
  process.exit(2);
}
const maxGap = Number(flag('max-gap') ?? 8);

const source = resolve(input);
const day = new Date();
const date = [day.getFullYear(), day.getMonth() + 1, day.getDate()]
  .map((part) => String(part).padStart(2, '0'))
  .join('-');
const name = basename(source, extname(source));
const mendedPath = join(dirname(source), `${name}_mended_${date}.png`);
const auditPath = join(dirname(source), `${name}_mended_audit_${date}.png`);
if (mendedPath === source || auditPath === source) {
  throw new Error(`${source} would be written over; rename it first`);
}

const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette;
const started = Date.now();
const seconds = () => `${((Date.now() - started) / 1000).toFixed(0)} s`;

const world = readMaster(source, palette);
console.log(`read ${world.width} by ${world.height} from ${source} (${seconds()})`);

const report = mendRivers(world, { maxGap });
console.log(`mended in ${report.passes} passes, bridging gaps up to ${maxGap} pixels (${seconds()})\n`);

const where = (index: number) => {
  const x = index % world.width;
  const y = Math.floor(index / world.width);
  const lng = ((x + 0.5) / world.width) * 360 - 180;
  const lat = 90 - ((y + 0.5) / world.height) * 180;
  return `x ${String(x).padStart(5)} y ${String(y).padStart(5)}   ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
};

console.log(`river pieces                  ${report.riverPieces}`);
console.log(`  reaching the sea, before    ${report.riverPiecesAtSeaBefore}`);
console.log(`  reaching the sea, after     ${report.riverPiecesAtSeaAfter}`);
console.log(`pixels painted to river       ${report.painted.length}`);
console.log(`bridges                       ${report.bridges.length}`);
const lengths = new Map<number, number>();
for (const bridge of report.bridges) {
  lengths.set(bridge.cost, (lengths.get(bridge.cost) ?? 0) + 1);
}
for (const [cost, count] of [...lengths.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${String(cost).padStart(3)} px  ${String(count).padStart(8)}`);
}
console.log(
  `rivers left cut off           ${report.stranded.length}, ${report.strandedPixels.length} river pixels`,
);

console.log('\nthe longest bridges, to look at first:');
for (const bridge of [...report.bridges].sort((a, b) => b.cost - a.cost).slice(0, 20)) {
  console.log(`  ${String(bridge.cost).padStart(3)} px   ${where(bridge.at)}`);
}
const mended: ClassRaster = { ...world, cells: world.cells.slice() };
for (const at of report.painted) {
  mended.cells[at] = RIVER;
}
console.log('\nthe largest rivers still cut off from the sea, and the nearest water that reaches it:');
for (const system of report.stranded.slice(0, 20)) {
  const nearest = nearestSeaWater(mended, report.strandedPixels, system.at, 1000);
  const gap = nearest === null ? 'none within 1000 px' : `${nearest.gap} px away at ${where(nearest.at)}`;
  console.log(`  ${String(system.riverPixels).padStart(7)} px   ${where(system.at)}   ${gap}`);
}

const index = byId(palette);
const colours: Rgb[] = [];
for (let id = 0; id <= Math.max(...palette.classes.map((terrain) => terrain.id)); id += 1) {
  colours.push(toRgb(index.get(id)?.colour ?? '#ff00ff'));
}
const deflate = (data: Uint8Array) => new Uint8Array(deflateSync(data, { level: 9 }));

async function write(path: string, raster: ClassRaster, table: readonly Rgb[]) {
  const png = encodeIndexedPng(raster, table, deflate);
  await writeFile(path, png);
  console.log(`${(png.length / 1048576).toFixed(2)} MB written to ${path} (${seconds()})`);
}

const audit: ClassRaster = {
  width: world.width,
  height: world.height,
  cells: new Uint8Array(world.cells.length),
};
const LAND = RIVER + 1;
const PAINTED = LAND + 1;
const STRANDED = PAINTED + 1;
for (let at = 0; at < world.cells.length; at += 1) {
  const terrain = world.cells[at]!;
  audit.cells[at] = terrain <= RIVER ? terrain : LAND;
}
for (const at of report.strandedPixels) {
  audit.cells[at] = STRANDED;
}
for (const at of report.painted) {
  if (world.cells[at]! <= RIVER) {
    throw new Error(`pixel ${at} was water and was painted; nothing is written`);
  }
  world.cells[at] = RIVER;
  audit.cells[at] = PAINTED;
}

console.log('');
await write(mendedPath, world, colours);
await write(auditPath, audit, [...colours.slice(0, LAND), [180, 180, 180], [255, 0, 0], [255, 140, 0]]);
