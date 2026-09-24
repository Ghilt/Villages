/**
 * Draws the placeholder portraits into `world/portraits/`: six women and six men, cut-paper silhouettes of
 * the period, each named for whom it suits.
 *
 * **It never overwrites a file that is already there.** The folder is Adam's, and a picture he has saved
 * over a placeholder stays his. Delete a picture and run this again to have its placeholder back.
 *
 *     npm run world:portraits --prefix frontend
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import { encodeRgbPng } from '../src/png.ts';
import { drawSilhouette } from '../src/portrait.ts';
import type { Sitter } from '../src/portrait.ts';
import { PORTRAITS_DIR } from './paths.ts';

/** How many of each are drawn: enough that a full house of nine does not look like one family of twins. */
const EACH = 6;
const SITTERS: readonly Sitter[] = ['woman', 'man'];

const deflate = (data: Uint8Array) => new Uint8Array(deflateSync(data, { level: 9 }));

mkdirSync(PORTRAITS_DIR, { recursive: true });

let drawn = 0;
let kept = 0;
for (const sitter of SITTERS) {
  for (let number = 1; number <= EACH; number += 1) {
    const key = `${sitter}-${String(number).padStart(2, '0')}`;
    const path = resolve(PORTRAITS_DIR, `${key}.png`);
    if (existsSync(path)) {
      kept += 1;
      console.log(`kept  ${key}.png, which is there already and is never drawn over`);
      continue;
    }
    writeFileSync(path, encodeRgbPng(drawSilhouette(sitter, number), deflate));
    drawn += 1;
    console.log(`drew  ${key}.png`);
  }
}

console.log(`\n${drawn} drawn and ${kept} kept, in ${PORTRAITS_DIR}`);
