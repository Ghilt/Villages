import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { COAST, GROUND_CELL, LAKE, RIVER, SEA, groundOf } from '../src/ground.ts';
import type { Palette } from '../src/palette.ts';
import { DEFAULT_MASTER, masterNameOf } from '../src/masters.ts';

import { named } from './lib/flags.ts';
import { readMaster } from './lib/master.ts';
import { GROUND_DIR, PALETTE, masterAt } from './lib/paths.ts';

/**
 * A master's ground map, for the game server to read where a player is looking.
 *
 *   node bin/groundWorld.ts [master]
 *
 * Reads the master and writes `world/ground/<master>/ground.bin`, two bytes a cell, and `ground.json` beside it
 * saying how big the grid is, what each class number is called and what each mark means. Seconds a master. See
 * `src/ground.ts` and decision record 0084.
 */

const masterPath = masterAt(named[0]);
const master = masterNameOf(basename(masterPath)) ?? DEFAULT_MASTER;
const outputDir = resolve(GROUND_DIR, master);
const started = Date.now();

const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette;
const idsOf = (...names: string[]) =>
  new Set(palette.classes.filter((one) => names.includes(one.name)).map((one) => one.id));

const world = readMaster(masterPath, palette);
const ground = groundOf(world, {
  sea: idsOf('ocean', 'shallow-sea'),
  lake: idsOf('lake'),
  river: idsOf('river'),
});

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'ground.bin'), ground.cells);
await writeFile(
  resolve(outputDir, 'ground.json'),
  `${JSON.stringify(
    {
      $comment:
        'Written by npm run world:ground. Output: cut again from the master, never edited. See decision 0084.',
      master,
      width: ground.width,
      height: ground.height,
      cellPixels: GROUND_CELL,
      classes: Object.fromEntries(palette.classes.map((one) => [one.id, one.name])),
      marks: { river: RIVER, coast: COAST, lake: LAKE, sea: SEA },
    },
    null,
    2,
  )}\n`,
);

let rivers = 0;
let coast = 0;
for (let at = 1; at < ground.cells.length; at += 2) {
  if ((ground.cells[at]! & RIVER) !== 0) rivers += 1;
  if ((ground.cells[at]! & COAST) !== 0) coast += 1;
}
console.log(
  `the ground of ${master}: ${ground.width} by ${ground.height} cells of ${GROUND_CELL} pixels, ` +
    `${rivers.toLocaleString()} with a river and ${coast.toLocaleString()} on a coast, ` +
    `in ${((Date.now() - started) / 1000).toFixed(1)}s, to ${outputDir}`,
);
