import { describe, expect, it } from 'vitest';

import { GROUND_LATTICE, alongU, alongV, frameOf, onStreet, settlementIn } from '@villages/world';
import type { FootingOf, LaidOut } from '@villages/world';

import { toMercator } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import type { MapSprite } from '../SpriteRenderer';
import { rememberingWornTogether, settlementGround } from './settlementGround';
import { WORKED } from './worked';
import { diamondKey, workedGround, yardOf } from './workedGround';

const land: FootingOf = () => 'land';
/** A lake over the north of the square, the side of lower v. */
const shore: FootingOf = (_u, v) => (v < 396 ? 'water' : 'land');

function laid(id: string, level: number, ground: FootingOf, u = 1000, v = 400): LaidOut {
  const made = settlementIn(id, 'village', level, 'european', u, v, ground);
  if (made === 'unknown') throw new Error('the ground was all known');
  return made;
}

const STOCKHOLM = { lng: 18.07, lat: 59.33 };

function sprite(id: string, layout: LaidOut): MapSprite {
  return {
    id,
    kind: 'structure',
    at: STOCKHOLM,
    tint: 0xffffff,
    structure: {
      picture: 'village@european',
      footprint: layout.square.side,
      settlement: { type: 'village', level: 2, culture: 'european' },
      laid: layout,
    },
  };
}

const kindAt = (worked: ReadonlyMap<number, number>, u: number, v: number) =>
  worked.get(diamondKey(u, v)) ?? 0;

describe("a settlement's ground", () => {
  it('wears its square, its streets as a road and every building on its base', () => {
    const layout = laid('structure:a', 2, land);
    const { worked } = settlementGround([sprite('structure:a', layout)], land);
    const { square } = layout;
    for (let u = square.fromU + 1; u < square.fromU + square.side - 1; u += 1) {
      for (let v = square.fromV + 1; v < square.fromV + square.side - 1; v += 1) {
        expect(kindAt(worked, u, v)).toBeGreaterThan(0);
        if (onStreet(square, u, v)) expect(kindAt(worked, u, v)).toBe(WORKED.road);
      }
    }
    expect(layout.buildings.length).toBeGreaterThan(3);
    for (const one of layout.buildings) {
      expect(kindAt(worked, one.u - 1, one.v - 1)).toBe(WORKED.footprint);
      expect(kindAt(worked, one.u - one.side, one.v - one.side)).toBe(WORKED.footprint);
    }
  });

  it('wears nothing on water', () => {
    const layout = laid('structure:b', 3, shore);
    const { worked } = settlementGround([sprite('structure:b', layout)], shore);
    expect(worked.size).toBeGreaterThan(100);
    for (const key of worked.keys()) {
      const v = (key % 262144) - 65536;
      expect(v).toBeGreaterThanOrEqual(396);
    }
  });

  it('walks a lane from every building to a street, round the others', () => {
    const layout = laid('structure:c', 3, land);
    const { worked, lanes } = settlementGround([sprite('structure:c', layout)], land);
    expect(lanes).toBeGreaterThan(0);
    const walkable = (u: number, v: number) => kindAt(worked, u, v) >= WORKED.path;
    for (const one of layout.buildings) {
      // From the building's base over worn ground stronger than the settlement's own, to a street.
      const seen = new Set<number>([diamondKey(one.u - 1, one.v - 1)]);
      let edge = [{ u: one.u - 1, v: one.v - 1 }];
      let reached = false;
      while (edge.length > 0 && !reached) {
        const next: typeof edge = [];
        for (const here of edge) {
          for (const [du, dv] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const at = { u: here.u + du, v: here.v + dv };
            const key = diamondKey(at.u, at.v);
            if (seen.has(key) || !walkable(at.u, at.v)) continue;
            if (onStreet(layout.square, at.u, at.v)) reached = true;
            seen.add(key);
            next.push(at);
          }
        }
        edge = next;
      }
      expect(reached).toBe(true);
    }
  });

  it('is the same whatever order the settlements come in', () => {
    const a = sprite('structure:a', laid('structure:a', 2, land));
    const b = sprite('structure:b', laid('structure:b', 3, land, 1009, 404));
    const one = settlementGround([a, b], land).worked;
    const other = settlementGround([b, a], land).worked;
    expect([...one.entries()].sort()).toEqual([...other.entries()].sort());
  });

  it('is one yard to the paths, worn by its own ground and not as a footprint', () => {
    const at = toMercator(STOCKHOLM);
    const frame = frameOf(GROUND_LATTICE);
    const u = Math.round(alongU(frame, at.x * WORLD_MASTER_WIDTH, at.y * WORLD_MASTER_WIDTH));
    const v = Math.round(alongV(frame, at.x * WORLD_MASTER_WIDTH, at.y * WORLD_MASTER_WIDTH));
    const layout = laid('structure:a', 2, land, u, v);
    const yard = yardOf(sprite('structure:a', layout));
    expect(yard?.settlement).toBe(true);
    expect(yard?.u).toBe(layout.square.fromU + layout.square.side);
    expect(yard?.v).toBe(layout.square.fromV + layout.square.side);
    expect(workedGround([yard!]).size).toBe(0);
  });

  it('keeps the very same merged ground while both halves are the same', () => {
    const together = rememberingWornTogether();
    const first = new Map([[1, WORKED.ring]]);
    const second = new Map([
      [1, WORKED.settlement],
      [2, WORKED.road],
    ]);
    const once = together(first, second);
    expect(together(first, second)).toBe(once);
    expect(once.get(1)).toBe(WORKED.ring);
    expect(together(first, new Map())).toBe(first);
  });
});
