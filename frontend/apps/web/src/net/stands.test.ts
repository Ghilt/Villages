import { afterEach, describe, expect, it } from 'vitest';

import { quadkeyOf } from '@villages/protocol';
import { encodeStands } from '@villages/world/build';
import type { Stand } from '@villages/world/build';

import {
  followStandsUnder,
  forgetStands,
  onStandsArrived,
  sentStandsOf,
  standsArrived,
  standsHeld,
  tileKey,
} from './stands';

/** A zoom 10 cell well inside the zoom 7 tile at x and y, so it brings that tile and no other. */
const cellInside = (x: number, y: number): string => quadkeyOf({ zoom: 10, x: x * 8 + 3, y: y * 8 + 3 });

/** Records the way the gateway sends them: the generator's bytes, in base64. */
function recordsOf(stands: Stand[], x: number, y: number): string {
  return btoa(String.fromCharCode(...encodeStands(stands, x, y, 256)));
}

const oneStand = (x: number, y: number, reach: number): Stand => ({
  x,
  y,
  reach,
  dominant: 3,
  thickness: 0.25,
  seed: 7,
});

describe('the stands the gateway sent', () => {
  const told: number[] = [];
  onStandsArrived((tile) => told.push(tile));

  afterEach(() => {
    forgetStands();
    told.length = 0;
  });

  it('keeps a tile under a followed cell, and says so; before it comes, it is not yet', () => {
    followStandsUnder([cellInside(70, 37)]);
    expect(sentStandsOf(70, 37)).toBeNull();

    standsArrived(70, 37, recordsOf([oneStand(70 * 256 + 10, 37 * 256 + 20, 6)], 70, 37));

    const held = sentStandsOf(70, 37);
    expect(held?.chunk.count).toBe(1);
    expect(held?.chunk.x[0]).toBe(70 * 256 + 10);
    expect(held?.chunk.reach[0]).toBe(6);
    expect(told).toEqual([tileKey(70, 37)]);
    expect(standsHeld()).toEqual({ tiles: 1, stands: 1 });
  });

  it('keeps the ruins of a tile apart from its scenery, and lets both go with the tile', () => {
    const layers: string[] = [];
    const stop = onStandsArrived((_, __, layer) => layers.push(layer));
    followStandsUnder([cellInside(70, 37)]);
    standsArrived(70, 37, recordsOf([oneStand(70 * 256 + 10, 37 * 256 + 20, 6)], 70, 37));
    standsArrived(70, 37, recordsOf([oneStand(70 * 256 + 40, 37 * 256 + 40, 30)], 70, 37), 'ruins');
    stop();

    expect(sentStandsOf(70, 37)?.chunk.x[0]).toBe(70 * 256 + 10);
    expect(sentStandsOf(70, 37, 'ruins')?.chunk.reach[0]).toBe(30);
    expect(standsHeld()).toEqual({ tiles: 1, stands: 1 });
    expect(standsHeld('ruins')).toEqual({ tiles: 1, stands: 1 });
    expect(layers).toEqual(['biome', 'ruins']);

    followStandsUnder([]);
    expect(sentStandsOf(70, 37, 'ruins')).toBeNull();
    expect(standsHeld('ruins')).toEqual({ tiles: 0, stands: 0 });
  });

  it('keeps an empty tile as empty, which is all there is, rather than not yet', () => {
    followStandsUnder([cellInside(70, 37)]);
    standsArrived(70, 37, '');
    expect(sentStandsOf(70, 37)?.chunk.count).toBe(0);
  });

  it('says nothing when a tile is sent again as it was, and says it again when it has changed', () => {
    followStandsUnder([cellInside(70, 37)]);
    const few = recordsOf([oneStand(70 * 256 + 10, 37 * 256 + 20, 6)], 70, 37);
    const more = recordsOf(
      [oneStand(70 * 256 + 10, 37 * 256 + 20, 6), oneStand(70 * 256 + 100, 37 * 256 + 200, 12)],
      70,
      37,
    );

    standsArrived(70, 37, few);
    standsArrived(70, 37, few);
    expect(told).toHaveLength(1);

    standsArrived(70, 37, more);
    expect(told).toHaveLength(2);
    expect(sentStandsOf(70, 37)?.chunk.count).toBe(2);
  });

  it('keeps nothing for a tile no followed cell is over, as the gateway sends it nothing', () => {
    followStandsUnder([cellInside(70, 37)]);
    standsArrived(12, 30, '');
    expect(sentStandsOf(12, 30)).toBeNull();
    expect(told).toEqual([]);
  });

  it('lets a tile go with the last cell over it, so coming back waits for the gateway again', () => {
    followStandsUnder([cellInside(70, 37), cellInside(71, 37)]);
    standsArrived(70, 37, '');
    standsArrived(71, 37, '');

    followStandsUnder([cellInside(71, 37)]);
    expect(sentStandsOf(70, 37)).toBeNull();
    expect(sentStandsOf(71, 37)).not.toBeNull();

    followStandsUnder([cellInside(70, 37), cellInside(71, 37)]);
    expect(sentStandsOf(70, 37)).toBeNull();
    // Sent again as it was, it is new to the page, because the page let it go.
    standsArrived(70, 37, '');
    expect(sentStandsOf(70, 37)).not.toBeNull();
    expect(told).toEqual([tileKey(70, 37), tileKey(71, 37), tileKey(70, 37)]);
  });

  it('wraps across the world and has nothing past its top or its bottom, which never waits', () => {
    followStandsUnder([cellInside(0, 37)]);
    expect(tileKey(-1, 37)).toBe(tileKey(127, 37));
    expect(sentStandsOf(-128, 37)).toBeNull();
    standsArrived(0, 37, '');
    expect(sentStandsOf(128, 37)).not.toBeNull();

    expect(sentStandsOf(5, -1)?.chunk.count).toBe(0);
    expect(sentStandsOf(5, 128)?.chunk.count).toBe(0);
  });

  it('stops telling a listener once it has said to stop', () => {
    const after: number[] = [];
    const quiet = onStandsArrived((tile) => after.push(tile));
    quiet();
    followStandsUnder([cellInside(70, 37)]);
    standsArrived(70, 37, '');
    expect(after).toEqual([]);
    expect(told).toHaveLength(1);
  });
});
