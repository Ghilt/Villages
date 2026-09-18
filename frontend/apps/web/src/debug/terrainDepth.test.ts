import { describe, expect, it } from 'vitest';

import { describeTerrainStep, masterPerPixel, stretchAt } from './terrainDepth';

/** The world as it is actually cut: a 32768-wide master into 256px tiles, deepest at zoom 7. */
const world = { masterWidth: 32768, tileSize: 256, flatMaxZoom: 7 };
const at = (tileZoom: number) => ({ ...world, tileZoom });

describe('how much ground a pixel covers', () => {
  it('halves with every zoom, and is one master pixel at the depth the terrain was cut at', () => {
    expect(masterPerPixel(at(7))).toBeCloseTo(1);
    expect(masterPerPixel(at(6))).toBeCloseTo(2);
    expect(masterPerPixel(at(2))).toBeCloseTo(32);
  });

  it('keeps going past that depth, because the pixels are stretched rather than absent', () => {
    expect(masterPerPixel(at(9))).toBeCloseTo(0.25);
  });
});

describe('how far the terrain is stretched', () => {
  it('is not stretched at all while there is detail left to draw', () => {
    expect(stretchAt(at(0))).toBe(1);
    expect(stretchAt(at(7))).toBe(1);
  });

  it('doubles for every zoom past the depth it was cut at', () => {
    expect(stretchAt(at(8))).toBe(2);
    expect(stretchAt(at(9))).toBe(4);
    expect(stretchAt(at(10))).toBe(8);
  });
});

describe('saying where the terrain came from and went', () => {
  it('names the run rather than the step, so a camera flight is one line', () => {
    expect(describeTerrainStep(4, at(9))).toBe('z4 to z9: 0.25 master px a pixel, z7 stretched 4x');
  });

  it('says it is as cut while nothing is being stretched', () => {
    expect(describeTerrainStep(4, at(5))).toBe('z4 to z5: 4.00 master px a pixel, as cut');
  });

  it('says nothing about a run that came back to where it began', () => {
    expect(describeTerrainStep(6, at(6))).toBeNull();
  });
});
