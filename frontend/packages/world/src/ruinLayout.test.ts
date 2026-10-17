import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ruinsIn } from './ruinLayout.ts';
import type { RuinPiece, RuinsGround } from './ruinLayout.ts';
import { RUIN_PIECES, parseRuins } from './ruins.ts';
import type { StandChunk } from './stands.ts';

const RUINS = parseRuins(readFileSync(new URL('../../../../world/ruins.json', import.meta.url), 'utf8'));
const SIDE = 32768;
const LAND = 21;
const WATER = 0;

/** Towns as the layout gets them from the wire: middle, reach, culture, fullness, seed. */
function chunkOf(towns: readonly { x: number; y: number; reach: number; culture: number; seed?: number }[]) {
  return {
    count: towns.length,
    x: Float32Array.from(towns.map((one) => one.x)),
    y: Float32Array.from(towns.map((one) => one.y)),
    reach: Float32Array.from(towns.map((one) => one.reach)),
    dominant: Uint8Array.from(towns.map((one) => one.culture)),
    thickness: Float32Array.from(towns.map(() => 0.55)),
    seed: Uint8Array.from(towns.map((one) => one.seed ?? 7)),
  } satisfies StandChunk;
}

const groundOf = (classAt: (x: number, y: number) => number = () => LAND): RuinsGround => ({
  look: { ...RUINS.look, ring: RUINS.size.ring },
  side: SIDE,
  classAt,
  water: (terrain) => terrain === WATER,
});

const PARIS = { x: 16540, y: 11000, reach: 38, culture: 0 };
const key = (piece: RuinPiece) => `${piece.x.toFixed(4)},${piece.y.toFixed(4)},${piece.piece}`;
const around = (town: { x: number; y: number }, half: number) =>
  [town.x - half, town.y - half, town.x + half, town.y + half] as const;

