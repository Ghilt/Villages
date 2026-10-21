import { describe, expect, it } from 'vitest';

import { bridgeKindByte, roadKindByte } from '@villages/world/build';

import { bridgesAmong, deckOf } from './bridges';

const stone = { ax: 100, ay: 200, bx: 103.25, by: 203, kind: bridgeKindByte('stone', 'uv') };

describe('the bridges among the roads', () => {
  it('are the pieces whose kind is a bridge, with their kind, axis, middle and span', () => {
    const [bridge, ...rest] = bridgesAmong([stone, { ...stone, ax: 90, kind: roadKindByte('road') }]);
    expect(rest).toEqual([]);
    expect(bridge).toMatchObject({ kind: 'stone', axis: 'uv', middle: { x: 101.625, y: 201.5 } });
    expect(bridge!.span).toBeCloseTo(Math.hypot(3.25, 3), 9);
    expect(Math.hypot(bridge!.along.x, bridge!.along.y)).toBeCloseTo(1, 9);
  });

  it('are named by their middle, so the same bridge from two tiles is one', () => {
    const [one] = bridgesAmong([stone]);
    const [other] = bridgesAmong([{ ...stone }]);
    expect(one!.id).toBe(other!.id);
  });

  it('stand on the strip of their deck, its corners round it, the one nearest the camera first', () => {
    const [bridge] = bridgesAmong([stone]);
    const deck = deckOf(bridge!);
    expect(deck).toHaveLength(4);
    expect(Math.max(...deck.map((corner) => corner.y))).toBe(deck[0].y);
    // As long as the bridge, and a deck wide.
    expect(
      Math.hypot(deck[1].x - deck[0].x, deck[1].y - deck[0].y) *
        Math.hypot(deck[2].x - deck[1].x, deck[2].y - deck[1].y),
    ).toBeCloseTo(bridge!.span * 1.2, 6);
    const middle = deck.reduce((sum, corner) => ({ x: sum.x + corner.x / 4, y: sum.y + corner.y / 4 }), {
      x: 0,
      y: 0,
    });
    expect(middle.x).toBeCloseTo(bridge!.middle.x, 9);
    expect(middle.y).toBeCloseTo(bridge!.middle.y, 9);
  });
});
