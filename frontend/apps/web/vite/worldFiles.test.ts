import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { worldFileOf } from './worldFiles.ts';

const WORLD = resolve('/served/world');

describe('the page’s world, which the dev server sends itself', () => {
  it('is found under the world folder, the query and the fragment aside', () => {
    expect(worldFileOf('/world/masters/terrain/height/7/70/44.webp', WORLD)).toBe(
      resolve(WORLD, 'masters', 'terrain', 'height', '7', '70', '44.webp'),
    );
    expect(worldFileOf('/world/paint.json?t=17', WORLD)).toBe(resolve(WORLD, 'paint.json'));
    expect(worldFileOf('/world/masters/terrain/tiles/1/0/0.png#there', WORLD)).toBe(
      resolve(WORLD, 'masters', 'terrain', 'tiles', '1', '0', '0.png'),
    );
    expect(worldFileOf('/world/masters/terrain/tiles/./1/0/0.png', WORLD)).toBe(
      resolve(WORLD, 'masters', 'terrain', 'tiles', '1', '0', '0.png'),
    );
  });

  it('never names a file outside it, however the path is spelt', () => {
    for (const url of [
      '/world/../vite.config.ts',
      '/world/%2e%2e/vite.config.ts',
      '/world/masters/../../src/main.tsx',
      '/world/masters%2F..%2F..%2Fsrc%2Fmain.tsx',
      '/world/..\\vite.config.ts',
      '/world/%5C..%5Cvite.config.ts',
      '/world/C:/Windows/win.ini',
      '/world/C%3A/Windows/win.ini',
      '/world/%00.png',
      '/world/%E0%A4%A.png',
    ]) {
      expect(worldFileOf(url, WORLD), url).toBeNull();
    }
  });

  it('leaves everything else to Vite, the stands to their refusal and the folder itself unread', () => {
    for (const url of [
      '/',
      '/world',
      '/world/',
      '/worlds/paint.json',
      '/world-api/masters',
      '/src/main.tsx',
      '/world/masters/terrain/sprites/biome/stands/70/37.bin',
      '/world/masters/terrain/sprites/biome/busiest-chunk.json',
    ]) {
      expect(worldFileOf(url, WORLD), url).toBeNull();
    }
  });
});
