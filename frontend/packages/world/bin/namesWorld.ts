import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { DEFAULT_MASTER, masterNameOf, worldDirOf } from '../src/masters.ts';
import { decodeOrigin } from '../src/originFile.ts';
import type { OriginFile } from '../src/originFile.ts';

import { writeNames } from './lib/earthNames.ts';
import { named } from './lib/flags.ts';
import { writtenAt } from './lib/outputs.ts';
import { OUTPUT_DIR, masterAt } from './lib/paths.ts';

/**
 * Earth's named rivers, lakes and peaks, carried into a master's world through the origin map it has.
 *
 *   node bin/namesWorld.ts [master]
 *
 * `world:origin` already does this after working the map out; this is for carrying them again without
 * working it out again, which is under a second. Writes `names.json` beside the master's tiles. The names are
 * today's, not yet 1790's. See `bin/lib/earthNames.ts` and `docs/plans/real-world-names.md`.
 */

const master = masterNameOf(basename(masterAt(named[0]))) ?? DEFAULT_MASTER;
const worldDir = resolve(OUTPUT_DIR, worldDirOf(master));
const originDir = resolve(worldDir, 'origin');
const started = Date.now();
if (!existsSync(resolve(originDir, 'origin.json'))) {
  console.error(`${master} has no origin map yet: npm run world:origin --prefix frontend -- ${master}`);
  process.exit(1);
}
const file = JSON.parse(await readFile(resolve(originDir, 'origin.json'), 'utf8')) as OriginFile;
const bytes = await readFile(resolve(originDir, 'origin.bin'));
const grid = decodeOrigin(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), file);
const said = await writeNames(master, writtenAt(worldDir), grid, file.width, file.height);
console.log(`${said}, in ${((Date.now() - started) / 1000).toFixed(1)}s`);
