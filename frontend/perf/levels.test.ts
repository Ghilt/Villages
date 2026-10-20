import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findSetters, settersIn } from './levels';

describe('finding the shaders’ levels', () => {
  it('finds a setter and the store named for the same thing', () => {
    const text = `
export const landStore: Readable<LandState> = land;
export const shownStore = 1;
export function setLandLevel(level: ShaderLevel): void {}
export function setLandShown(motion: DrawnMotion, shown: boolean): void {}`;
    expect(settersIn('/src/sprites/land/landMode.ts', text)).toEqual([
      { module: '/src/sprites/land/landMode.ts', setter: 'setLandLevel', store: 'landStore' },
    ]);
  });

  it('finds an older name as well, and none where there is no store', () => {
    expect(settersIn('/src/a.ts', 'export function setGrassLevel(level: ShaderLevel) {}')).toEqual([
      { module: '/src/a.ts', setter: 'setGrassLevel', store: null },
    ]);
  });

  it('finds every shader of this tree', () => {
    const setters = findSetters(resolve(import.meta.dirname, '..', '..')).map((found) => found.setter);
    expect(setters).toEqual(expect.arrayContaining(['setLandLevel', 'setWaterLevel', 'setCloudLevel']));
  });
});
