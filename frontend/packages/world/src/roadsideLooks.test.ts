import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { BRIDGE_WAYS } from './bridgeModel.ts';
import { renderModel } from './modelRender.ts';
import { ROADSIDE, keyOfRoadsideFile, roadsideOf, wallFile, wallKey } from './roadsideLooks.ts';
import { WALL_LENGTH, WALL_STYLES, wallModel, wallTopAt } from './wallModel.ts';

const biomes = JSON.parse(
  readFileSync(new URL('../../../../world/biomes.json', import.meta.url), 'utf8'),
) as {
  biomes: { name: string }[];
  kinds: { name: string; groundHeight: number }[];
};

describe('the roadside', () => {
  it('has a look for every biome, its growth only the small kinds the scenery has', () => {
    // Small: no taller than scrub, the tallest of the growth under the trees.
    const small = new Set(biomes.kinds.filter((kind) => kind.groundHeight <= 2).map((kind) => kind.name));
    for (const { name } of biomes.biomes) {
      const look = roadsideOf(name);
      expect(ROADSIDE[name], name).toBeDefined();
      expect(look.walled, name).toBeGreaterThanOrEqual(0);
      expect(look.walled, name).toBeLessThanOrEqual(1);
      if (look.wall === null) expect(look.walled, name).toBe(0);
      for (const kind of Object.keys(look.growth)) expect(small.has(kind), `${kind} in ${name}`).toBe(true);
    }
  });

  it('names its walls by their files and their files by their keys', () => {
    for (const style of WALL_STYLES) {
      for (const way of BRIDGE_WAYS)
        expect(keyOfRoadsideFile(wallFile(style, way))).toBe(wallKey(style, way));
    }
    expect(keyOfRoadsideFile('wall-mossy-uu.png')).toBeNull();
    expect(keyOfRoadsideFile('placeholders.json')).toBeNull();
  });
});

describe('a stub of wall', () => {
  it('runs its whole length and stands about a third of a unit, low enough to be a roadside wall', () => {
    for (const style of WALL_STYLES) {
      const along = wallModel(style).triangles.flatMap(({ at }) => at.map(([s]) => s));
      expect(Math.min(...along)).toBeCloseTo(-WALL_LENGTH / 2, 9);
      expect(Math.max(...along)).toBeCloseTo(WALL_LENGTH / 2, 9);
    }
    for (let s = -0.5; s <= 0.5; s += 0.05) {
      expect(wallTopAt(s)).toBeGreaterThan(0.2);
      expect(wallTopAt(s)).toBeLessThan(0.35);
    }
  });

  it('stands on the middle of its picture along every way, mossy green on top or bare', () => {
    for (const way of BRIDGE_WAYS) {
      const mossy = renderModel(wallModel('mossy'), way, 40, 1);
      const bare = renderModel(wallModel('bare'), way, 40, 1);
      const at = (picture: typeof mossy, x: number, y: number) =>
        picture.data.subarray((y * picture.width + x) * 4, (y * picture.width + x) * 4 + 4);
      // Just above the middle, the top of the wall: green where it is mossy, never where it is bare.
      const y = Math.round(mossy.height / 2 - wallTopAt(0) * Math.SQRT1_2 * 40) - 1;
      const [red, green, , alpha] = at(mossy, mossy.width / 2, y);
      expect(alpha, way).toBe(255);
      expect(green!, way).toBeGreaterThan(red!);
      const [bareRed, bareGreen] = at(bare, bare.width / 2, y);
      expect(bareRed!, way).toBeGreaterThanOrEqual(bareGreen!);
    }
  });
});
