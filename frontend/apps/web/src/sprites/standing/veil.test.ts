import { describe, expect, it } from 'vitest';

import { FADED, FADE_MS, createVeil } from './veil';

describe('the trees faded out of the way of what the pointer is over', () => {
  it('fade over a moment, and stay faded while the pointer stays', () => {
    const tree = { alpha: 1 };
    const veil = createVeil<typeof tree>();

    expect(veil.step(new Set([tree]), FADE_MS / 4)).toBe(true);
    expect(tree.alpha).toBeCloseTo(0.75);
    expect(veil.step(new Set([tree]), FADE_MS)).toBe(false);
    expect(tree.alpha).toBeCloseTo(FADED);
    expect(veil.step(new Set([tree]), FADE_MS)).toBe(false);
    expect(tree.alpha).toBeCloseTo(FADED);
  });

  it('come back to just what the scenery says once the pointer has gone, even if it faded them meanwhile', () => {
    const tree = { alpha: 0.6 };
    const veil = createVeil<typeof tree>();
    veil.step(new Set([tree]), FADE_MS);
    expect(tree.alpha).toBeCloseTo(0.6 * FADED);

    // The scenery fading the tree's whole kind in while it is faded: its own alpha is that now.
    tree.alpha = 0.9;
    veil.step(new Set([tree]), 0);
    expect(tree.alpha).toBeCloseTo(0.9 * FADED);

    expect(veil.step(new Set(), FADE_MS / 2)).toBe(true);
    veil.step(new Set(), FADE_MS);
    expect(tree.alpha).toBe(0.9);
    // Let go of: the scenery's own writes stand untouched from now on.
    tree.alpha = 0.3;
    veil.step(new Set(), FADE_MS);
    expect(tree.alpha).toBe(0.3);
  });
});
