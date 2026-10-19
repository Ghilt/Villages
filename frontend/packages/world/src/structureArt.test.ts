import { describe, expect, it } from 'vitest';

import { SHADOW, shadowOf } from './art.ts';
import type { Rgba } from './art.ts';
import {
  flagOf,
  footOfBuilding,
  keyOfStructureFile,
  shadowOfBuilding,
  structurePictureFile,
} from './structureArt.ts';

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

describe("a building's shadow", () => {
  /** A picture a hundred wide and 160 tall with each column drawn solid from the top down to `bottom(x)`. */
  const picture = (bottom: (x: number) => number): Rgba => {
    const data = new Uint8Array(100 * 160 * 4);
    for (let x = 0; x < 100; x += 1) {
      for (let y = 0; y <= bottom(x); y += 1) data[(y * 100 + x) * 4 + 3] = 255;
    }
    return { width: 100, height: 160, data };
  };
  /** How dark a shadow is `dx` right of its foot and `dy` below it: nothing, outside what was cut. */
  const shade = (shadow: ReturnType<typeof shadowOfBuilding>, dx: number, dy: number) => {
    const x = Math.round(shadow.footX + dx);
    const y = Math.round(shadow.footY + dy);
    const inside = x >= 0 && y >= 0 && x < shadow.image.width && y < shadow.image.height;
    return inside ? shadow.image.data[(y * shadow.image.width + x) * 4 + 3]! : 0;
  };

  it('is cast from where each column meets the ground, the front edges of its base, and not from a line under it', () => {
    // Its left half stands thirty rows higher than its right, as the left corner of a base stands over its front one.
    const stepped = picture((x) => (x < 50 ? 129 : 159));
    const building = shadowOfBuilding(stepped, 75);
    const tree = shadowOf(stepped, 75);
    // Just in front of the left half's foot: the shade of its walls meeting the ground, where a tree's would be bare.
    expect(shade(building, -50, -27)).toBeGreaterThan(0.5 * 255);
    expect(shade(tree, -50, -27)).toBe(0);
  });

  it('falls to the left and a little towards the eye, the higher the part the farther', () => {
    // A pole four wide standing on its foot: the part of it so far up falls a lean of that left and a flat of it down.
    const pole = picture((x) => (x >= 73 && x < 77 ? 159 : -1));
    const shadow = shadowOfBuilding(pole, 75);
    const row = (dy: number) => {
      let weight = 0;
      let sum = 0;
      for (let dx = -80; dx <= 10; dx += 1) {
        weight += shade(shadow, dx, dy);
        sum += shade(shadow, dx, dy) * dx;
      }
      return sum / weight;
    };
    // Halfway up, eighty, it falls a lean of eighty left: to within the lean of a row, as the softening mixes each row
    // with its neighbours.
    expect(Math.abs(row(SHADOW.flat * 80) - -SHADOW.lean * 80)).toBeLessThan(SHADOW.lean / SHADOW.flat);
    // And from end to end it runs left: the higher the part, the farther its shadow.
    for (let dy = 2; dy <= SHADOW.flat * 160; dy += 2) expect(row(dy)).toBeLessThan(row(dy - 2));
    // Nothing of it to the right, where the light comes from, past its softening.
    expect(shade(shadow, 2 * SHADOW.soft[1] + 3, 0)).toBe(0);
  });

  it('is black, and nothing at all for a picture with nothing in it', () => {
    const shadow = shadowOfBuilding(
      picture(() => 159),
      66,
    );
    expect(shadow.image.data.every((value, at) => at % 4 === 3 || value === 0)).toBe(true);
    const empty = shadowOfBuilding(
      picture(() => -1),
      50,
    );
    expect(empty.image.data.some((value) => value !== 0)).toBe(false);
  });
});
