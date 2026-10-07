import { describe, expect, it } from 'vitest';

import { originOf } from './origin.ts';
import { toWorld, wayBackOf } from './originBack.ts';
import {
  ORIGIN_CLONE as CLONE,
  ORIGIN_EARTH as EARTH,
  ORIGIN_INVENTED as INVENTED,
  ORIGIN_SEA as SEA,
  decodeOrigin,
  encodeOrigin,
  whereFrom,
} from './originFile.ts';
import type { OriginGrid } from './originFile.ts';
import { createRaster } from './raster.ts';
import type { ClassRaster } from './raster.ts';

const OCEAN = 0;
const LAKE = 2;
const options = { sea: new Set([OCEAN, 1]), lake: LAKE, cell: 16 };

/** Ground of sixteen classes in small patches, with a lake every hundred pixels or so, as thick as lake country: a fingerprint. */
function ground(seed: number, x: number, y: number): number {
  const lake = hash(seed + 7, x, y) < 1 / 120;
  return lake ? LAKE : 4 + Math.floor(hash(seed, Math.floor(x / 3), Math.floor(y / 3)) * 16);
}

function hash(seed: number, x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Plain Earth is land on its western half and sea on its eastern. The edited master is the same, with one
 * piece of the land moved out to sea, one turned and moved, one copied while the original stays, and one
 * patch of land painted fresh.
 */
function worlds(): { base: ClassRaster; edited: ClassRaster } {
  const base = createRaster(512, 256);
  for (let y = 0; y < 256; y += 1) for (let x = 0; x < 256; x += 1) base.cells[y * 512 + x] = ground(1, x, y);
  const edited = createRaster(512, 256);
  edited.cells.set(base.cells);
  const at = (raster: ClassRaster, x: number, y: number) =>
    raster.cells[Math.floor(y) * 512 + Math.floor(x)]!;
  // Moved: 64 square from (32, 32) to (300, 40), leaving sea where it was.
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      edited.cells[(40 + y) * 512 + 300 + x] = at(base, 32 + x, 32 + y);
      edited.cells[(32 + y) * 512 + 32 + x] = OCEAN;
    }
  }
  // Turned thirty degrees and moved: a disc round (160, 64) to round (420, 72), leaving sea where it was.
  const turn = (30 * Math.PI) / 180;
  for (let y = -34; y <= 34; y += 1) {
    for (let x = -34; x <= 34; x += 1) {
      if (x * x + y * y > 34 * 34) continue;
      const u = 160 + Math.cos(turn) * (x + 0.5) + Math.sin(turn) * (y + 0.5);
      const v = 64 - Math.sin(turn) * (x + 0.5) + Math.cos(turn) * (y + 0.5);
      edited.cells[(72 + y) * 512 + 420 + x] = at(base, u, v);
    }
  }
  for (let y = -34; y <= 34; y += 1) {
    for (let x = -34; x <= 34; x += 1)
      if (x * x + y * y <= 34 * 34) edited.cells[(64 + y) * 512 + 160 + x] = OCEAN;
  }
  // Copied: (160, 160) to (420, 160), the original left where it is.
  for (let y = 0; y < 48; y += 1)
    for (let x = 0; x < 48; x += 1) edited.cells[(160 + y) * 512 + 420 + x] = at(base, 160 + x, 160 + y);
  // Invented: fresh ground at (300, 150).
  for (let y = 0; y < 64; y += 1)
    for (let x = 0; x < 64; x += 1) edited.cells[(150 + y) * 512 + 300 + x] = ground(99, x, y);
  return { base, edited };
}

const { base, edited } = worlds();
const origin = originOf(edited, base, options);
const statusAt = (map: OriginGrid, x: number, y: number) =>
  map.status[Math.floor(y / 16) * map.columns + Math.floor(x / 16)];
const fromAt = (map: OriginGrid, x: number, y: number) => {
  const found = whereFrom(map, (x / 512) * 360 - 180, 90 - (y / 256) * 180, 512, 256);
  return found.kind === 'earth' || found.kind === 'clone'
    ? [((found.lng + 180) / 360) * 512, ((90 - found.lat) / 180) * 256]
    : found.kind;
};

describe('the origin map', () => {
  it('finds land that never moved where it is', () => {
    expect(statusAt(origin, 200, 120)).toBe(EARTH);
    const [x, y] = fromAt(origin, 200.5, 120.5) as number[];
    expect(x).toBeCloseTo(200.5, 0);
    expect(y).toBeCloseTo(120.5, 0);
  });

  it('finds a piece moved out to sea, and calls the hole it left sea', () => {
    expect(statusAt(origin, 330, 72)).toBe(EARTH);
    const [x, y] = fromAt(origin, 330.5, 72.5) as number[];
    expect(x).toBeCloseTo(62.5, 0);
    expect(y).toBeCloseTo(64.5, 0);
    expect(statusAt(origin, 64, 64)).toBe(SEA);
  });

  it('finds a piece that was turned as well as moved', () => {
    expect(statusAt(origin, 420, 72)).toBe(EARTH);
    const [x, y] = fromAt(origin, 430.5, 72.5) as number[];
    expect(
      Math.hypot(x! - (160 + Math.cos(Math.PI / 6) * 10.5), y! - (64 - Math.sin(Math.PI / 6) * 10.5)),
    ).toBeLessThan(1.5);
  });

  it('calls land painted fresh invented', () => {
    expect(statusAt(origin, 332, 182)).toBe(INVENTED);
    expect(fromAt(origin, 332, 182)).toBe('invented');
  });

  it('calls the smaller of two copies of one place a copy, and leaves the original', () => {
    expect(statusAt(origin, 444, 184)).toBe(CLONE);
    expect(statusAt(origin, 184, 184)).toBe(EARTH);
  });

  it('runs backwards: a place on Earth goes to where its piece went, and removed or copied ground to nowhere', () => {
    const back = wayBackOf(origin, 512, 256);
    // The moved piece's (62.5, 64.5) on Earth is at (330.5, 72.5) in the world, and the turned one's comes back too.
    const [x, y] = toWorld(back, 62.5, 64.5)!;
    expect(x).toBeCloseTo(330.5, 0);
    expect(y).toBeCloseTo(72.5, 0);
    const turned = toWorld(back, 160 + Math.cos(Math.PI / 6) * 10.5, 64 - Math.sin(Math.PI / 6) * 10.5)!;
    expect(Math.hypot(turned[0] - 430.5, turned[1] - 72.5)).toBeLessThan(1.5);
    // Never moved: where it was. The copied ground's original stays; Earth's sea went nowhere.
    expect(toWorld(back, 200.5, 120.5)).toEqual([200.5, 120.5]);
    expect(toWorld(back, 184, 184)).toEqual([184, 184]);
    expect(toWorld(back, 400, 120)).toBeNull();
  });

  it('reads back what it writes', () => {
    const bytes = encodeOrigin(origin);
    const read = decodeOrigin(bytes.slice().buffer, origin);
    expect([...read.status]).toEqual([...origin.status]);
    expect([...read.x]).toEqual([...origin.x]);
  });
});
