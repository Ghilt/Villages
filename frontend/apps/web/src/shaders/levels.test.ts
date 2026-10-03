import { describe, expect, it } from 'vitest';

import { drawnAt, sayLevel, setShadersOn, shadersStore } from './levels';

describe('the shaders', () => {
  it('are drawn at their own level until the switch over them all is off, which keeps the levels', () => {
    expect(drawnAt('low')).toBe('low');
    setShadersOn(false);
    expect(shadersStore.get().on).toBe(false);
    expect(drawnAt('high')).toBe('off');
    setShadersOn(true);
    expect(drawnAt('high')).toBe('high');
  });

  it('say a level as how much of the screen and how often', () => {
    expect(sayLevel('high', { resolution: 1, framesPerSecond: 30 })).toBe(
      "high, all of the screen's pixels at 30 frames a second",
    );
    expect(sayLevel('low', { resolution: 0.5, framesPerSecond: 15 })).toBe(
      "low, 25% of the screen's pixels at 15 frames a second",
    );
    expect(sayLevel('off', null)).toBe('off');
  });
});
