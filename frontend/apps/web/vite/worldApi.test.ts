import { relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { OUTPUT_DIR, STANDS_DIR } from '../../../packages/world/bin/lib/paths.ts';
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

describe('what a repaint makes stale, and cutting makes again', () => {
  it('cuts, traces the rivers, furnishes, reads the ground, and works out where the land came from', () => {
    expect(ERRANDS.cut.map(([script]) => script)).toEqual([
      'importMaster.ts',
      'tileWorld.ts',
      'flowWorld.ts',
      'generateSpriteMap.ts',
      'groundWorld.ts',
      'originWorld.ts',
    ]);
  });

  it('can work out the origin, or carry the names, on their own', () => {
    expect(ERRANDS.origin.map(([script]) => script)).toEqual(['originWorld.ts']);
    expect(ERRANDS.names.map(([script]) => script)).toEqual(['namesWorld.ts']);
  });
});
