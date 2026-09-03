import { warpPoint } from './warp.ts';
import type { WarpConfig } from './warp.ts';
import type { LngLat } from './sphere.ts';

/**
 * Enough of GeoJSON to move a whole map through the warp. Only the geometry types Natural Earth uses for
 * land, lakes, rivers and places are handled; anything else is refused rather than passed through wrong.
 */

export type Position = readonly [number, number, ...number[]];

export interface Geometry {
  type: string;
  coordinates: unknown;
}

export interface Feature {
  type: 'Feature';
  geometry: Geometry | null;
  properties: Record<string, unknown> | null;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

const WARPED_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
]);

/** How deeply the coordinates of each geometry type are nested. */
const DEPTH: Record<string, number> = {
  Point: 0,
  MultiPoint: 1,
  LineString: 1,
  MultiLineString: 2,
  Polygon: 2,
  MultiPolygon: 3,
};

function warpNested(value: unknown, depth: number, move: (p: LngLat) => LngLat): unknown {
  if (depth === 0) {
    const [lng, lat] = value as Position;
    const moved = move({ lng, lat });
    // Six decimals is about a tenth of a metre, far finer than anything here needs, and it halves the file.
    return [Number(moved.lng.toFixed(6)), Number(moved.lat.toFixed(6))];
  }
  return (value as unknown[]).map((item) => warpNested(item, depth - 1, move));
}

export function warpGeometry(geometry: Geometry, config: WarpConfig): Geometry {
  const depth = DEPTH[geometry.type];
  if (depth === undefined || !WARPED_TYPES.has(geometry.type)) {
    throw new Error(`the world generator does not know how to warp a ${geometry.type}`);
  }
  return {
    ...geometry,
    coordinates: warpNested(geometry.coordinates, depth, (point) => warpPoint(point, config)),
  };
}

/** Warps every feature, keeping only the named properties so that the output stays small. */
export function warpCollection(
  collection: FeatureCollection,
  config: WarpConfig,
  keepProperties: readonly string[] = [],
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collection.features.flatMap((feature) => {
      if (feature.geometry === null) {
        return [];
      }
      const properties: Record<string, unknown> = {};
      for (const key of keepProperties) {
        const value = feature.properties?.[key];
        if (value !== undefined) {
          properties[key] = value;
        }
      }
      return [{ type: 'Feature' as const, geometry: warpGeometry(feature.geometry, config), properties }];
    }),
  };
}
