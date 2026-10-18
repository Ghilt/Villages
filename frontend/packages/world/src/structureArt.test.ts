import { describe, expect, it } from 'vitest';

import { flagOf, footOfBuilding, keyOfStructureFile, structurePictureFile } from './structureArt.ts';

describe("a structure's pictures as files", () => {
  it('are a type and a culture, or a ruin and a culture, and the map asks for each by its key', () => {
    expect(structurePictureFile('printingHouse', 'eastAsian')).toBe('printingHouse-eastAsian.png');
    expect(structurePictureFile('a ruin', 'african')).toBe('ruin-african.png');
    expect(keyOfStructureFile('printingHouse-eastAsian.png')).toBe('printingHouse@eastAsian');
    expect(keyOfStructureFile('ruin-african.png')).toBe('a ruin@african');
  });

  it('refuse a file that is not one', () => {
    expect(keyOfStructureFile('castle-atlantean.png')).toBeNull();
    expect(keyOfStructureFile('notes.txt')).toBeNull();
  });

  it('fly a pennant from the middle of the highest row anything is drawn in', () => {
    // Four wide, three tall: nothing in the top row, the second drawn in its two right-hand pixels.
    const data = new Uint8Array(4 * 3 * 4);
    for (const x of [2, 3]) data[(1 * 4 + x) * 4 + 3] = 255;
    for (let x = 0; x < 4; x += 1) data[(2 * 4 + x) * 4 + 3] = 255;

    expect(flagOf({ width: 4, height: 3, data })).toEqual({ x: 3 / 4, y: 1 / 3 });
    expect(flagOf({ width: 2, height: 2, data: new Uint8Array(16) })).toEqual({ x: 0.5, y: 0 });
  });

  it('stand a building on the front corner of its base, its lowest point, not the middle of its lowest rows', () => {
    // A base turned as the ground's diamonds are, forty wide and twenty tall: its long front edge runs off up to the
    // left, its short side steeply up to the right, and the corner where they meet is lowest, at x 30.
    const width = 40;
    const height = 20;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      const up = height - 1 - y;
      for (let x = Math.max(0, 30 - up * 3); x <= Math.min(width - 1, 30 + Math.floor(up * 0.5)); x += 1) {
        data[(y * width + x) * 4 + 3] = 255;
      }
    }
    // A faint wash under the left of it is not the ground.
    for (let x = 0; x < 10; x += 1) data[((height - 1) * width + x) * 4 + 3] = 40;

    expect(footOfBuilding({ width, height, data }) * width).toBeCloseTo(29.5, 0);
    expect(footOfBuilding({ width: 2, height: 2, data: new Uint8Array(16) })).toBe(0.5);
  });
});
