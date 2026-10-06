import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { regionsOf } from '../../src/regions.ts';
import type { EarthRegion, RegionKind } from '../../src/regions.ts';
import { carryNames } from '../../src/names.ts';
import type { EarthName, NameKind } from '../../src/names.ts';
import { toWorld, wayBackOf } from '../../src/originBack.ts';
import type { OriginGrid } from '../../src/originFile.ts';

import { NAMES_DIR, SOURCE_DIR } from './paths.ts';

/**
 * Earth's named rivers, lakes and peaks, read out of Natural Earth in `world/source` and carried through a
 * master's origin map into `names.json` beside its tiles; and its named regions, seas and stretches of land, given to
 * every square of the map in `regions.bin` beside that. What `world:names` does, and what `world:origin` does after it
 * has worked the map out, so that the two are never left out of step. See `src/names.ts` and `src/regions.ts`.
 */

/** Which files hold which kind of name: Natural Earth's own, fetched by `world:fetch-all`. */
const SOURCES: readonly { file: string; kind: NameKind }[] = [
  { file: 'ne_10m_rivers_lake_centerlines', kind: 'river' },
  { file: 'ne_10m_rivers_europe', kind: 'river' },
  { file: 'ne_10m_lakes', kind: 'lake' },
  { file: 'ne_10m_lakes_europe', kind: 'lake' },
  { file: 'ne_10m_lakes_north_america', kind: 'lake' },
  { file: 'ne_10m_geography_regions_elevation_points', kind: 'peak' },
];

/** Which files hold the named regions. Optional: without them the rest is still carried. */
const REGIONS: readonly { file: string; kind: RegionKind }[] = [
  { file: 'ne_10m_geography_marine_polys', kind: 'sea' },
  { file: 'ne_10m_geography_regions_polys', kind: 'land' },
];

interface SourceFeature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

/** Writes a master's names and returns what to print, or says why it could not. */
export async function writeNames(
  master: string,
  worldDir: string,
  grid: OriginGrid,
  width: number,
  height: number,
): Promise<string> {
  const missing = SOURCES.map(({ file }) => resolve(SOURCE_DIR, `${file}.geojson`)).filter(
    (path) => !existsSync(path),
  );
  if (missing.length > 0) {
    return `no names carried: ${missing[0]} is missing, and npm run world:fetch-all --prefix frontend fills world/source`;
  }
  const back = wayBackOf(grid, width, height);
  const carry = (lng: number, lat: number): [number, number] | null => {
    const there = toWorld(back, ((lng + 180) / 360) * width, ((90 - lat) / 180) * height);
    return there === null ? null : [(there[0] / width) * 360 - 180, 90 - (there[1] / height) * 180];
  };
  const earth: EarthName[] = [];
  for (const { file, kind } of SOURCES) {
    const { features } = JSON.parse(await readFile(resolve(SOURCE_DIR, `${file}.geojson`), 'utf8')) as {
      features: SourceFeature[];
    };
    earth.push(...namesIn(file, kind, features));
  }
  const towns = await townsOf1790();
  earth.push(...towns.towns);
  const { carried, lost } = carryNames(earth, carry);
  const counts = { river: 0, lake: 0, peak: 0, town: 0, sea: 0, land: 0 };
  for (const one of carried) counts[one.kind] += 1;

  const regions: EarthRegion[] = [];
  const absent = REGIONS.filter(({ file }) => !existsSync(resolve(SOURCE_DIR, `${file}.geojson`)));
  if (absent.length === 0) {
    for (const { file, kind } of REGIONS) {
      const { features } = JSON.parse(await readFile(resolve(SOURCE_DIR, `${file}.geojson`), 'utf8')) as {
        features: SourceFeature[];
      };
      regions.push(...regionsIn(file, kind, features));
    }
    const given = regionsOf(grid, width, height, regions);
    const both = new Uint16Array(grid.status.length * 2);
    both.set(given.land, 0);
    both.set(given.sea, grid.status.length);
    await writeFile(resolve(worldDir, 'regions.bin'), new Uint8Array(both.buffer));
    for (const k of new Set([...given.land, ...given.sea])) if (k > 0) counts[regions[k - 1]!.kind] += 1;
  }

  await writeFile(
    resolve(worldDir, 'names.json'),
    `${JSON.stringify({
      $comment: 'Written by npm run world:names or world:origin. Output: carried again from the origin map.',
      master,
      form: 'today',
      counts,
      names: carried,
      // What the two layers of regions.bin, a land and then a sea for every square, number from one.
      regions: regions.map(({ id, kind, name, feature }) => ({ id, kind, name, feature })),
    })}\n`,
  );
  return (
    `the names of ${master}: ${counts.town} towns of 1790, ${counts.river} rivers, ${counts.lake} lakes and ` +
    `${counts.peak} peaks in the world, ${lost} gone with ground that was removed or copied; ${towns.said}; ` +
    (absent.length === 0
      ? `${counts.sea} seas and ${counts.land} regions of land given to its squares`
      : `no seas or regions, because ${absent[0]!.file} is not in world/source: npm run world:fetch-all --prefix frontend`)
  );
}

