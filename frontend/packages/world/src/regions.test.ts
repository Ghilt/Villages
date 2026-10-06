import { describe, expect, it } from 'vitest';

import { regionLabels, regionsOf } from './regions.ts';
import type { EarthRegion } from './regions.ts';
import { ORIGIN_EARTH, ORIGIN_INVENTED, ORIGIN_SEA } from './originFile.ts';
import type { OriginGrid } from './originFile.ts';

const INVENTED_SQUARE = 6 * 16 + 2;

/**
 * Sixteen by eight squares of 32 pixels, a world 512 by 256 pixels: a pixel is 0.703125 degrees either way.
 * Columns 0 to 3 are land that never moved, but for one invented square; column 4 is land moved 128 pixels
 * east of where it was on Earth; the rest is sea.
 */
function originGrid(): OriginGrid {
  const columns = 16;
  const rows = 8;
  const n = columns * rows;
  const grid = {
    cell: 32,
    columns,
    rows,
    x: new Float32Array(n),
    y: new Float32Array(n),
    a: new Float32Array(n).fill(1),
    b: new Float32Array(n),
    c: new Float32Array(n),
    d: new Float32Array(n).fill(1),
    agreement: new Float32Array(n),
    status: new Uint8Array(n),
  };
  for (let k = 0; k < n; k += 1) {
    const column = k % columns;
    const middleX = column * 32 + 16;
    grid.x[k] = column === 4 ? middleX - 128 : middleX;
    grid.y[k] = Math.floor(k / columns) * 32 + 16;
    grid.status[k] = k === INVENTED_SQUARE ? ORIGIN_INVENTED : column < 5 ? ORIGIN_EARTH : ORIGIN_SEA;
    grid.agreement[k] = 1;
  }
  return grid;
}

/** A rectangle of Earth, in pixels of the 512 by 256 world, as a polygon in longitude and latitude. */
function box(left: number, top: number, right: number, bottom: number): [number, number][][] {
  const lng = (x: number) => (x / 512) * 360 - 180;
  const lat = (y: number) => 90 - (y / 256) * 180;
  return [
    [
      [lng(left), lat(top)],
      [lng(right), lat(top)],
      [lng(right), lat(bottom)],
      [lng(left), lat(bottom)],
      [lng(left), lat(top)],
    ],
  ];
}

const regions: EarthRegion[] = [
  // The smaller first, so that only painting by size, and not the order of the list, puts it on top.
  { id: 'pass', kind: 'land', name: 'Brenner', feature: 'Pass', polygons: [box(32, 32, 64, 64)] },
  { id: 'range', kind: 'land', name: 'Alps', feature: 'Range/mtn', polygons: [box(0, 0, 128, 256)] },
  // The sea beyond where the moved land is now, and the sea beside where it was on Earth.
  { id: 'there', kind: 'sea', name: 'Sea Where It Lies', feature: 'sea', polygons: [box(192, 0, 512, 256)] },
  { id: 'then', kind: 'sea', name: 'Sea It Came From', feature: 'sea', polygons: [box(48, 0, 192, 256)] },
];

describe('the named regions of the world', () => {
  const grid = originGrid();
  const { land, sea } = regionsOf(grid, 512, 256, regions);
  const nameOf = (index: number) => regions[index - 1]?.name;

  it('puts a square in the region its middle came from, the smaller of two nested ones', () => {
    expect(nameOf(land[3 * 16 + 0]!)).toBe('Alps');
    expect(nameOf(land[1 * 16 + 1]!)).toBe('Brenner');
  });

  it('names open sea by its nearest coast, carried out across the water, not by where it lies', () => {
    // Column 6 lies at 208 pixels, in the sea beyond; carried out from the moved land beside it, it is at 80.
    expect(nameOf(sea[2 * 16 + 6]!)).toBe('Sea It Came From');
  });

  it('writes the name of a region on its own squares, and of a sea on its open water', () => {
    const labels = regionLabels(grid, { land, sea }, regions.length);
    const squareOf = ([lng, lat]: readonly [number, number]) =>
      Math.floor(((90 - lat) / 180) * 8) * 16 + Math.floor(((lng + 180) / 360) * 16);
    const alps = labels[regions.findIndex((one) => one.name === 'Alps')]!;
    expect(land[squareOf(alps.at)]).toBe(regions.findIndex((one) => one.name === 'Alps') + 1);
    const water = labels[regions.findIndex((one) => one.name === 'Sea It Came From')]!;
    expect(grid.status[squareOf(water.at)]).toBe(ORIGIN_SEA);
    expect(water.squares).toBeGreaterThan(0);
  });

  it('gives invented land no region at all', () => {
    expect(land[INVENTED_SQUARE]).toBe(0);
  });
});
