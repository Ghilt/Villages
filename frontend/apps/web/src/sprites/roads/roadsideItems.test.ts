import { describe, expect, it } from 'vitest';

import { roadKindByte } from '@villages/world/build';

import { roadsideAlong, wayNearest } from './roadsideItems';
import type { RoadsideGround } from './roadsideItems';

const widths = { track: 0.7, road: 1, trunk: 1.4, bridge: 1 };
const road = { ax: 1000, ay: 1000, bx: 1060, by: 1000, kind: roadKindByte('road') };
const everywhere = (biome: string): RoadsideGround => ({
  biome: () => biome,
  clear: () => true,
  onRoad: (_, y) => Math.abs(y - 1000) < 0.5,
});

describe('the roadside', () => {
  it('stands along both sides of a road, past its band, never on it', () => {
    const items = roadsideAlong([road], widths, 1, everywhere('temperate'));
    expect(items.length).toBeGreaterThan(20);
    expect(items.some((item) => item.y < 1000)).toBe(true);
    expect(items.some((item) => item.y > 1000)).toBe(true);
    for (const item of items) expect(Math.abs(item.y - 1000)).toBeGreaterThan(0.5);
  });

  it("is walled only where its biome builds walls, in the biome's style, along the road's way", () => {
    const green = roadsideAlong([road], widths, 1, everywhere('oceanic')).filter((item) => 'wall' in item);
    expect(green.length).toBeGreaterThan(0);
    for (const wall of green) expect(wall).toMatchObject({ wall: 'mossy', way: wayNearest(1, 0) });
    const dry = roadsideAlong([road], widths, 1, everywhere('mediterranean')).filter(
      (item) => 'wall' in item,
    );
    for (const wall of dry) expect(wall).toMatchObject({ wall: 'bare' });
    expect(roadsideAlong([road], widths, 1, everywhere('boreal-dense')).some((item) => 'wall' in item)).toBe(
      false,
    );
  });

  it('grows only what its biome grows', () => {
    const items = roadsideAlong([road], widths, 1, everywhere('desert-margin'));
    for (const item of items) if ('kind' in item) expect(['scrub', 'boulder', 'cactus']).toContain(item.kind);
  });

  it('is nothing where the ground is not kept clear for it: in a settlement, on water, unrevealed', () => {
    const shut: RoadsideGround = { ...everywhere('temperate'), clear: () => false };
    expect(roadsideAlong([road], widths, 1, shut)).toEqual([]);
  });

  it('grows in clumps: stretches bare, stretches full, and stretches of patches with gaps between', () => {
    const long = { ...road, bx: 1600 };
    const growth = roadsideAlong([long], widths, 1, everywhere('temperate')).filter((item) => 'kind' in item);
    const windows = new Array<number>(100).fill(0);
    for (const item of growth) windows[Math.min(99, Math.floor((item.x - 1000) / 6))]! += 1;
    const share = (pick: (count: number) => boolean) => windows.filter(pick).length / windows.length;
    expect(share((count) => count === 0)).toBeGreaterThan(0.15);
    expect(share((count) => count >= 15)).toBeGreaterThan(0.1);
    expect(share((count) => count > 0 && count < 12)).toBeGreaterThan(0.1);
  });

  it('is the same every time, so every page lays the same roadside', () => {
    const one = roadsideAlong([road], widths, 1, everywhere('temperate'));
    const other = roadsideAlong([{ ...road }], widths, 1, everywhere('temperate'));
    expect(one).toEqual(other);
  });
});
