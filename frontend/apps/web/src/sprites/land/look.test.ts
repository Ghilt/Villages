import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CLUMP_ACROSS, CLUMP_ALONG, CLUMP_ROOM } from './duneShader';
import { DRAWN } from './landMask';
import { LAND_LOOK, UNDERGROWTH_STEPS, lookOf, motionOf, strengthOf } from './look';

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

  it('sways the grass on the grassland and under the woods, where it is their undergrowth', () => {
    const grass = KINDS.filter((kind) => motionOf(kind) === 'grass').sort();
    expect(grass).toEqual([
      'alpine-meadow',
      'broadleaf-forest',
      'conifer-forest',
      'dry-forest',
      'meadow',
      'mixed-forest',
      'rainforest',
      'savanna',
      'steppe',
      'taiga',
      'taiga-open',
    ]);
    expect(Object.keys(LAND_LOOK.grass.woods).sort()).toEqual(grass);
    // The grassland's grass is as it was, written whole in the mask; the woods' is their undergrowth, a little below.
    for (const open of ['steppe', 'meadow', 'savanna', 'alpine-meadow'])
      expect(strengthOf(open), open).toBe(255);
    for (const wood of grass.filter((kind) => kind.includes('forest') || kind.startsWith('taiga'))) {
      expect(strengthOf(wood), wood).toBeLessThan(255);
      expect(strengthOf(wood), wood).toBeGreaterThanOrEqual(255 - UNDERGROWTH_STEPS);
    }
    expect(LAND_LOOK.grass.undergrowth.density).toBeLessThan(1);
    expect(LAND_LOOK.grass.undergrowth.sheen).toBeLessThan(1);
    // Every other motion is written whole.
    expect(strengthOf('heath')).toBe(255);
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
    // A kind whose motion has the one look is nought.
    expect(lookOf('farmland')).toBe(0);
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

  it('glints on the salt, drifts and swirls over the ice, and lies in dunes on the sand, each kind in a look of its own', () => {
    const icy = KINDS.filter((kind) => motionOf(kind) === 'ice-salt-sand').sort();
    expect(icy).toEqual(['desert-sand', 'ice', 'polar-desert', 'salt-flat']);
    expect(Object.keys(LAND_LOOK.ice.kinds).sort()).toEqual(icy);
    expect(new Set(icy.map(lookOf)).size).toBe(icy.length);
    expect(LAND_LOOK.ice.kinds['salt-flat'].glints).toBeGreaterThan(0);
    expect(LAND_LOOK.ice.kinds['desert-sand'].dunes).toBe(1);
    // No stars on the ice, Adam's word of 2026-10-18: its snow swirls instead.
    expect(LAND_LOOK.ice.kinds.ice.glints).toBe(0);
    expect(LAND_LOOK.ice.kinds.ice.swirls).toBeGreaterThan(0);
  });

  it('draws every kind of land that moves, so every kind has its motion or stands still on purpose', () => {
    const moving = KINDS.map(motionOf).filter((motion) => !['water', 'still'].includes(motion ?? ''));
    expect(
      [...new Set(moving)].filter((motion) => !(DRAWN as readonly (string | null)[]).includes(motion)),
    ).toEqual([]);
  });

  it('sways the mist a whole number of times an hour, so it comes round with the clock without a jump', () => {
    expect(3600 % LAND_LOOK.wet.mist.period).toBe(0);
    expect(3600 % LAND_LOOK.wet.pools.shore.period).toBe(0);
  });

  it('flows the sand a whole number of its cells an hour and curls it a whole number of times, so it never jumps', () => {
    const flow = LAND_LOOK.ice.sandFlow;
    expect(Number.isInteger((flow.speed * 3600) / flow.cell)).toBe(true);
    expect(3600 % flow.curl).toBe(0);
  });

  it('fits every clump of dunes inside its own cell, its third dune further off than the other two, and none more than three', () => {
    const D = LAND_LOOK.ice.dunes;
    // A point asks only its own cell, so a clump reaching past it would be cut off, and two clumps could touch.
    expect(CLUMP_ALONG).toBeLessThanOrEqual(CLUMP_ROOM[0]);
    expect(CLUMP_ACROSS).toBeLessThanOrEqual(CLUMP_ROOM[1]);
    expect(D.near[0]).toBeGreaterThan(0);
    expect(D.far[0]).toBeGreaterThan(D.near[1]);
    expect(D.clumps.together).toHaveLength(3);
    expect(D.clumps.together.reduce((sum, one) => sum + one, 0)).toBeCloseTo(1);
  });

  it('lays the animal trails thin, a tuft or so wide, here and there and not everywhere', () => {
    const T = LAND_LOOK.trails;
    // A trail is an absence of a tuft or two across, not a road.
    expect(2 * T.halfWidth).toBeGreaterThanOrEqual(LAND_LOOK.grass.blades.cell);
    expect(2 * T.halfWidth).toBeLessThanOrEqual(2 * LAND_LOOK.grass.blades.cell);
    // At the sliders' one, their patches open where the slow field is above the middle, so some land has trails and
    // most has none; at their most, a little more than all of it may.
    const atOne = T.from - T.by;
    expect(atOne).toBeGreaterThan(0.5);
    expect(atOne + T.soft).toBeLessThan(1);
    expect(T.from).toBeGreaterThanOrEqual(0.9);
    // Far from the line a tuft knows it from the field read about it: the margin is more than the trail is wide.
    expect(T.margin).toBeGreaterThan(T.halfWidth);
  });

  it('leaves the water to the water shader and bare stone still', () => {
    expect(KINDS.filter((kind) => motionOf(kind) === 'water').sort()).toEqual([
      'lake',
      'ocean',
      'river',
      'shallow-sea',
    ]);
    expect(KINDS.filter((kind) => motionOf(kind) === 'still').sort()).toEqual(['bare-rock', 'desert-stone']);
    expect(DRAWN.filter((motion) => ['water', 'still'].includes(motion))).toEqual([]);
  });
});
