import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import { CULTURE_NONE, culturesOf, parseCultureAnchors } from '../src/culture.ts';
import type { CultureFile } from '../src/culture.ts';
import { DEFAULT_MASTER, masterNameOf, worldDirOf } from '../src/masters.ts';
import { decodeOrigin } from '../src/originFile.ts';
import type { OriginFile } from '../src/originFile.ts';
import { encodeRgbPng } from '../src/png.ts';
import { CULTURES } from '../src/structures.ts';
import type { Culture } from '../src/structures.ts';
import { masterRowsAt } from '../src/tiles.ts';

import { flag, named } from './lib/flags.ts';
import { ownFolder, writtenAt } from './lib/outputs.ts';
import { CULTURES_FILE, OUTPUT_DIR, masterAt } from './lib/paths.ts';

/**
 * A master's culture map: the building tradition every square of its land is drawn in.
 *
 *   node bin/cultureWorld.ts [master] [--side 2048]
 *
 * Reads the master's origin map, written by `world:origin`, and the anchors in `world/cultures.json`, works the map
 * out (`src/culture.ts`), and writes `culture.bin` and `culture.json` beside the master's tiles, with `culture.png`,
 * the map drawn over the world square for the Culture renderer. Seconds a master. It prints how much of the land is
 * of each culture: the numbers to report. See docs/plans/structures.md.
 */

const master = masterNameOf(basename(masterAt(named[0]))) ?? DEFAULT_MASTER;
const side = Number(flag('side') ?? 2048);
const worldDir = resolve(OUTPUT_DIR, worldDirOf(master));
const started = Date.now();
const say = (line: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${line}`);

const originFile = JSON.parse(
  await readFile(resolve(worldDir, 'origin', 'origin.json'), 'utf8'),
) as OriginFile;
const bytes = await readFile(resolve(worldDir, 'origin', 'origin.bin'));
const origin = decodeOrigin(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  originFile,
);
const anchors = parseCultureAnchors(await readFile(CULTURES_FILE, 'utf8'));
say(
  `read ${master}'s origin map, ${origin.columns} by ${origin.rows} squares, and ${anchors.length} anchors`,
);

const cultures = culturesOf(origin, originFile.width, originFile.height, anchors);
const counts = Object.fromEntries(CULTURES.map((one) => [one, 0])) as Record<Culture, number>;
for (const byte of cultures) {
  if (byte !== CULTURE_NONE) counts[CULTURES[byte]!] += 1;
}

/** Each culture's colour in the picture, a flat wash; sea is dark. */
const COLOURS: Record<Culture, [number, number, number]> = {
  european: [74, 112, 176],
  islamic: [62, 150, 96],
  eastAsian: [196, 64, 52],
  african: [214, 160, 58],
};
const SEA: [number, number, number] = [20, 35, 44];
const pixels = new Uint8Array(side * side * 3);
const rows = masterRowsAt(side, originFile.height);
for (let py = 0; py < side; py += 1) {
  const my = rows[py]!;
  for (let px = 0; px < side; px += 1) {
    const mx = Math.min(originFile.width - 1, Math.floor(((px + 0.5) * originFile.width) / side));
    const byte = cultures[Math.floor(my / origin.cell) * origin.columns + Math.floor(mx / origin.cell)]!;
    pixels.set(byte === CULTURE_NONE ? SEA : COLOURS[CULTURES[byte]!], (py * side + px) * 3);
  }
}

const file: CultureFile & { $comment: string } = {
  $comment:
    'Written by npm run world:culture. Output: worked out again from the origin map and world/cultures.json, never edited.',
  master,
  cell: origin.cell,
  columns: origin.columns,
  rows: origin.rows,
  width: originFile.width,
  height: originFile.height,
  counts,
};
const outputDir = writtenAt(resolve(worldDir, 'culture'));
ownFolder(outputDir, 'the culture map');
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'culture.bin'), cultures);
await writeFile(
  resolve(outputDir, 'culture.png'),
  encodeRgbPng({ width: side, height: side, pixels }, (raw) => deflateSync(raw, { level: 6 })),
);
// Last, so that when it was written is when the culture map was finished: the quick start reads its time.
await writeFile(resolve(outputDir, 'culture.json'), `${JSON.stringify(file, null, 2)}\n`);

const land = Math.max(
  1,
  Object.values(counts).reduce((sum, n) => sum + n, 0),
);
say(
  `${master}: ${CULTURES.map((one) => `${one} ${((100 * counts[one]) / land).toFixed(1)}%`).join(', ')} of its land`,
);