describe('a ruined city laid out from its record', () => {
  it('is the same every time it is laid out', () => {
    const [a, b, c, d] = around(PARIS, 40);
    const once = ruinsIn(a, b, c, d, chunkOf([PARIS]), groundOf());
    const again = ruinsIn(a, b, c, d, chunkOf([PARIS]), groundOf());
    expect(once.length).toBeGreaterThan(50);
    expect(again).toEqual(once);
  });

  it('holds every piece once among the cells of a grid, whatever the grid', () => {
    const [a, b, c, d] = around(PARIS, 40);
    const whole = ruinsIn(a, b, c, d, chunkOf([PARIS]), groundOf())
      .map(key)
      .sort();
    const quarters: string[] = [];
    for (const [x0, x1] of [
      [a, PARIS.x],
      [PARIS.x, c],
    ] as const) {
      for (const [y0, y1] of [
        [b, PARIS.y],
        [PARIS.y, d],
      ] as const) {
        quarters.push(...ruinsIn(x0, y0, x1, y1, chunkOf([PARIS]), groundOf()).map(key));
      }
    }
    expect(quarters.sort()).toEqual(whole);
  });

  it('draws a thinner city as a subset of a fuller one', () => {
    const [a, b, c, d] = around(PARIS, 40);
    const full = new Set(ruinsIn(a, b, c, d, chunkOf([PARIS]), groundOf(), 1).map(key));
    const thin = ruinsIn(a, b, c, d, chunkOf([PARIS]), groundOf(), 0.4).map(key);
    expect(thin.length).toBeLessThan(full.size);
    expect(thin.filter((one) => !full.has(one))).toEqual([]);
  });

  it('stands no piece in water, by its foot or either half of its width', () => {
    const river = (x: number) => x > PARIS.x - 3 && x < PARIS.x + 3;
    const [a, b, c, d] = around(PARIS, 40);
    const pieces = ruinsIn(
      a,
      b,
      c,
      d,
      chunkOf([PARIS]),
      groundOf((x) => (river(x) ? WATER : LAND)),
    );
    expect(pieces.length).toBeGreaterThan(30);
    const wet = pieces.filter((one) => {
      const half = RUINS.look.pieces[one.piece]!.width / 2;
      return river(one.x) || river(one.x - half) || river(one.x + half);
    });
    expect(wet).toEqual([]);
  });

  it('builds within its outline, halls only in its core, and a wall about it', () => {
    const [a, b, c, d] = around(PARIS, 40);
    const pieces = ruinsIn(a, b, c, d, chunkOf([PARIS]), groundOf());
    const built = PARIS.reach / (1 + RUINS.size.ring);
    const out = (one: RuinPiece) => Math.hypot(one.x - PARIS.x, one.y - PARIS.y) / built;
    const loosest = Math.sqrt(1 + RUINS.look.layout.ragged / 2);
    expect(Math.max(...pieces.map(out))).toBeLessThan(loosest);
    const halls = pieces.filter((one) => RUIN_PIECES[one.piece] === 'hall');
    expect(halls.length).toBeGreaterThan(0);
    expect(Math.max(...halls.map(out))).toBeLessThan(RUINS.look.layout.core * loosest);
    expect(pieces.filter((one) => RUIN_PIECES[one.piece] === 'wall').length).toBeGreaterThan(10);
  });

  it('gives a bigger town more ruins than a smaller one', () => {
    const big = ruinsIn(...around(PARIS, 60), chunkOf([PARIS]), groundOf());
    const small = ruinsIn(...around(PARIS, 60), chunkOf([{ ...PARIS, reach: 8 }]), groundOf());
    expect(big.length).toBeGreaterThan(small.length * 5);
    expect(small.length).toBeGreaterThan(0);
  });

  it('gives a lot where two towns meet to the one it lies furthest inside, and lays out each once', () => {
    const other = { x: PARIS.x + 30, y: PARIS.y, reach: 20, culture: 1 };
    const both = chunkOf([PARIS, other]);
    const pieces = ruinsIn(...around(PARIS, 70), both, groundOf());
    const out = (town: { x: number; y: number; reach: number }, one: RuinPiece) =>
      Math.hypot(one.x - town.x, one.y - town.y) / (town.reach / (1 + RUINS.size.ring));
    const wrong = pieces.filter((one) =>
      one.culture === 0 ? out(PARIS, one) > out(other, one) : out(other, one) > out(PARIS, one),
    );
    expect(wrong).toEqual([]);
    expect(new Set(pieces.map(key)).size).toBe(pieces.length);
  });

  it('lays a town out the same from the copy of its record across the edge of the world', () => {
    const near = { x: 12, y: 9000, reach: 30, culture: 2 };
    const copy = { ...near, x: near.x + SIDE };
    const here = ruinsIn(-40, near.y - 40, 60, near.y + 40, chunkOf([near]), groundOf());
    const there = ruinsIn(SIDE - 40, near.y - 40, SIDE + 60, near.y + 40, chunkOf([copy]), groundOf());
    expect(there.map((one) => ({ ...one, x: one.x - SIDE }))).toEqual(
      here.map((one) => ({ ...one, x: expect.closeTo(one.x, 6) as unknown as number })),
    );
  });

  it('lays a square town of its culture out to the four quarters, unturned', () => {
    const pekin = { x: 26000, y: 12000, reach: 52, culture: 2 };
    const pieces = ruinsIn(...around(pekin, 70), chunkOf([pekin]), groundOf());
    const walls = pieces.filter((one) => RUIN_PIECES[one.piece] === 'wall');
    // A square wall stands as far out along the axes as at the corners: some piece of it near each corner.
    const built = pekin.reach / (1 + RUINS.size.ring);
    const nearCorner = walls.filter(
      (one) => Math.abs(Math.abs(one.x - pekin.x) - Math.abs(one.y - pekin.y)) < built * 0.2,
    );
    expect(nearCorner.length).toBeGreaterThan(0);
    expect(Math.max(...walls.map((one) => Math.hypot(one.x - pekin.x, one.y - pekin.y)))).toBeGreaterThan(
      built,
    );
  });
});
