import { describe, expect, it } from 'vitest';

import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import { pulsesAround } from './structuresStruck';

/** A castle whose picture is eight world units wide and tall, hung from the middle of its foot at (100, 100). */
const CASTLE = { place: { x: 100, y: 100 }, anchor: 0.5, wide: 8, tall: 8, shown: true };
const FLAT = { cos: 1, sin: 0, lean: 1 };
const at = (x: number, y: number) => ({ x: x / WORLD_MASTER_WIDTH, y: y / WORLD_MASTER_WIDTH });
const STILL = { x: 0, y: 0, z: 0 };

describe('the pulses that blow a die off a structure', () => {
  it('strike a die low over its picture away from the middle of its base, fast enough to clear it, with a hop', () => {
    // The arc ended two units north of the castle's foot and one east: on its picture.
    const pulses = pulsesAround([CASTLE], at(102, 96), 2, FLAT, 100);
    const pushed = pulses.nudge({ x: 0, y: 0, z: 0.5 }, STILL, 0)!;
    expect(pushed.x).toBeGreaterThan(0);
    expect(pushed.y).toBeLessThan(0);
    expect(pushed.z).toBeGreaterThan(0);
    expect(Math.hypot(pushed.x, pushed.y)).toBeGreaterThan(1);
    expect(pulses.fired()).toBe(1);
  });

  it('send a die right over the middle of its base straight south, out in front of it', () => {
    const pushed = pulsesAround([CASTLE], at(100, 100), 2, FLAT, 100).nudge(
      { x: 0, y: 0, z: 0.5 },
      STILL,
      0,
    )!;
    expect(pushed.x).toBe(0);
    expect(pushed.y).toBeGreaterThan(0);
  });

  it('leave a die high in the air, off the picture, or just struck alone, and strike a few times at most', () => {
    const pulses = pulsesAround([CASTLE], at(100, 96), 2, FLAT, 100);
    expect(pulses.nudge({ x: 0, y: 0, z: 3 }, STILL, 0)).toBeNull();
    expect(pulses.nudge({ x: 10, y: 0, z: 0.5 }, STILL, 0)).toBeNull();
    expect(pulses.nudge({ x: 0, y: 0, z: 0.5 }, STILL, 0)).not.toBeNull();
    expect(pulses.nudge({ x: 0, y: 0, z: 0.5 }, STILL, 0.1)).toBeNull();
    for (const seconds of [1, 2, 3, 4, 5, 6, 7]) pulses.nudge({ x: 0, y: 0, z: 0.5 }, STILL, seconds);
    expect(pulses.fired()).toBe(6);
  });

  it('look at no structure too far off to reach, nor one not drawn standing', () => {
    expect(pulsesAround([CASTLE], at(5000, 100), 2, FLAT, 100).near).toBe(0);
    expect(pulsesAround([{ ...CASTLE, shown: false }], at(100, 96), 2, FLAT, 100).near).toBe(0);
  });
});
