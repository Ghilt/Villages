import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { unzipSync } from 'fflate';
import { open } from 'shapefile';

import type { Feature, FeatureCollection } from '../src/geometry.ts';
import { SOURCE_DIR } from './paths.ts';

/**
 * Where the raw material comes from. Everything is downloaded once into `world/source`, which is not
 * committed: it is somebody else's data, it is large, and our world is what we make of it.
 *
 * Features are handed out one at a time rather than as a whole file. The ecoregion data would be over
 * half a gigabyte as one GeoJSON document, which is past what a single string can hold, and there is no
 * reason to hold a world in memory to paint it.
 */

const NATURAL_EARTH = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

export interface SourceSpec {
  /** How a layer refers to it in the configuration. */
  name: string;
  url: string;
  kind: 'geojson' | 'zipped-shapefile';
  /** For a shapefile, the name of the `.shp` inside the archive. */
  member?: string;
  credit: string;
}

export const SOURCES: readonly SourceSpec[] = [
  {
    name: 'ECOREGIONS',
    url: 'https://storage.googleapis.com/teow2016/Ecoregions2017.zip',
    kind: 'zipped-shapefile',
    member: 'Ecoregions2017.shp',
    credit: 'RESOLVE Ecoregions 2017, CC BY 4.0',
  },
  ...(
    [
      'ne_50m_land',
      'ne_50m_lakes',
      'ne_10m_lakes_europe',
      'ne_50m_rivers_lake_centerlines',
      'ne_50m_glaciated_areas',
      'ne_10m_playas',
    ] as const
  ).map((name): SourceSpec => ({
    name,
    url: `${NATURAL_EARTH}/${name}.geojson`,
    kind: 'geojson',
    credit: 'Natural Earth, public domain',
  })),
];

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(2)} MB`;

function specFor(name: string): SourceSpec {
  const spec = SOURCES.find((candidate) => candidate.name === name);
  if (spec === undefined) {
    throw new Error(`${name} is not a source this build knows about`);
  }
  return spec;
}

const fileFor = (spec: SourceSpec): string =>
  resolve(SOURCE_DIR, spec.kind === 'geojson' ? `${spec.name}.geojson` : `${spec.name}.zip`);

/** Downloads one source if it is not already here. Archives are kept as they arrived. */
export async function ensureSource(spec: SourceSpec): Promise<void> {
  await mkdir(SOURCE_DIR, { recursive: true });
  const target = fileFor(spec);
  if (existsSync(target)) {
    console.log(`have    ${spec.name}`);
    return;
  }

  const response = await fetch(spec.url);
  if (!response.ok) {
    throw new Error(`${spec.url} answered ${response.status}`);
  }
  const body = new Uint8Array(await response.arrayBuffer());
  await writeFile(target, body);
  console.log(`fetched ${spec.name} (${megabytes(body.byteLength)})`);
}

/** Every feature of a source, one at a time, whatever form it arrived in. */
export async function* streamFeatures(name: string): AsyncGenerator<Feature> {
  const spec = specFor(name);
  const path = fileFor(spec);
  if (!existsSync(path)) {
    throw new Error(`${name} is missing. Run "npm run world:fetch --prefix frontend" first.`);
  }

  if (spec.kind === 'geojson') {
    const collection = JSON.parse(await readFile(path, 'utf8')) as FeatureCollection;
    for (const feature of collection.features) {
      yield feature;
    }
    return;
  }

  const unpacked = unzipSync(await readFile(path));
  const shpName = Object.keys(unpacked).find((entry) => entry.endsWith(spec.member ?? '.shp'));
  const dbfName = shpName?.replace(/\.shp$/, '.dbf');
  if (shpName === undefined || dbfName === undefined || unpacked[dbfName] === undefined) {
    throw new Error(`${name} has no ${spec.member} with a matching .dbf inside it`);
  }

  const shapefile = await open(unpacked[shpName]!, unpacked[dbfName]!);
  for (;;) {
    const record = await shapefile.read();
    if (record.done === true) {
      return;
    }
    yield record.value as Feature;
  }
}
