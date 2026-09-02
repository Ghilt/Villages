import { describe, expect, it } from 'vitest';

import { CAMERA, DEFAULT_STYLE_URL, resolveStyleUrl } from './mapConfig';

describe('the map style', () => {
  it('falls back to the default when nothing is configured', () => {
    expect(resolveStyleUrl({})).toBe(DEFAULT_STYLE_URL);
  });

  it('uses a configured style, so that a provider can be swapped without a code change', () => {
    expect(resolveStyleUrl({ VITE_MAP_STYLE_URL: 'https://example.test/style.json' })).toBe(
      'https://example.test/style.json',
    );
  });

  it('treats a blank setting as absent', () => {
    expect(resolveStyleUrl({ VITE_MAP_STYLE_URL: '   ' })).toBe(DEFAULT_STYLE_URL);
  });
});

describe('the camera', () => {
  it('opens inside the range it allows', () => {
    expect(CAMERA.initialZoom).toBeGreaterThanOrEqual(CAMERA.minZoom);
    expect(CAMERA.initialZoom).toBeLessThanOrEqual(CAMERA.maxZoom);
  });

  it('starts somewhere on the map', () => {
    expect(Math.abs(CAMERA.center.lat)).toBeLessThan(85);
    expect(Math.abs(CAMERA.center.lng)).toBeLessThanOrEqual(180);
  });
});
