import { describe, expect, it } from 'vitest';

import { GROUND_LATTICE, alongU, alongV, frameOf } from '@villages/world';
import { bridgeKindByte, encodeRoads, roadKindByte } from '@villages/world/build';
import { decodeRoads } from '@villages/world';

import type { GroundOf } from './paths';
import { piecesHeld, wearRoads } from './roads';
import { WORKED } from './worked';
import { diamondKey, diamondOf } from './workedGround';

const FRAME = frameOf(GROUND_LATTICE);
const WIDTHS = { track: 0.7, road: 1, trunk: 1.4, bridge: 1 };
const land: GroundOf = () => 'land';
const road = { ax: 1000, ay: 2000, bx: 1012, by: 2006.5, kind: roadKindByte('road') };

/** The diamond a point of world space is in. */
const under = (x: number, y: number) =>
  diamondKey(Math.floor(alongU(FRAME, x, y)), Math.floor(alongV(FRAME, x, y)));

describe('the ground the roads keep clear', () => {
  it('keeps every diamond along a piece clear as the wayside, one after another with no gap', () => {
    const worn = wearRoads([road], WIDTHS, 1, land, null);
    for (let step = 0; step <= 40; step += 1) {
      const x = road.ax + ((road.bx - road.ax) * step) / 40;
      const y = road.ay + ((road.by - road.ay) * step) / 40;
      expect(worn.get(under(x, y))).toBe(WORKED.wayside);
    }
    // And not far off it.
    expect(worn.has(under(road.ax + 6, road.ay - 6))).toBe(false);
  });

  it('is wider for a trunk, and wider again for the lever', () => {
    const trunk = { ...road, kind: roadKindByte('trunk') };
    // At the least width every grade wears the same line; twice as wide, a trunk wears more than a track.
    const track = wearRoads([{ ...road, kind: roadKindByte('track') }], WIDTHS, 2, land, null).size;
    expect(wearRoads([trunk], WIDTHS, 2, land, null).size).toBeGreaterThan(track);
    expect(wearRoads([trunk], WIDTHS, 2, land, null).size).toBeGreaterThan(
      wearRoads([trunk], WIDTHS, 1, land, null).size,
    );
  });

  it('wears nothing on water, nothing for a bridge, and nothing yet where the ground is not known', () => {
    const river: GroundOf = (u) => (u % 3 === 0 ? 'river' : 'land');
    for (const key of wearRoads([road], WIDTHS, 1, river, null).keys())
      expect(diamondOf(key).u % 3).not.toBe(0);
    const bridge = { ...road, kind: bridgeKindByte('u') };
    expect(wearRoads([bridge], WIDTHS, 1, land, null).size).toBe(0);
    expect(wearRoads([road], WIDTHS, 1, () => null, null).size).toBe(0);
  });

  it('stops where the revealed ground stops', () => {
    const east = (x: number) => x < 1006;
    const worn = wearRoads([road], WIDTHS, 1, land, east);
    expect(worn.size).toBeGreaterThan(0);
    expect(worn.has(under(road.ax + 1, road.ay + 0.5))).toBe(true);
    expect(worn.has(under(road.bx - 1, road.by - 0.5))).toBe(false);
  });

  it('holds each piece once, though it is sent in every tile its reach touches', () => {
    const bytes = encodeRoads([road], 3, 7, 256, () => 1);
    const once = decodeRoads(bytes, 3, 7, 256);
    const again = decodeRoads(
      encodeRoads([road], 4, 7, 256, () => 1),
      4,
      7,
      256,
    );
    expect(piecesHeld([once, again])).toHaveLength(1);
  });
});
