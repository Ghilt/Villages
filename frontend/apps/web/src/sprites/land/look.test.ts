import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { DRAWN } from './landMask';
import { LAND_LOOK, lookOf, motionOf } from './look';

/** Every kind of land, by name, as `world/palette.json` lists them. */
const KINDS = (
  JSON.parse(readFileSync(new URL('../../../../../../world/palette.json', import.meta.url), 'utf8')) as {
    classes: { name: string }[];
  }
).classes.map((kind) => kind.name);

describe('the land', () => {
  it('says what moves on every kind of land, or that it stands still on purpose, and names no kind there is not', () => {
    // A kind added to world/palette.json fails this until it is given its motion, or none.
    expect(KINDS.filter((kind) => motionOf(kind) === null)).toEqual([]);
    expect(Object.keys(LAND_LOOK.lands).filter((kind) => !KINDS.includes(kind))).toEqual([]);
  });

  it('sways the grass on the grassland, as it did before it was the land', () => {
    const grass = KINDS.filter((kind) => motionOf(kind) === 'grass');
    expect(grass.sort()).toEqual(['alpine-meadow', 'meadow', 'savanna', 'steppe']);
    expect(DRAWN).toContain('grass');
  });

  it('stands crops on the farmland, with woods and without', () => {
    expect(KINDS.filter((kind) => motionOf(kind) === 'crops').sort()).toEqual([
      'farmland',
      'farmland-with-woods',
    ]);
    expect(DRAWN).toContain('crops');
  });

  it('stirs the heath, the scrub and the tundra, each in a look of its own', () => {
    const heath = KINDS.filter((kind) => motionOf(kind) === 'heath').sort();
    expect(heath).toEqual(['heath', 'scrub', 'tundra']);
    // A kind of land the heath's motion takes, with no look of its own, fails here rather than drawing as another.
    expect(Object.keys(LAND_LOOK.heath.kinds).sort()).toEqual(heath);
    expect(new Set(heath.map(lookOf)).size).toBe(heath.length);
    expect(lookOf('meadow')).toBe(0);
    expect(DRAWN).toContain('heath');
  });

  it('leaves the water to the water shader, the woods to their trees and bare stone still', () => {
    expect(KINDS.filter((kind) => motionOf(kind) === 'water').sort()).toEqual([
      'lake',
      'ocean',
      'river',
      'shallow-sea',
    ]);
    expect(KINDS.filter((kind) => motionOf(kind) === 'still').sort()).toEqual(['bare-rock', 'desert-stone']);
    expect(DRAWN.filter((motion) => ['water', 'trees', 'still'].includes(motion))).toEqual([]);
  });
});
