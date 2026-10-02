import { describe, expect, it } from 'vitest';

import { DEEP_RANGE, SHORE_RANGE, SIDE, maskOf } from './waterMask';

const OCEAN = 0;
const SHELF = 1;
const LAKE = 2;
const RIVER = 3;
const FIELD = 9;
const kinds = {
  deep: new Set([OCEAN]),
  shallow: new Set([SHELF, LAKE, RIVER]),
  lake: new Set([LAKE]),
  river: new Set([RIVER]),
};

/** A tile whose columns are each one class, west to east. */
const columns = (classOf: (column: number) => number) => {
  const tile = new Uint8Array(SIDE * SIDE);
  for (let at = 0; at < tile.length; at += 1) {
    tile[at] = classOf(at % SIDE);
  }
  return tile;
};

const shoreAt = (mask: Uint8Array, column: number, row = 100) =>
  (mask[(row * SIDE + column) * 4]! / 255) * (SHORE_RANGE.to - SHORE_RANGE.from) + SHORE_RANGE.from;
const deepAt = (mask: Uint8Array, column: number, row = 100) =>
  (mask[(row * SIDE + column) * 4 + 1]! / 255) * (DEEP_RANGE.to - DEEP_RANGE.from) + DEEP_RANGE.from;

describe('the water mask', () => {
  it('measures the shore in world units, positive out on the water and negative inland', () => {
    // Land to column 127, the shelf from 128 to 159, the ocean beyond; the same all round.
    const tile = columns((column) => (column < 128 ? FIELD : column < 160 ? SHELF : OCEAN));
    const mask = maskOf(Array(9).fill(tile), 1, kinds)!;
    expect(shoreAt(mask, 128)).toBeCloseTo(0.5, 0);
    expect(shoreAt(mask, 127)).toBeCloseTo(-0.5, 0);
    expect(shoreAt(mask, 140)).toBeCloseTo(12.5, 0);
    expect(shoreAt(mask, 120)).toBeCloseTo(-7.5, 0);
    // The edge of the deep ocean, from the shelf's side and from the ocean's.
    expect(deepAt(mask, 159)).toBeCloseTo(-0.5, 0);
    expect(deepAt(mask, 170)).toBeCloseTo(10.5, 0);
  });

  it('sees the coast across the edge of the tile, from its neighbour', () => {
    const sea = columns(() => SHELF);
    const coast = columns((column) => (column < 250 ? FIELD : SHELF));
    // The tile to the west ends in land at its column 249; this one is all sea.
    const around = [sea, sea, sea, coast, sea, sea, sea, sea, sea];
    const mask = maskOf(around, 1, kinds)!;
    expect(shoreAt(mask, 0)).toBeCloseTo(6.5, 0);
  });

  it('scales its distances by the size of a texel at coarser zooms', () => {
    const tile = columns((column) => (column < 128 ? FIELD : SHELF));
    const mask = maskOf(Array(9).fill(tile), 4, kinds)!;
    expect(shoreAt(mask, 130)).toBeCloseTo(10, 0);
  });

  it('takes a river a texel wide for water, with its banks half a texel either side', () => {
    const tile = columns((column) => (column === 100 ? RIVER : FIELD));
    const mask = maskOf(Array(9).fill(tile), 1, kinds)!;
    expect(shoreAt(mask, 100)).toBeCloseTo(0.5, 0);
    expect(shoreAt(mask, 103)).toBeCloseTo(-2.5, 0);
    expect(mask[(100 * SIDE + 100) * 4 + 3]).toBe(255);
    expect(mask[(100 * SIDE + 101) * 4 + 3]).toBe(0);
  });

  it('marks the lakes, and has nothing to say about dry land', () => {
    const tile = columns((column) => (column < 128 ? FIELD : LAKE));
    expect(maskOf(Array(9).fill(tile), 1, kinds)![(100 * SIDE + 200) * 4 + 2]).toBe(255);
    expect(maskOf(Array(9).fill(columns(() => FIELD)), 1, kinds)).toBeNull();
  });
});
