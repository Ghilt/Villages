/**
 * Draws the placeholder scenes into `world/scenes/`: one for every scene the server's sample dialogues name,
 * in cut paper, each named for its scene.
 *
 * **It never overwrites a file that is already there.** The folder is Adam's, and a picture he has saved
 * over a placeholder stays his. Delete a picture and run this again to have its placeholder back.
 *
 *     npm run world:scenes --prefix frontend
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import { encodeRgbPng } from '../src/png.ts';
import { drawScene, SCENES } from '../src/scene.ts';
import { SCENES_DIR } from './lib/paths.ts';

const deflate = (data: Uint8Array) => new Uint8Array(deflateSync(data, { level: 9 }));

mkdirSync(SCENES_DIR, { recursive: true });

let drawn = 0;
let kept = 0;
for (const key of SCENES) {
  const path = resolve(SCENES_DIR, `${key}.png`);
  if (existsSync(path)) {
    kept += 1;
    console.log(`kept  ${key}.png, which is there already and is never drawn over`);
    continue;
  }
  writeFileSync(path, encodeRgbPng(drawScene(key), deflate));
  drawn += 1;
  console.log(`drew  ${key}.png`);
}

console.log(`\n${drawn} drawn and ${kept} kept, in ${SCENES_DIR}`);
