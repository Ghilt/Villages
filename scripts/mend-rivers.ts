import { existsSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { masterColours, readMaster, readPalette, writeIndexed } from './lib/master.ts';
import type { ClassRaster, Rgb } from './lib/master.ts';
import { RIVER, mendRivers, nearestSeaWater } from './lib/mendRivers.ts';

const HELP = `
mend-rivers - join a master's broken rivers to the sea

  node mend-rivers.ts <master.png> [--max-gap 8] [--out <folder>]

Rivers break up: two pieces that meet only at a corner, or stop a few pixels short of each
other. This paints the fewest land pixels it can to river so that every river runs to the sea
side to side, never corner to corner. It changes only land, and only to river. A lake on the
way is used as a stepping stone; a lake no river needs is never joined to anything.

  <master.png>      the master to mend. Only read, never written.
  --max-gap <px>    the longest gap it bridges, in pixels. Default 8. Rivers further than that
                    from the sea are left as they are and listed, because most of them really do
                    end inland.
  --out <folder>    where to write. Default: the folder you are in.
  --help            this.

It writes two files, dated today, into the folder you are in or --out, and lists them at the end:

  <name>_mended_<date>.png        the mended master, a world like any other
  <name>_mended_audit_<date>.png  land grey, water as painted, every pixel it painted red,
                                  and the rivers it left cut off orange

and prints how many river pieces reach the sea before and after, the longest bridges, and the
twenty largest rivers still cut off, each with how far it is from water that reaches the sea.
About two minutes for a 32768 by 16384 master. Run it again on its own output and it paints
nothing.

  node mend-rivers.ts ..\\world\\master\\terrain3.png
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'max-gap': { type: 'string', default: '8' },
    out: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});
const [input] = positionals;
if (values.help || input === undefined) {
  console.log(HELP);
  process.exit(0);
}
const maxGap = Number(values['max-gap']);

const source = resolve(input);
if (!existsSync(source)) {
  console.error(`there is no ${source}`);
  process.exit(1);
}
const day = new Date();
const date = [day.getFullYear(), day.getMonth() + 1, day.getDate()]
  .map((part) => String(part).padStart(2, '0'))
  .join('-');
const name = basename(source, extname(source));
const folder = resolve(values.out ?? process.cwd());
const mendedPath = join(folder, `${name}_mended_${date}.png`);
const auditPath = join(folder, `${name}_mended_audit_${date}.png`);
if (mendedPath === source || auditPath === source) {
  throw new Error(`${source} would be written over; rename it first`);
}

const classes = readPalette();
const started = Date.now();
const seconds = () => `${((Date.now() - started) / 1000).toFixed(0)} s`;

const { raster: world, offColour } = await readMaster(source, classes);
console.log(`read ${world.width} by ${world.height} from ${source} (${seconds()})`);
if (offColour > 0) {
  console.log(
    `  ${offColour} pixels were not painted in a class's own colour, and were read as the nearest one`,
  );
}

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
  if (world.cells[at]! <= RIVER) {
    throw new Error(`pixel ${at} was water and was painted; nothing is written`);
  }
  mended.cells[at] = RIVER;
}
console.log('\nthe largest rivers still cut off from the sea, and the nearest water that reaches it:');
for (const system of report.stranded.slice(0, 20)) {
  const nearest = nearestSeaWater(mended, report.strandedPixels, system.at, 1000);
  const gap = nearest === null ? 'none within 1000 px' : `${nearest.gap} px away at ${where(nearest.at)}`;
  console.log(`  ${String(system.riverPixels).padStart(7)} px   ${where(system.at)}   ${gap}`);
}

const LAND = RIVER + 1;
const PAINTED = LAND + 1;
const STRANDED = PAINTED + 1;
const audit: ClassRaster = {
  width: world.width,
  height: world.height,
  cells: new Uint8Array(world.cells.length),
};
for (let at = 0; at < world.cells.length; at += 1) {
  const terrain = world.cells[at]!;
  audit.cells[at] = terrain <= RIVER ? terrain : LAND;
}
for (const at of report.strandedPixels) {
  audit.cells[at] = STRANDED;
}
for (const at of report.painted) {
  audit.cells[at] = PAINTED;
}

console.log('');
const colours = masterColours(classes);
const auditColours: Rgb[] = [...colours.slice(0, LAND), [180, 180, 180], [255, 0, 0], [255, 140, 0]];
const written: string[] = [];
for (const [path, raster, table, what] of [
  [mendedPath, mended, colours, 'the mended master, a world like any other'],
  [auditPath, audit, auditColours, 'what was painted, red on grey, and the rivers left cut off, orange'],
] as const) {
  const bytes = await writeIndexed(path, raster, table);
  written.push(`  ${path}\n      ${what}, ${(bytes / 1048576).toFixed(2)} MB`);
}
console.log(`Wrote 2 files, in ${seconds()}:\n\n${written.join('\n')}`);
