import { describe, expect, it } from 'vitest';

import { fromMercator } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { TILE, WORLD_MASTER_WIDTH } from '../../geometry/world';

import {
  CHANNELS_IN_FIRST,
  DRAWN,
  MOST_TILES,
  channelOf,
  groundAt,
  landMaskOf,
  sameRange,
  tilesUnder,
} from './landMask';

const texelOf = (mask: { texels: Uint8Array }, x: number) => [...mask.texels.subarray(x * 4, x * 4 + 4)];

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

describe('the land mask', () => {
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

  it('pieces the tiles under the view, and none when the camera is too far out for the land', () => {
    const range = tilesUnder(viewAt(10 * TILE + 128, 20 * TILE + 128, 9.5));
    expect(range).toEqual({ fromX: 10, toX: 10, fromY: 20, toY: 20 });
    expect(sameRange(range, { fromX: 10, toX: 10, fromY: 20, toY: 20 })).toBe(true);
    expect(sameRange(range, null)).toBe(false);
    // Far out the view covers more tiles than are worth piecing.
    expect(tilesUnder(viewAt(10 * TILE, 20 * TILE, 5))).toBeNull();
    expect(MOST_TILES).toBeGreaterThan(1);
  });

  it('marks each class in the channel of its motion, and nothing where nothing is drawn, from the north-west', () => {
    const range = { fromX: 3, toX: 4, fromY: 7, toY: 7 };
    const west = new Uint8Array(TILE * TILE).fill(17);
    const east = new Uint8Array(TILE * TILE).fill(2);
    east[0] = 17;
    east[1] = 21;
    // Class 17 in the first channel, red; class 21 in the last, alpha; class 2 in none.
    const channels = new Array<number | null>(256).fill(null);
    channels[17] = 0;
    channels[21] = 3;
    // Class 21 the second look of its motion, the rest the first.
    const looks = new Array<number>(256).fill(0);
    looks[21] = 1;
    const mask = landMaskOf(range, [west, east], channels, looks);
    expect(mask.width).toBe(2 * TILE);
    expect(mask.height).toBe(TILE);
    const texel = (x: number) => texelOf(mask, x);
    expect(texel(0)).toEqual([255, 0, 0, 0]);
    expect(texel(TILE)).toEqual([255, 0, 0, 0]);
    expect(texel(TILE + 1)).toEqual([0, 0, 0, 255]);
    expect(texel(TILE + 2)).toEqual([0, 0, 0, 0]);
    expect(mask.counts).toEqual([TILE * TILE + 1, 0, 0, 1, 0]);
    expect([...mask.looks.subarray(TILE, TILE + 3)]).toEqual([0, 1, 0]);
    // A tile that is not there moves nothing.
    expect(landMaskOf(range, [null, null], channels, looks).counts).toEqual([0, 0, 0, 0, 0]);
    // A fifth motion's class is in the second texture, and in none of the first's channels.
    channels[2] = 4;
    const fifth = landMaskOf(range, [east, west], channels, looks);
    expect(fifth.more[2]).toBe(255);
    expect(texelOf(fifth, 2)).toEqual([0, 0, 0, 0]);
    expect(fifth.counts[4]).toBe(TILE * TILE - 2);
  });

  it("writes a class's channel at its own strength where one is given, the grass under the woods a little below full", () => {
    const range = { fromX: 0, toX: 0, fromY: 0, toY: 0 };
    const tile = new Uint8Array(TILE * TILE).fill(17);
    tile[1] = 21;
    const channels = new Array<number | null>(256).fill(null);
    channels[17] = 0;
    channels[21] = 0;
    const strengths = new Array<number>(256).fill(255);
    strengths[21] = 243;
    const mask = landMaskOf(range, [tile], channels, [], strengths);
    expect(texelOf(mask, 0)).toEqual([255, 0, 0, 0]);
    expect(texelOf(mask, 1)).toEqual([243, 0, 0, 0]);
  });

  it('draws each motion drawn from a channel of its own, the four of the first texture and one past them: the grass, the crops, the heath, the wet land, the ice', () => {
    expect(DRAWN.length).toBeLessThanOrEqual(CHANNELS_IN_FIRST + 1);
    expect(channelOf('grass')).toBe(0);
    expect(channelOf('crops')).toBe(1);
    expect(channelOf('heath')).toBe(2);
    expect(channelOf('wet')).toBe(3);
    expect(channelOf('ice-salt-sand')).toBe(4);
    expect(new Set(DRAWN.map(channelOf)).size).toBe(DRAWN.length);
    expect(channelOf('still')).toBeNull();
    expect(channelOf(null)).toBeNull();
  });
});