/** A source's named regions, each with its polygons. */
function regionsIn(file: string, kind: RegionKind, features: readonly SourceFeature[]): EarthRegion[] {
  const out: EarthRegion[] = [];
  features.forEach((feature, at) => {
    // Natural Earth's region polygons spell their fields in capitals and its marine ones do not.
    const field = (key: string) => text(feature.properties[key] ?? feature.properties[key.toUpperCase()]);
    // In English, Adam's choice of 2026-10-06.
    const name = field('name_en') ?? field('name');
    if (name === undefined || feature.geometry === null) return;
    const c = feature.geometry.coordinates as never;
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [c]
        : feature.geometry.type === 'MultiPolygon'
          ? (c as never[])
          : [];
    if (polygons.length === 0) return;
    out.push({
      id: field('wikidataid') ?? `${file}:${field('ne_id') ?? at}:${name}`,
      kind,
      name,
      feature: field('featurecla') ?? kind,
      polygons,
    });
  });
  return out;
}

/** A source's named features, a river's many pieces sharing a number taken together as one river. */
function namesIn(file: string, kind: NameKind, features: readonly SourceFeature[]): EarthName[] {
  const together = new Map<string, EarthName & { lines: [number, number][][] }>();
  features.forEach((feature, at) => {
    const local = text(feature.properties['name']);
    if (local === undefined || feature.geometry === null) return;
    // In English, Adam's choice of 2026-10-06, with the source's own name beside it where it differs.
    const name = text(feature.properties['name_en']) ?? local;
    const number = text(feature.properties['rivernum']) ?? text(feature.properties['ne_id']) ?? String(at);
    const id = text(feature.properties['wikidataid']) ?? `${file}:${number}:${local}`;
    const elevation = feature.properties['elevation'];
    const one = together.get(id) ?? {
      id,
      kind,
      name,
      ...(local === name ? {} : { also: local }),
      ...(typeof elevation === 'number' ? { elevation } : {}),
      lines: [],
    };
    one.lines.push(...linesOf(feature.geometry));
    together.set(id, one);
  });
  return [...together.values()];
}

/**
 * The towns of 1790: every place in Natural Earth's populated places that `world/names/1790.json` says
 * stood then, under the name it gives, and how many it says had not been founded or has not reviewed yet.
 */
async function townsOf1790(): Promise<{ towns: EarthName[]; said: string }> {
  const reviewPath = resolve(NAMES_DIR, '1790.json');
  const placesPath = resolve(SOURCE_DIR, `${PLACES}.geojson`);
  if (!existsSync(reviewPath) || !existsSync(placesPath)) {
    return {
      towns: [],
      said: `no towns, because ${existsSync(reviewPath) ? placesPath : reviewPath} is missing`,
    };
  }
  const review = (JSON.parse(await readFile(reviewPath, 'utf8')) as { towns: Record<string, Review> }).towns;
  const { features } = JSON.parse(await readFile(placesPath, 'utf8')) as { features: SourceFeature[] };
  const towns: EarthName[] = [];
  let unborn = 0;
  for (const feature of features) {
    const id = text(feature.properties['WIKIDATAID']);
    const decided = id === undefined ? undefined : review[id];
    if (decided === undefined || feature.geometry === null) continue;
    const [then, today] = decided;
    if (then === null) {
      unborn += 1;
      continue;
    }
    towns.push({
      id: id!,
      kind: 'town',
      name: then,
      ...(today === then ? {} : { also: today }),
      lines: linesOf(feature.geometry),
    });
  }
  return {
    towns,
    said: `${unborn} reviewed places not yet founded in 1790, ${features.length - towns.length - unborn} not reviewed yet`,
  };
}

/** Natural Earth's towns of today, which the review of 1790 is made against. */
const PLACES = 'ne_10m_populated_places';

/** A town as the review decides it: its name in 1790 or null, today's, and why they differ. */
type Review = [string | null, string, string?];

function text(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Every line of a geometry: a river's runs, a lake's rings, a peak as a line of one point. */
function linesOf(geometry: { type: string; coordinates: unknown }): [number, number][][] {
  const c = geometry.coordinates as never;
  switch (geometry.type) {
    case 'Point':
      return [[c]];
    case 'LineString':
      return [c];
    case 'MultiLineString':
    case 'Polygon':
      return c;
    case 'MultiPolygon':
      return (c as [number, number][][][]).flat();
    default:
      return [];
  }
}
