import { describe, expect, it } from 'vitest';

import {
  DETAIL_FROM_ZOOM,
  IDLE_MOTION,
  MARKER_HEIGHT,
  detailForZoom,
  idleMotionAt,
  markerHeightForZoom,
  phaseFor,
} from './spriteDetail';

describe('the level of detail', () => {
  it('draws nothing when the whole continent is in view', () => {
    expect(detailForZoom(2)).toBe('hidden');
    expect(detailForZoom(DETAIL_FROM_ZOOM.dot - 0.01)).toBe('hidden');
  });

  it('draws a dot from the moment houses are worth showing', () => {
    expect(detailForZoom(DETAIL_FROM_ZOOM.dot)).toBe('dot');
    expect(detailForZoom(DETAIL_FROM_ZOOM.marker - 0.01)).toBe('dot');
  });

  it('draws a marker once a house is close enough to have a face', () => {
    expect(detailForZoom(DETAIL_FROM_ZOOM.marker)).toBe('marker');
    expect(detailForZoom(14)).toBe('marker');
  });
});

describe('the marker size', () => {
  it('grows with the zoom', () => {
    expect(markerHeightForZoom(9)).toBeGreaterThan(markerHeightForZoom(8));
    expect(markerHeightForZoom(12)).toBeGreaterThan(markerHeightForZoom(11));
  });

  it('stops growing outside its range', () => {
    expect(markerHeightForZoom(4)).toBeCloseTo(MARKER_HEIGHT.inPixels.small, 9);
    expect(markerHeightForZoom(18)).toBeCloseTo(MARKER_HEIGHT.inPixels.large, 9);
  });
});

describe('the idle motion', () => {
  it('gives every house its own place in the cycle', () => {
    expect(phaseFor('house-a')).not.toBeCloseTo(phaseFor('house-b'), 3);
  });

  it('gives the same house the same place every time, across reloads', () => {
    expect(phaseFor('house-a')).toBe(phaseFor('house-a'));
    expect(phaseFor('')).toBeGreaterThanOrEqual(0);
  });

  it('stays inside the cycle', () => {
    for (const id of ['a', 'seat-of-the-north', '00000000-0000-0000-0000-000000000000']) {
      expect(phaseFor(id)).toBeGreaterThanOrEqual(0);
      expect(phaseFor(id)).toBeLessThan(Math.PI * 2);
    }
  });

  it('never carries a sprite further than its amplitude', () => {
    for (let ms = 0; ms < IDLE_MOTION.periodMs * 2; ms += 37) {
      const motion = idleMotionAt(ms, 1.1);
      expect(Math.abs(motion.lift)).toBeLessThanOrEqual(IDLE_MOTION.liftPixels + 1e-9);
      expect(Math.abs(motion.tilt)).toBeLessThanOrEqual(IDLE_MOTION.swayRadians + 1e-9);
    }
  });

  it('repeats once a period has passed', () => {
    const now = idleMotionAt(400, 0.7);
    const later = idleMotionAt(400 + IDLE_MOTION.periodMs, 0.7);

    expect(later.lift).toBeCloseTo(now.lift, 9);
    expect(later.tilt).toBeCloseTo(now.tilt, 9);
  });
});
