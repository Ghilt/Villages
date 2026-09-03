import { describe, expect, it } from 'vitest';

import { warpCollection, warpGeometry } from './geometry.ts';
import type { FeatureCollection } from './geometry.ts';
import type { WarpConfig } from './warp.ts';

const SHIFT_EAST: WarpConfig = {
  rotation: { yaw: 0, pitch: 0, roll: 0 },
  controls: [{ lng: 0, lat: 0, radius: 400, dLng: 5, dLat: 0 }],
  noise: [],
  seamGuard: 0,
  maxLatitude: 85,
};

describe('warping geometry', () => {
  it('moves a point', () => {
    const warped = warpGeometry({ type: 'Point', coordinates: [0, 0] }, SHIFT_EAST);

    expect(warped.coordinates).toEqual([5, 0]);
  });

  it('keeps the shape of a polygon, rings and all', () => {
    const warped = warpGeometry(
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
      SHIFT_EAST,
    );

    const rings = warped.coordinates as number[][][];
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);
    expect(rings[0]![0]![0]).toBeCloseTo(5, 3);
  });

  it('handles the nesting of a multi-polygon', () => {
    const warped = warpGeometry({ type: 'MultiPolygon', coordinates: [[[[0, 0]]], [[[1, 1]]]] }, SHIFT_EAST);

    expect((warped.coordinates as number[][][][]).length).toBe(2);
  });

  it('refuses a geometry it does not understand, rather than passing it through wrong', () => {
    expect(() => warpGeometry({ type: 'GeometryCollection', coordinates: [] }, SHIFT_EAST)).toThrow(
      /GeometryCollection/,
    );
  });

  it('rounds coordinates, because a tenth of a metre is finer than any map needs', () => {
    const warped = warpGeometry({ type: 'Point', coordinates: [1 / 3, 2 / 3] }, SHIFT_EAST);
    const [lng] = warped.coordinates as [number, number];

    expect(String(lng).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
  });
});

describe('warping a collection', () => {
  const collection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { name: 'a', pop: 7 },
      },
      { type: 'Feature', geometry: null, properties: null },
    ],
  };

  it('drops features with no geometry', () => {
    expect(warpCollection(collection, SHIFT_EAST).features).toHaveLength(1);
  });

  it('keeps only the properties it is told to keep, so the world stays small', () => {
    const warped = warpCollection(collection, SHIFT_EAST, ['name']);

    expect(warped.features[0]?.properties).toEqual({ name: 'a' });
  });

  it('keeps nothing by default', () => {
    expect(warpCollection(collection, SHIFT_EAST).features[0]?.properties).toEqual({});
  });
});
