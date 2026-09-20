import { describe, expect, it } from 'vitest';

import { CAMERA, EARTH_STYLE_URL, resolveStyle } from './mapConfig';

/** Where a master's world is served from. One directory each; see packages/world/src/masters.ts. */
const ROOT = '/world/masters/terrain';

describe('the map style', () => {
  it('is our own world when nothing is configured', () => {
    const style = resolveStyle({}, ROOT);

    expect(typeof style).not.toBe('string');
    expect(Object.keys((style as { sources: object }).sources).sort()).toEqual(['outlines', 'terrain']);
  });

  it('draws terrain from our own tiles, and no tile service', () => {
    const style = resolveStyle({}, ROOT) as {
      sources: Record<string, { type: string; tiles?: string[]; data?: string; attribution?: string }>;
    };

    expect(style.sources.terrain?.type).toBe('raster');
    expect(style.sources.terrain?.tiles?.[0]).toBe(`${ROOT}/tiles/{z}/{x}/{y}.png`);
    expect(style.sources.outlines?.data).toBe(`${ROOT}/terrain.geojson`);
  });

  it('draws whichever master it is given, which is what the terrain dropdown switches', () => {
    const style = resolveStyle({}, '/world/masters/terrain2') as {
      sources: Record<string, { tiles?: string[]; data?: string }>;
    };

    expect(style.sources.terrain?.tiles?.[0]).toContain('/masters/terrain2/tiles/');
    expect(style.sources.outlines?.data).toContain('/masters/terrain2/');
  });

  /*
   * The credit is owed and it is not the map's to give.
   *
   * MapLibre credits the sources whose layers are showing, so the line appeared on `raw` and on none of
   * the five painted renderers - a licence term honoured one time in six is not honoured. It lives in
   * `AUTHORING-THE-WORLD.md` now, with what the game still owes a player. See decision record 0050.
   */
  it('draws no source credits on the world, because it never drew them on more than one renderer', () => {
    const style = resolveStyle({}, ROOT) as { sources: Record<string, { attribution?: string }> };

    expect(style.sources.terrain?.attribution).toBeUndefined();
  });

  it('draws no text at all, because a place name would name the wrong world', () => {
    const style = resolveStyle({}, ROOT) as { layers: { layout?: Record<string, unknown> }[] };

    for (const layer of style.layers) {
      expect(layer.layout?.['text-field']).toBeUndefined();
    }
  });

  it('paints terrain first and its outlines over the top', () => {
    const style = resolveStyle({}, ROOT) as { layers: { id: string }[] };
    const ids = style.layers.map((layer) => layer.id);

    expect(ids.indexOf('terrain')).toBeLessThan(ids.indexOf('coast'));
    expect(ids.at(-1)).toBe('coast');
  });

  it('uses a configured style instead, which is how we compare against the real Earth', () => {
    expect(resolveStyle({ VITE_MAP_STYLE_URL: EARTH_STYLE_URL }, ROOT)).toBe(EARTH_STYLE_URL);
  });

  it('treats a blank setting as absent', () => {
    expect(typeof resolveStyle({ VITE_MAP_STYLE_URL: '   ' }, ROOT)).not.toBe('string');
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

  it('leaves the sheet a real size at the floor, and no bigger than the window', () => {
    expect(CAMERA.sheetAtFloor).toBeGreaterThan(0);
    expect(CAMERA.sheetAtFloor).toBeLessThanOrEqual(1);
  });

  it('starts somewhere on the map', () => {
    expect(Math.abs(CAMERA.center.lat)).toBeLessThan(85);
    expect(Math.abs(CAMERA.center.lng)).toBeLessThanOrEqual(180);
  });
});
