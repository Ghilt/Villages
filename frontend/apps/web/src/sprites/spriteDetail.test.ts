import { describe, expect, it } from 'vitest';

import {
  DETAIL_FROM_ZOOM,
  MARKER_HEIGHT,
  detailForMark,
  detailForZoom,
  markerHeightForZoom,
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

  it('hides nothing for distance while the window is showing everything', () => {
    expect(detailForZoom(0, true)).toBe('dot');
    expect(detailForZoom(2, true)).toBe('dot');
    // Only the floor moves: the thresholds above it are what they were, so a close house is unchanged.
    expect(detailForZoom(DETAIL_FROM_ZOOM.marker, true)).toBe('marker');
  });
});

describe('one mark in particular', () => {
  it('is drawn like the rest when nothing spares it', () => {
    expect(detailForMark(2)).toBe('hidden');
    expect(detailForMark(DETAIL_FROM_ZOOM.dot)).toBe('dot');
    expect(detailForMark(DETAIL_FROM_ZOOM.marker)).toBe('marker');
  });

  it('is a dot rather than nothing when it is spared: the eye keeps your own in sight', () => {
    expect(detailForMark(2, { spared: true })).toBe('dot');
    expect(detailForMark(0, { spared: true })).toBe('dot');
  });

  it('is no larger for being spared, because the eye is about distance and not about size', () => {
    expect(detailForMark(DETAIL_FROM_ZOOM.dot, { spared: true })).toBe('dot');
    expect(detailForMark(DETAIL_FROM_ZOOM.marker, { spared: true })).toBe('marker');
  });

  it('is drawn when the window shows everything, spared or not', () => {
    expect(detailForMark(2, { everything: true })).toBe('dot');
    expect(detailForMark(2, { everything: true, spared: true })).toBe('dot');
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
