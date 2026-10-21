import { describe, expect, it } from 'vitest';
import { GROUND_LATTICE, frameOf, worldXOf, worldYOf } from '@villages/world';

import { fromMercator, pixelsPerWorldUnit, toScreen } from '../geometry/cameraMath';
import type { CameraView } from '../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../geometry/world';
import { ringOn } from './ringPlace';
import { footprintAt } from './standing/footprint';

const FRAME = frameOf(GROUND_LATTICE);
/** A corner of the diamonds, as a place, and where it is on the ground. */
const ground = { x: worldXOf(FRAME, 9000, 5000), y: worldYOf(FRAME, 9000, 5000) };
const at = fromMercator({ x: ground.x / WORLD_MASTER_WIDTH, y: ground.y / WORLD_MASTER_WIDTH });
const VIEW: CameraView = { center: at, zoom: 10, width: 800, height: 600, pitch: 45, bearing: 0 };
const foot = toScreen(at, VIEW);
const scale = pixelsPerWorldUnit(VIEW.zoom);

describe('the ring under the selected mark', () => {
  it("lies round a building's footprint, a circle on the ground squashed as the camera squashes it", () => {
    const footprint = footprintAt(ground, 4);
    const ring = ringOn({ foot, at, footprint, tall: 8, blend: 1, signHeight: 0 }, VIEW);

    // Its middle is where the footprint's middle lands, behind the foot the building is hung from.
    const middle = {
      x: footprint.reduce((sum, corner) => sum + corner.x, 0) / 4 / WORLD_MASTER_WIDTH,
      y: footprint.reduce((sum, corner) => sum + corner.y, 0) / 4 / WORLD_MASTER_WIDTH,
    };
    const there = toScreen(fromMercator(middle), VIEW);
    expect(ring.x).toBeCloseTo(there.x, 3);
    expect(ring.y).toBeCloseTo(there.y, 3);
    expect(ring.y).toBeLessThan(foot.y);
    // It reaches a little past the furthest corner.
    expect(ring.across).toBeCloseTo(2 * Math.SQRT2 * 1.12 * scale);
    expect(ring.lean).toBeCloseTo(Math.cos(Math.PI / 4));
    expect(ring.onTheGround).toBe(true);
  });

  it('lies round a person on the ground they stand on, and round a sign far out', () => {
    const person = ringOn({ foot, at, footprint: null, tall: 3, blend: 1, signHeight: 0 }, VIEW);
    expect(person.x).toBeCloseTo(foot.x);
    expect(person.y).toBeCloseTo(foot.y);
    expect(person.across).toBeCloseTo(1.4 * scale);

    const sign = ringOn(
      { foot, at, footprint: footprintAt(ground, 4), tall: 8, blend: 0, signHeight: 40 },
      VIEW,
    );
    expect(sign.x).toBeCloseTo(foot.x);
    expect(sign.y).toBeCloseTo(foot.y);
    expect(sign.across).toBeCloseTo(34);
    expect(sign.onTheGround).toBe(false);
  });

  it('eases between the two as the mark trades its forms', () => {
    const footprint = footprintAt(ground, 4);
    const near = ringOn({ foot, at, footprint, tall: 8, blend: 1, signHeight: 40 }, VIEW);
    const half = ringOn({ foot, at, footprint, tall: 8, blend: 0.5, signHeight: 40 }, VIEW);

    expect(half.y).toBeCloseTo((near.y + foot.y) / 2);
    expect(half.across).toBeCloseTo((near.across + 34) / 2);
  });
});
