import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import { originOf } from '../src/origin.ts';
import { ORIGIN_CLONE, ORIGIN_EARTH, ORIGIN_INVENTED, ORIGIN_SEA, encodeOrigin } from '../src/originFile.ts';
import type { OriginFile } from '../src/originFile.ts';
import { originPicture } from '../src/originPicture.ts';
import type { Palette } from '../src/palette.ts';
import { encodeRgbPng } from '../src/png.ts';
import { DEFAULT_MASTER, masterNameOf, worldDirOf } from '../src/masters.ts';

import { writeNames } from './lib/earthNames.ts';
import { flag, named } from './lib/flags.ts';
import { readMaster } from './lib/master.ts';
import { OUTPUT_DIR, PALETTE, masterAt } from './lib/paths.ts';

/**
 * A master's origin map: where on Earth every square of it was cut from, or that it was invented.
 *
 *   node bin/originWorld.ts [master] [--from terrain-base] [--side 4096]
 *
 * Reads the master and plain Earth's master it was edited from, works the map out (`src/origin.ts`), and
 * writes `origin.bin` and `origin.json` beside the master's tiles, with `origin.png`, the map drawn over the
 * world square for the Origin renderer. Then it carries Earth's named rivers, lakes and peaks through it into
 * `names.json`, as `world:names` does. Two minutes a master. See `docs/plans/real-world-names.md`.
 */

const masterPath = masterAt(named[0]);
const master = masterNameOf(basename(masterPath)) ?? DEFAULT_MASTER;
const from = flag('from') ?? 'terrain-base';
const side = Number(flag('side') ?? 4096);
const outputDir = resolve(OUTPUT_DIR, worldDirOf(master), 'origin');
const started = Date.now();
const seconds = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;
const say = (line: string) => console.log(`[${seconds()}] ${line}`);

const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette;
const idOf = (name: string) => palette.classes.find((one) => one.name === name)!.id;
const sea = new Set([idOf('ocean'), idOf('shallow-sea')]);

const edited = readMaster(masterPath, palette);
const base = readMaster(masterAt(from), palette);
say(`read ${master} and ${from}, ${edited.width} by ${edited.height}`);

const origin = originOf(edited, base, { sea, lake: idOf('lake'), log: say });

const counts = { sea: 0, earth: 0, invented: 0, clone: 0 };
for (const status of origin.status) {
  if (status === ORIGIN_SEA) counts.sea += 1;
  if (status === ORIGIN_EARTH) counts.earth += 1;
  if (status === ORIGIN_INVENTED) counts.invented += 1;
  if (status === ORIGIN_CLONE) counts.clone += 1;
}
const file: OriginFile & { $comment: string } = {
  $comment: 'Written by npm run world:origin. Output: worked out again from the master, never edited.',
  master,
  from,
  cell: origin.cell,
  columns: origin.columns,
  rows: origin.rows,
  width: edited.width,
  height: edited.height,
  counts,
};

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'origin.bin'), encodeOrigin(origin));
const picture = originPicture(origin, edited, base, sea, side);
await writeFile(
  resolve(outputDir, 'origin.png'),
  encodeRgbPng(picture, (raw) => deflateSync(raw, { level: 6 })),
);
// Last, so that when it was written is when the origin map was finished: the debug panel and the quick start
// read its time to tell an origin map older than the master.
await writeFile(resolve(outputDir, 'origin.json'), `${JSON.stringify(file, null, 2)}\n`);

const land = counts.earth + counts.invented + counts.clone;
const share = (part: number) => `${((100 * part) / Math.max(1, land)).toFixed(1)}%`;
say(
  `the origin of ${master}: ${share(counts.earth)} of its land from Earth, ${share(counts.invented)} invented, ` +
    `${share(counts.clone)} copies, in squares of ${origin.cell} pixels, to ${outputDir}`,
);
say(await writeNames(master, resolve(OUTPUT_DIR, worldDirOf(master)), origin, edited.width, edited.height));
