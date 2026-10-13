import { readdirSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { BiomeFile } from './biome.ts';
import { MARK_NAMES, placeholderKinds } from './placeholderArt.ts';

/**
 * The rules `world/sprites/` is held to, by reading the folder itself. It is Adam's: he saves pictures
 * over the placeholders by hand, and `npm run world:art` refuses to cut a folder that breaks these, so a
 * broken folder is said here rather than by a map with no trees on it. See decision record 0059.
 */
const SPRITES = new URL('../../../../world/sprites/', import.meta.url);
const BIOMES = new URL('../../../../world/biomes.json', import.meta.url);

const PICTURES = new Set(['.png', '.webp', '.jpg', '.jpeg']);

const kinds = (JSON.parse(readFileSync(BIOMES, 'utf8')) as BiomeFile).kinds.map((kind) => kind.name);

/** The sprite names in one group's folder, one entry per picture, so a name twice is seen twice. */
function namesIn(group: string): string[] {
  return readdirSync(fileURLToPath(new URL(`${group}/`, SPRITES)))
    .filter((file) => PICTURES.has(extname(file).toLowerCase()))
    .map((file) => file.slice(0, -extname(file).length));
}

describe("the sprites folder, which is Adam's", () => {
  it('holds every picture drawn on the map, a folder a group, and the record of placeholders', () => {
    expect(readdirSync(fileURLToPath(SPRITES)).sort()).toEqual([
      'marks',
      'placeholders.json',
      'scenery',
      'structures',
    ]);
  });

  it('holds exactly one picture for every kind in world/biomes.json', () => {
    const names = namesIn('scenery');
    for (const kind of kinds) {
      expect(
        names.filter((name) => name === kind),
        kind,
      ).toHaveLength(1);
    }
  });

  it('holds exactly one picture for every mark the map places', () => {
    const names = namesIn('marks');
    for (const mark of MARK_NAMES) {
      expect(
        names.filter((name) => name === mark),
        mark,
      ).toHaveLength(1);
    }
  });

  it('has a placeholder drawing for every kind, so deleting a picture always has one to come back to', () => {
    for (const kind of kinds) {
      expect(placeholderKinds(), kind).toContain(kind);
    }
  });

  it('records placeholders only for files that are in the folder', () => {
    const recorded = JSON.parse(readFileSync(new URL('placeholders.json', SPRITES), 'utf8')) as Record<
      string,
      string
    >;
    const there = new Set(
      ['scenery', 'marks'].flatMap((group) =>
        readdirSync(fileURLToPath(new URL(`${group}/`, SPRITES))).map((file) => `${group}/${file}`),
      ),
    );
    for (const file of Object.keys(recorded)) {
      expect(there.has(file), file).toBe(true);
    }
  });
});
