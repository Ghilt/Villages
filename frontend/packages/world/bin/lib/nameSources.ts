import type { NameKind } from '../../src/names.ts';
import type { RegionKind } from '../../src/regions.ts';

/**
 * The Natural Earth files the names are read from, all in `world/source` and fetched by `world:fetch-all`: what
 * `earthNames.ts` reads, and what the world cache counts among what the names are made from (decision 0095).
 */

/** Which files hold which kind of name. All of them are needed: without one, no names are carried at all. */
export const SOURCES: readonly { file: string; kind: NameKind }[] = [
  { file: 'ne_10m_rivers_lake_centerlines', kind: 'river' },
  { file: 'ne_10m_rivers_europe', kind: 'river' },
  { file: 'ne_10m_lakes', kind: 'lake' },
  { file: 'ne_10m_lakes_europe', kind: 'lake' },
  { file: 'ne_10m_lakes_north_america', kind: 'lake' },
  { file: 'ne_10m_geography_regions_elevation_points', kind: 'peak' },
];

/** Which files hold the named regions. Optional: without them the rest is still carried. */
export const REGIONS: readonly { file: string; kind: RegionKind }[] = [
  { file: 'ne_10m_geography_marine_polys', kind: 'sea' },
  { file: 'ne_10m_geography_regions_polys', kind: 'land' },
];

/** Natural Earth's towns of today, which the review of 1790 is made against. Optional, as the review is. */
export const PLACES = 'ne_10m_populated_places';
