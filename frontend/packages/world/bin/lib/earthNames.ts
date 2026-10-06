import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { carryNames } from '../../src/names.ts';
import type { EarthName, NameKind } from '../../src/names.ts';
import { toWorld, wayBackOf } from '../../src/originBack.ts';
import type { OriginGrid } from '../../src/originFile.ts';

import { SOURCE_DIR } from './paths.ts';

/**
 * Earth's named rivers, lakes and peaks, read out of Natural Earth in `world/source` and carried through a
 * master's origin map into `names.json` beside its tiles. What `world:names` does, and what `world:origin`
 * does after it has worked the map out, so that the two are never left out of step. See `src/names.ts`.
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
  const { carried, lost } = carryNames(earth, carry);
  const counts = { river: 0, lake: 0, peak: 0 };
  for (const one of carried) counts[one.kind] += 1;
  await writeFile(
    resolve(worldDir, 'names.json'),
    `${JSON.stringify({
      $comment: 'Written by npm run world:names or world:origin. Output: carried again from the origin map.',
      master,
      form: 'today',
      counts,
      names: carried,
    })}\n`,
  );
  return (
    `the names of ${master}: ${counts.river} rivers, ${counts.lake} lakes and ${counts.peak} peaks in the world, ` +
    `${lost} gone with ground that was removed or copied`
  );
}

/** A source's named features, a river's many pieces sharing a number taken together as one river. */
function namesIn(file: string, kind: NameKind, features: readonly SourceFeature[]): EarthName[] {
  const together = new Map<string, EarthName & { lines: [number, number][][] }>();
  features.forEach((feature, at) => {
    const name = text(feature.properties['name']);
    if (name === undefined || feature.geometry === null) return;
    const number = text(feature.properties['rivernum']) ?? text(feature.properties['ne_id']) ?? String(at);
    const id = text(feature.properties['wikidataid']) ?? `${file}:${number}:${name}`;
    const english = text(feature.properties['name_en']);
    const elevation = feature.properties['elevation'];
    const one = together.get(id) ?? {
      id,
      kind,
      name,
      ...(english === undefined ? {} : { english }),
      ...(typeof elevation === 'number' ? { elevation } : {}),
      lines: [],
    };
    one.lines.push(...linesOf(feature.geometry));
    together.set(id, one);
  });
  return [...together.values()];
}

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
