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

  it('gives the wet land its water, its stems and its mist, each kind in a look of its own', () => {
    const wet = KINDS.filter((kind) => motionOf(kind) === 'wet').sort();
    expect(wet).toEqual(['bog', 'floodplain', 'mangrove', 'marsh', 'paddy', 'swamp-forest']);
    expect(Object.keys(LAND_LOOK.wet.kinds).sort()).toEqual(wet);
    expect(new Set(wet.map(lookOf)).size).toBe(wet.length);
    // The paddy is a sheet of water with its shoots in rows; mist lies over the marsh and the bog.
    expect(LAND_LOOK.wet.kinds.paddy.rows).toBe(1);
    expect(LAND_LOOK.wet.kinds.marsh.mist).toBeGreaterThan(0);
    expect(LAND_LOOK.wet.kinds.bog.mist).toBeGreaterThan(0);
    expect(DRAWN).toContain('wet');
  });

  it('glints on the ice and the salt and drifts over the ice and the sand, each kind in a look of its own', () => {
    const icy = KINDS.filter((kind) => motionOf(kind) === 'ice-salt-sand').sort();
    expect(icy).toEqual(['desert-sand', 'ice', 'polar-desert', 'salt-flat']);
    expect(Object.keys(LAND_LOOK.ice.kinds).sort()).toEqual(icy);
    expect(new Set(icy.map(lookOf)).size).toBe(icy.length);
    expect(LAND_LOOK.ice.kinds['salt-flat'].glints).toBeGreaterThan(0);
    expect(LAND_LOOK.ice.kinds['desert-sand'].crests).toBe(1);
  });

  it('draws every kind of land that moves, so every kind has its motion or stands still on purpose', () => {
    const moving = KINDS.map(motionOf).filter(
      (motion) => !['water', 'trees', 'still'].includes(motion ?? ''),
    );
    expect(
      [...new Set(moving)].filter((motion) => !(DRAWN as readonly (string | null)[]).includes(motion)),
    ).toEqual([]);
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
