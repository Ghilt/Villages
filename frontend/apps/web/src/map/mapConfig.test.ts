import { describe, expect, it } from 'vitest';

import { CAMERA, EARTH_STYLE_URL, resolveStyle } from './mapConfig';

describe('the map style', () => {
  it('is our own world when nothing is configured', () => {
    const style = resolveStyle({});

    expect(typeof style).not.toBe('string');
    expect(Object.keys((style as { sources: object }).sources)).toEqual(['terrain']);
  });

  it('draws a layer for every terrain, and a coastline over them', () => {
    const style = resolveStyle({}) as { layers: { id: string }[] };
    const ids = style.layers.map((layer) => layer.id);

    expect(ids[0]).toBe('sea');
    expect(ids.at(-1)).toBe('coast');
    expect(ids.filter((id) => id.startsWith('terrain-')).length).toBeGreaterThan(8);
  });

  it('draws no text at all, because a place name would name the wrong world', () => {
    const style = resolveStyle({}) as {
      layers: { layout?: Record<string, unknown> }[];
    };

    for (const layer of style.layers) {
      expect(layer.layout?.['text-field']).toBeUndefined();
    }
  });

  it('draws the whole world from our own files and no tile service', () => {
    const style = resolveStyle({}) as { sources: Record<string, { type: string; data?: string }> };

    for (const source of Object.values(style.sources)) {
      expect(source.type).toBe('geojson');
      expect(source.data).toMatch(/^\/world\//);
    }
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
