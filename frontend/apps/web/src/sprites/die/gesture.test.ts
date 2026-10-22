import { describe, expect, it } from 'vitest';

import { STILL_MS, isThrow, speedAtRelease } from './gesture';

describe('letting go of the die', () => {
  it('reads a flick as the speed it was moving at', () => {
    const samples = [0, 16, 32, 48, 64].map((t) => ({ t, x: t * 2, y: -t }));
    const speed = speedAtRelease(samples, 64);
    expect(speed.x).toBeCloseTo(2000, 6);
    expect(speed.y).toBeCloseTo(-1000, 6);
    expect(isThrow(speed, 300)).toBe(true);
  });

  it('reads a hand that stopped before letting go as held still', () => {
    const samples = [0, 16, 32].map((t) => ({ t, x: t * 5, y: 0 }));
    expect(speedAtRelease(samples, 32 + STILL_MS + 1)).toEqual({ x: 0, y: 0 });
  });

  it('reads a slow drift as a drop', () => {
    const samples = [0, 16, 32, 48].map((t) => ({ t, x: t * 0.1, y: 0 }));
    expect(isThrow(speedAtRelease(samples, 48), 300)).toBe(false);
  });

  it('is not thrown by one sample that jumped', () => {
    const samples = [0, 16, 32, 48, 64].map((t) => ({ t, x: t === 32 ? 40 : 0, y: 0 }));
    expect(isThrow(speedAtRelease(samples, 64), 300)).toBe(false);
  });
});
