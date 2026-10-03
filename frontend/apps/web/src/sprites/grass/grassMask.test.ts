import { describe, expect, it } from 'vitest';

import { fromMercator } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { TILE, WORLD_MASTER_WIDTH } from '../../geometry/world';

import { MOST_TILES, grassMaskOf, groundAt, sameRange, tilesUnder } from './grassMask';

/** A view centred on a point of world space, in world units. */
function viewAt(x: number, y: number, zoom: number, extra: Partial<CameraView> = {}): CameraView {
  return {
    center: fromMercator({ x: x / WORLD_MASTER_WIDTH, y: y / WORLD_MASTER_WIDTH }),
    zoom,
    width: 800,
    height: 600,
    ...extra,
  };
}

describe('the grass mask', () => {
  it('finds the ground under the middle of the screen at the camera, and further off by the scale', () => {
    const view = viewAt(5000.5, 6000.5, 9);
    const middle = groundAt(view, 400, 300);
    expect(middle.x).toBeCloseTo(5000.5, 3);
    expect(middle.y).toBeCloseTo(6000.5, 3);
    // At zoom 9 a world unit is eight pixels across, so the right edge is fifty units east.
    expect(groundAt(view, 800, 300).x).toBeCloseTo(5050.5, 3);
  });

  it('reaches further down the ground when the camera is tipped', () => {
    const flat = groundAt(viewAt(5000, 6000, 9), 400, 600).y;
    const tipped = groundAt(viewAt(5000, 6000, 9, { pitch: 60 }), 400, 600).y;
    expect(tipped - 6000).toBeCloseTo((flat - 6000) * 2, 3);
  });

  it('pieces the tiles under the view, and none when the camera is too far out for grass', () => {
    const range = tilesUnder(viewAt(10 * TILE + 128, 20 * TILE + 128, 9.5));
    expect(range).toEqual({ fromX: 10, toX: 10, fromY: 20, toY: 20 });
    expect(sameRange(range, { fromX: 10, toX: 10, fromY: 20, toY: 20 })).toBe(true);
    expect(sameRange(range, null)).toBe(false);
    // Far out the view covers more tiles than are worth piecing.
    expect(tilesUnder(viewAt(10 * TILE, 20 * TILE, 5))).toBeNull();
    expect(MOST_TILES).toBeGreaterThan(1);
  });

  it('marks the grass classes and nothing else, tile by tile from the north-west', () => {
    const range = { fromX: 3, toX: 4, fromY: 7, toY: 7 };
    const west = new Uint8Array(TILE * TILE).fill(17);
    const east = new Uint8Array(TILE * TILE).fill(2);
    east[0] = 17;
    const mask = grassMaskOf(range, [west, east], new Set([17]));
    expect(mask.width).toBe(2 * TILE);
    expect(mask.height).toBe(TILE);
    expect(mask.texels[0]).toBe(255);
    expect(mask.texels[TILE]).toBe(255);
    expect(mask.texels[TILE + 1]).toBe(0);
    expect(mask.grassy).toBe(TILE * TILE + 1);
    // A tile that is not there grows nothing.
    expect(grassMaskOf(range, [null, null], new Set([17])).grassy).toBe(0);
  });
});
