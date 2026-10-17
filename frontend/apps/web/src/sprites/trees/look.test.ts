import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { LAND_LOOK } from '../land/look';
import { TREES_LOOK, tintOf } from './look';

/** The kinds of scenery the sprite map grows, by name, as `world/biomes.json` lists them. */
const KINDS = (
  JSON.parse(readFileSync(new URL('../../../../../../world/biomes.json', import.meta.url), 'utf8')) as {
    kinds: { name: string }[];
  }
).kinds.map((kind) => kind.name);

describe('the trees in the wind', () => {
  it('says what every kind of scenery does in the wind, and names no kind there is not', () => {
    // A kind added to world/biomes.json - a mountain - fails this until it is given its numbers, still or not.
    expect(KINDS.filter((kind) => TREES_LOOK.kinds[kind] === undefined)).toEqual([]);
    expect(Object.keys(TREES_LOOK.kinds).filter((kind) => !KINDS.includes(kind))).toEqual([]);
  });

  it('carries how a kind bends in its tint: red how far, green how much its crown pales', () => {
    const birch = tintOf('birch');
    expect(birch >> 16).toBe(255);
    expect((birch >> 8) & 0xff).toBe(Math.round(0.9 * 255));
    expect(birch & 0xff).toBe(255);
    expect(tintOf('boulder')).toBe(0x0000ff);
  });

  it('stands a kind it does not name still', () => {
    expect(tintOf('mountain')).toBe(0x0000ff);
  });

  it('sways on its own in a rhythm that comes round with the hour of the wall clock', () => {
    // Anything that sways back and forth by `windTime` jumps once an hour unless its turns an hour are whole.
    expect(Number.isInteger(TREES_LOOK.idleSpeed * 3600)).toBe(true);
    expect(Number.isInteger(LAND_LOOK.grass.blades.swaySpeed * 3600)).toBe(true);
  });
});
