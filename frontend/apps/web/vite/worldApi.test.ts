import { relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { OUTPUT_DIR, STANDS_DIR } from '../../../packages/world/bin/lib/paths.ts';
import { WORLD_STEPS } from '../../../packages/world/bin/lib/worldSteps.ts';
import { ERRANDS, asksForStands } from './worldApi.ts';

describe('the stands, which only the game server hands out', () => {
  it('are written where the dev server does not serve', () => {
    expect(relative(OUTPUT_DIR, STANDS_DIR).startsWith('..')).toBe(true);
  });

  it('are never served from the page’s world, however the path is spelt', () => {
    for (const url of [
      '/world/masters/terrain/sprites/biome/stands/70/37.bin',
      '/world/masters/terrain2/sprites/biome/stands/',
      '/world/masters/terrain/sprites/biome/stands',
      '/world/masters/terrain/sprites/biome/busiest-chunk.json',
      '/World/Masters/terrain/Sprites/biome/STANDS/70/37.bin',
      '/world/masters/terrain/sprites/biome/%73tands/70/37.bin',
      '/world/masters/terrain/sprites/biome/stands%2F70%2F37.bin',
      '/world/masters/terrain/sprites/biome\\stands\\70\\37.bin',
      '/world//masters/terrain/sprites/biome/stands/70/37.bin',
      '/world/masters/terrain/tiles/../sprites/biome/stands/70/37.bin',
      '/world/masters/terrain/sprites/biome/stands/70/37.bin?import',
      '/world/masters/terrain/sprites/biome/stands/70/37.bin#there',
      '/world/masters/terrain/sprites/biome/stands/%E0%A4%A.bin',
    ]) {
      expect(asksForStands(url), url).toBe(true);
    }
  });

  it('leaves the rest of the world to be served', () => {
    for (const url of [
      '/world/masters/terrain/sprites/biome/map.json',
      '/world/masters/terrain/sprites/biome/biomes.png',
      '/world/masters/terrain/tiles/7/70/37.png',
      '/world/masters/stands/tiles/7/70/37.png',
      '/world/paint.json',
      '/art/scenery.webp',
      '/',
    ]) {
      expect(asksForStands(url), url).toBe(false);
    }
  });
});

describe('what each errand asks world:ready for', () => {
  it('makes every world step current when it cuts, the same list the quick start makes', () => {
    expect(ERRANDS.cut).toEqual([]);
  });

  it('can furnish, work out the origin, or carry the names, each with the steps made from them', () => {
    const named = new Set(WORLD_STEPS.map((step) => step.name));
    for (const words of [ERRANDS.furnish, ERRANDS.origin, ERRANDS.names]) {
      expect(words[0]).toBe('--only');
      expect(named.has(words[1] as never)).toBe(true);
    }
    expect(ERRANDS.origin[1]).toBe('origin');
    expect(ERRANDS.names[1]).toBe('names');
  });
});
