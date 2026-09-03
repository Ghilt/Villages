import { describe, expect, it } from 'vitest';

import { CAMERA, EARTH_STYLE_URL, resolveStyle } from './mapConfig';

describe('the map style', () => {
  it('is our own world when nothing is configured', () => {
    const style = resolveStyle({});

    expect(typeof style).not.toBe('string');
    expect(Object.keys((style as { sources: object }).sources).sort()).toEqual(['outlines', 'terrain']);
  });

  it('draws terrain from our own tiles, and no tile service', () => {
    const style = resolveStyle({}) as {
      sources: Record<string, { type: string; tiles?: string[]; data?: string; attribution?: string }>;
    };

    expect(style.sources.terrain?.type).toBe('raster');
    expect(style.sources.terrain?.tiles?.[0]).toMatch(/^\/world\/tiles\//);
    expect(style.sources.outlines?.data).toMatch(/^\/world\//);
  });

  it('credits the data, which three of its four sources require', () => {
    const style = resolveStyle({}) as { sources: Record<string, { attribution?: string }> };

    expect(style.sources.terrain?.attribution).toContain('Copernicus');
    expect(style.sources.terrain?.attribution).toContain('Natural Earth');
  });

  it('draws no text at all, because a place name would name the wrong world', () => {
    const style = resolveStyle({}) as { layers: { layout?: Record<string, unknown> }[] };

    for (const layer of style.layers) {
      expect(layer.layout?.['text-field']).toBeUndefined();
    }
  });

  it('paints terrain first and its outlines over the top', () => {
    const style = resolveStyle({}) as { layers: { id: string }[] };
    const ids = style.layers.map((layer) => layer.id);

    expect(ids.indexOf('terrain')).toBeLessThan(ids.indexOf('coast'));
    expect(ids.at(-1)).toBe('coast');
  });

  it('uses a configured style instead, which is how we compare against the real Earth', () => {
    expect(resolveStyle({ VITE_MAP_STYLE_URL: EARTH_STYLE_URL })).toBe(EARTH_STYLE_URL);
  });

  it('treats a blank setting as absent', () => {
    expect(typeof resolveStyle({ VITE_MAP_STYLE_URL: '   ' })).not.toBe('string');
  });
});

describe('the camera', () => {
  it('opens inside the range it allows', () => {
    expect(CAMERA.initialZoom).toBeGreaterThanOrEqual(CAMERA.minZoom);
    expect(CAMERA.initialZoom).toBeLessThanOrEqual(CAMERA.maxZoom);
  });

  it('stops where our world runs out of detail', () => {
    expect(CAMERA.maxZoom).toBeLessThanOrEqual(10);
  });

  it('starts somewhere on the map', () => {
    expect(Math.abs(CAMERA.center.lat)).toBeLessThan(85);
    expect(Math.abs(CAMERA.center.lng)).toBeLessThanOrEqual(180);
  });
});
