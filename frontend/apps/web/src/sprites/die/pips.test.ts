import { describe, expect, it } from 'vitest';

import { FEEL, about, throwDie } from './physics';
import { LAYOUT, TURNS, layoutShowing, turnedLayout } from './pips';

describe('the pips', () => {
  it('can be turned twenty-four ways, none of them a mirror', () => {
    expect(TURNS).toHaveLength(24);
    expect(new Set(TURNS.map((turn) => turnedLayout(turn).join(''))).size).toBe(24);
  });

  it('keep opposite faces adding to seven, however they are turned', () => {
    for (const turn of TURNS) {
      const numbers = turnedLayout(turn);
      for (let face = 0; face < 6; face += 2) expect(numbers[face]! + numbers[face + 1]!).toBe(7);
    }
  });

  it('can put any number on any face', () => {
    for (let face = 0; face < 6; face++) {
      for (let number = 1; number <= 6; number++) expect(layoutShowing(face, number)[face]).toBe(number);
    }
  });

  it('show the number the game chose on top of a throw, wherever the throw left the die', () => {
    for (let i = 0; i < 40; i++) {
      const path = throwDie(
        {
          at: { x: 0, y: 0, z: 1 },
          velocity: { x: 30, y: i, z: 10 },
          spin: { x: 12, y: -i, z: 3 },
          turn: about({ x: 1, y: 1, z: 1 }, i),
        },
        FEEL,
      );
      const wanted = (i % 6) + 1;
      expect(layoutShowing(path.up, wanted)[path.up]).toBe(wanted);
    }
  });

  it('start from a real die, the one up, the two and the three beside it', () => {
    expect(LAYOUT[4]).toBe(1);
    expect(LAYOUT[0]).toBe(2);
    expect(LAYOUT[2]).toBe(3);
  });
});
