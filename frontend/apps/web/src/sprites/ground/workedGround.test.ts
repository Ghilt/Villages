import { describe, expect, it } from 'vitest';
import { GROUND_LATTICE, alongU, alongV, frameOf } from '@villages/world';

import { toMercator } from '../../geometry/cameraMath';
import { onACorner } from '../../geometry/footing';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import type { MapSprite } from '../SpriteRenderer';
import { WORKED } from './worked';
import { RING, diamondKey, diamondOf, workedGround, yardOf } from './workedGround';
import type { Yard } from './workedGround';

const castle: Yard = { id: 'structure:castle', u: 1000, v: 400, side: 6, ruin: false };
// Close enough that each one's ring runs over the other's footprint.
const mill: Yard = { id: 'structure:mill', u: 1003, v: 402, side: 2, ruin: false };
const far: Yard = { id: 'structure:far', u: 5000, v: -300, side: 4, ruin: false };

/** The worked ground as a sorted list, so two can be compared whatever order they were built in. */
const listed = (worked: Map<number, number>) => [...worked.entries()].sort(([a], [b]) => a - b);

describe('worked ground', () => {
  it('wears every diamond of a footprint, running back from the corner the foot stands on', () => {
    const worked = workedGround([castle]);
    for (let u = castle.u - castle.side; u < castle.u; u += 1) {
      for (let v = castle.v - castle.side; v < castle.v; v += 1) {
        expect(worked.get(diamondKey(u, v))).toBe(WORKED.footprint);
      }
    }
    expect([...worked.values()].filter((kind) => kind === WORKED.footprint)).toHaveLength(36);
  });

  it('wears a ragged ring round it, never further out than the ring reaches', () => {
    const worked = workedGround([castle]);
    const ring = [...worked.entries()]
      .filter(([, kind]) => kind === WORKED.ring)
      .map(([key]) => diamondOf(key));
    // Against the walls nearly every diamond; three out, few: neither none nor all of the band.
    expect(ring.length).toBeGreaterThan(30);
    expect(ring.length).toBeLessThan((castle.side + 2 * RING) ** 2 - castle.side ** 2);
    for (const { u, v } of ring) {
      expect(u).toBeGreaterThanOrEqual(castle.u - castle.side - RING);
      expect(u).toBeLessThan(castle.u + RING);
      expect(v).toBeGreaterThanOrEqual(castle.v - castle.side - RING);
      expect(v).toBeLessThan(castle.v + RING);
    }
  });

  it('is the same from the same buildings, whatever order they come in', () => {
    expect(listed(workedGround([castle, mill, far]))).toEqual(listed(workedGround([castle, mill, far])));
    expect(listed(workedGround([far, mill, castle]))).toEqual(listed(workedGround([castle, mill, far])));
  });

  it('comes from the buildings alone: none, nothing; one taken away takes its own yard and no other', () => {
    expect(workedGround([]).size).toBe(0);

    const without = workedGround([castle, mill]);
    const alone = workedGround([castle, mill, far]);
    for (const [key, kind] of without) {
      expect(alone.get(key)).toBe(kind);
    }
    const farOnly = workedGround([far]);
    expect(listed(alone).filter(([key]) => !without.has(key))).toEqual(listed(farOnly));
  });

  it('takes the stronger where two yards meet: a footprint over a neighbour’s ring, whichever comes first', () => {
    for (const both of [workedGround([castle, mill]), workedGround([mill, castle])]) {
      for (const yard of [castle, mill]) {
        for (let u = yard.u - yard.side; u < yard.u; u += 1) {
          for (let v = yard.v - yard.side; v < yard.v; v += 1) {
            expect(both.get(diamondKey(u, v))).toBe(WORKED.footprint);
          }
        }
      }
    }
  });

  it('wears less under a ruin, and as a ruin', () => {
    const ruin = workedGround([{ ...castle, ruin: true }]);
    const standing = workedGround([castle]);
    expect(ruin.size).toBeLessThan(standing.size);
    expect(new Set(ruin.values())).toEqual(new Set([WORKED.ruinFootprint, WORKED.ruinRing]));
  });

  it('keeps every diamond of the world apart in its key', () => {
    for (const [u, v] of [
      [0, 0],
      [43800, -14363],
      [-1, 29454],
    ] as const) {
      expect(diamondOf(diamondKey(u, v))).toEqual({ u, v });
    }
  });
});

describe("a structure's yard", () => {
  const sprite = (structure: MapSprite['structure'], kind: MapSprite['kind'] = 'structure'): MapSprite => ({
    id: 'structure:a',
    at: onACorner({ lng: 18.07, lat: 59.33 }),
    tint: 0xffffff,
    kind,
    ...(structure === undefined ? {} : { structure }),
  });

  it('stands on the corner its foot is drawn on, as many diamonds a side as the catalogue says', () => {
    const yard = yardOf(sprite({ picture: 'castle@european', footprint: 6 }))!;
    const at = toMercator(sprite(undefined).at);
    const frame = frameOf(GROUND_LATTICE);
    expect(yard.u).toBeCloseTo(alongU(frame, at.x * WORLD_MASTER_WIDTH, at.y * WORLD_MASTER_WIDTH), 6);
    expect(yard.v).toBeCloseTo(alongV(frame, at.x * WORLD_MASTER_WIDTH, at.y * WORLD_MASTER_WIDTH), 6);
    expect(yard).toMatchObject({ id: 'structure:a', side: 6, ruin: false });
  });

  it('is a ruin’s for a ruin, and nobody’s for a person or a building the catalogue has not sized', () => {
    expect(yardOf(sprite({ picture: 'a ruin@european', footprint: 4, ruin: true }))?.ruin).toBe(true);
    expect(yardOf(sprite({ picture: 'castle@european' }))).toBeNull();
    expect(yardOf(sprite(undefined, 'character'))).toBeNull();
  });
});
