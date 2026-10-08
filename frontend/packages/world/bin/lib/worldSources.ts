/**
 * Where the raw material of the world comes from, and what it is for.
 *
 * Nothing here is committed: it is 4.5 GB of somebody else's data, and our world is what we make of it.
 * The point of writing it down is that the world stays rebuildable. Every entry is a direct download with
 * no account, no key and no landing page, and every one of them is public domain or CC-BY.
 */

export interface ZipMember {
  /** Matched against the end of an entry's name inside the archive. */
  endsWith: string;
  into: string;
  bytes: number;
}

export interface WorldSource {
  name: string;
  url: string;
  credit: string;
  what: string;
  /** A plain file, saved as it arrives. */
  into?: string;
  /** An archive, with only the members we need taken out of it. */
  members?: ZipMember[];
  bytes?: number;
}

const NATURAL_EARTH = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

/** The Natural Earth layers the generator draws, all of them public domain. */
const NATURAL_EARTH_LAYERS = [
  'ne_10m_land',
  'ne_10m_minor_islands',
  'ne_10m_bathymetry_K_200',
  'ne_10m_glaciated_areas',
  'ne_10m_antarctic_ice_shelves_polys',
  'ne_10m_playas',
  'ne_10m_lakes',
  'ne_10m_lakes_europe',
  'ne_10m_lakes_north_america',
  'ne_10m_lakes_pluvial',
  'ne_10m_rivers_lake_centerlines',
  'ne_10m_rivers_europe',
] as const;

/** The Natural Earth layers only the names are read from, also public domain. */
const NAMED_LAYERS = [
  'ne_10m_geography_regions_elevation_points',
  'ne_10m_geography_marine_polys',
  'ne_10m_geography_regions_polys',
  'ne_10m_populated_places',
] as const;

/**
 * ETOPO 2022's whole world at 60 arc-seconds, a height every 1.85 km at the equator, land and sea floor, in one
 * file: what the relief is shaded from (decision record 0090).
 */
export const ETOPO_WORLD = 'etopo/ETOPO_2022_v1_60s_N90W180_surface.tif';

export const WORLD_SOURCES: readonly WorldSource[] = [
  {
    name: 'Copernicus land cover',
    url: 'https://zenodo.org/api/records/3939050/files/PROBAV_LC100_global_v3.0.1_2019-nrt_Discrete-Classification-map_EPSG-4326.tif/content',
    into: 'LC100.tif',
    bytes: 1713345228,
    credit: 'Copernicus Global Land Service, Land Cover 100 m, CC-BY 4.0',
    what: 'One byte for every hundred-metre square of land. This is what knows Europe is farmland.',
  },
  {
    name: 'RESOLVE Ecoregions 2017',
    url: 'https://storage.googleapis.com/teow2016/Ecoregions2017.zip',
    members: [
      { endsWith: 'Ecoregions2017.shp', into: 'eco/Ecoregions2017.shp', bytes: 243042148 },
      { endsWith: 'Ecoregions2017.dbf', into: 'eco/Ecoregions2017.dbf', bytes: 1027078 },
    ],
    credit: 'RESOLVE Ecoregions 2017, CC-BY 4.0',
    what: '847 ecoregions in 14 biomes, for climate context and for the poles land cover does not reach.',
  },
  {
    name: 'HydroLAKES pour points',
    url: 'https://data.hydrosheds.org/file/hydrolakes/HydroLAKES_points_v10_shp.zip',
    members: [
      { endsWith: 'HydroLAKES_points_v10.shp', into: 'lakes/HydroLAKES_points_v10.shp', bytes: 39975364 },
      { endsWith: 'HydroLAKES_points_v10.dbf', into: 'lakes/HydroLAKES_points_v10.dbf', bytes: 376910338 },
    ],
    credit: 'HydroLAKES (HydroSHEDS), CC-BY 4.0',
    what: '1.43 million lakes down to ten hectares, each a position and an area. Points rather than polygons, because most are smaller than a pixel and their shape is unrepresentable.',
  },
  {
    name: 'HydroRIVERS',
    url: 'https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_shp.zip',
    members: [
      { endsWith: 'HydroRIVERS_v10.shp', into: 'rivers/HydroRIVERS_v10.shp', bytes: 1247444140 },
      { endsWith: 'HydroRIVERS_v10.dbf', into: 'rivers/HydroRIVERS_v10.dbf', bytes: 873222431 },
    ],
    credit: 'HydroRIVERS (HydroSHEDS), CC-BY 4.0',
    what: '8.5 million river reaches with a Strahler order each. We draw those of order five and up.',
  },
  ...NATURAL_EARTH_LAYERS.map((layer): WorldSource => ({
    name: layer,
    url: `${NATURAL_EARTH}/${layer}.geojson`,
    into: `${layer}.geojson`,
    credit: 'Natural Earth, public domain',
    what: 'Coastline, islands, glaciers, big lakes and the 200 m isobath: the shapes with real outlines.',
  })),
  ...NAMED_LAYERS.map((layer): WorldSource => ({
    name: layer,
    url: `${NATURAL_EARTH}/${layer}.geojson`,
    into: `${layer}.geojson`,
    credit: 'Natural Earth, public domain',
    what: 'Named peaks, seas, land regions and towns, carried into the world by world:names. See docs/plans/real-world-names.md.',
  })),
  {
    name: 'ETOPO 2022, 60 arc-seconds',
    url: 'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif',
    into: ETOPO_WORLD,
    bytes: 465969062,
    credit: 'NOAA NCEI, ETOPO 2022 Global Relief Model, public domain (CC0)',
    what: 'The height of land and sea floor every 60 arc-seconds, the whole world in one file: the relief.',
  },
];
