import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { regionLabels, regionsOf } from '../../src/regions.ts';
import type { EarthRegion, RegionKind } from '../../src/regions.ts';
import { carryNames } from '../../src/names.ts';
import type { EarthName, NameKind } from '../../src/names.ts';
import { tellAbout } from '../../src/about.ts';
import type { AboutFile } from '../../src/about.ts';
import { asIn1790, townsAdded } from '../../src/review1790.ts';
import type { AddedTown, Reviewed } from '../../src/review1790.ts';
import { fileNames } from '../../src/namesFile.ts';
import type { GivenRegions } from '../../src/namesFile.ts';
import { toWorld, wayBackOf } from '../../src/originBack.ts';
import type { OriginGrid } from '../../src/originFile.ts';

import { removeHere } from './links.ts';
import { PLACES, REGIONS, SOURCES } from './nameSources.ts';
import { ownFile, writtenAt } from './outputs.ts';
import { GROUND_DIR, NAMES_DIR, SOURCE_DIR } from './paths.ts';

/**
 * Earth's named rivers, lakes and peaks, read out of Natural Earth in `world/source` and carried through a
 * master's origin map into `names.json` beside its tiles; and its named regions, seas and stretches of land, given to
 * every square of the map in `regions.bin` beside that. What `world:names` does, and what `world:origin` does after it
 * has worked the map out, so that the two are never left out of step. The same two files go beside the master's
 * ground map too, for the game server, which reads nothing the page is served. See `src/names.ts`,
 * `src/regions.ts`, `src/namesFile.ts` and decision record 0087.
 */

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
  const review = await readReview();
  const earth: EarthName[] = [];
  for (const { file, kind } of SOURCES) {
    const { features } = JSON.parse(await readFile(resolve(SOURCE_DIR, `${file}.geojson`), 'utf8')) as {
      features: SourceFeature[];
    };
    const reviewed = kind === 'river' ? review?.rivers : kind === 'lake' ? review?.lakes : undefined;
    earth.push(...namesIn(file, kind, features, reviewed ?? {}));
  }
  const towns = await townsOf1790(review);
  earth.push(...towns.towns);
  const { carried, lost } = carryNames(earth, carry);

  let regions: GivenRegions | null = null;
  const absent = REGIONS.filter(({ file }) => !existsSync(resolve(SOURCE_DIR, `${file}.geojson`)));
  if (absent.length === 0) {
    const list: EarthRegion[] = [];
    for (const { file, kind } of REGIONS) {
      const { features } = JSON.parse(await readFile(resolve(SOURCE_DIR, `${file}.geojson`), 'utf8')) as {
        features: SourceFeature[];
      };
      list.push(...regionsIn(file, kind, features, kind === 'sea' ? (review?.seas ?? {}) : {}));
    }
    const given = regionsOf(grid, width, height, list);
    regions = { list, given, labels: regionLabels(grid, given, list.length) };
  }

  // A line or two about the rivers, lakes and seas, for the windows on them, given to every piece carried.
  const told = tellAbout(await readAbout(), carried, regions?.list ?? []);
  const filed = regions === null ? null : { ...regions, list: told.regions };
  const { file, bytes } = fileNames(master, told.names, filed, grid.columns, grid.rows);
  const text = `${JSON.stringify(file)}\n`;
  // The page's copy beside the tiles, and the server's beside the ground map. `names.json` last in each, so that
  // when it was written is when the names were: the panel, the quick start and the server read that time.
  // `worldDir` is where the caller is writing, the tree or a new world cache entry; the ground's copy goes beside it.
  for (const dir of [worldDir, writtenAt(resolve(GROUND_DIR, master))]) {
    for (const one of ['regions.bin', 'names.json']) ownFile(resolve(dir, one), 'the names');
    await mkdir(dir, { recursive: true });
    // Without the regions' sources there are none, and one an older run left would name the wrong seas.
    if (bytes !== null) await writeFile(resolve(dir, 'regions.bin'), bytes);
    else removeHere(resolve(dir, 'regions.bin'));
    await writeFile(resolve(dir, 'names.json'), text);
  }
  const { counts } = file;
  return (
    `the names of ${master}: ${counts.town} towns of 1790, ${counts.river} rivers, ${counts.lake} lakes and ` +
    `${counts.peak} peaks in the world, ${lost} gone with ground that was removed or copied; ${towns.said}; ` +
    (absent.length === 0
      ? `${counts.sea} seas and ${counts.land} regions of land given to its squares`
      : `no seas or regions, because ${absent[0]!.file} is not in world/source: npm run world:fetch-all --prefix frontend`) +
    `; ${told.given} rivers, lakes and seas given a line from about.json` +
    (told.absent.length === 0 ? '' : `, and ${told.absent.length} of its ids not in this world`)
  );
}

/** A source's named regions, each with its polygons, under the name the review of 1790 gives it where it has one. */
function regionsIn(
  file: string,
  kind: RegionKind,
  features: readonly SourceFeature[],
  review: Readonly<Record<string, Reviewed>>,
): EarthRegion[] {
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
    const rank = numeric(field('scalerank'));
    const from = numeric(field('min_label'));
    // Keyed by the source's name, so that the review's renaming it does not move its key.
    const id = field('wikidataid') ?? `${file}:${field('ne_id') ?? at}:${name}`;
    const named = asIn1790(kind, field('name_en'), field('name') ?? name, review[id]);
    if (named === null) return;
    out.push({
      id,
      kind,
      name: named.name,
      // Today's beside a name the review gave: the source's own region names are abbreviations as often as not.
      ...(named.form === undefined
        ? {}
        : { ...(named.also === undefined ? {} : { also: named.also }), form: named.form }),
      feature: field('featurecla') ?? kind,
      ...(rank === undefined ? {} : { rank }),
      ...(from === undefined ? {} : { from }),
      polygons,
    });
  });
  return out;
}

/**
 * A source's named features, a river's many pieces sharing a number taken together as one river, each under the
 * name the review of 1790 gives it where it has one - the Tagus, not the Tajo, the Lake of Geneva - and left out
 * where the review says it was not there in 1790, or it is a canal or a reservoir the review has not dated.
 */
function namesIn(
  file: string,
  kind: NameKind,
  features: readonly SourceFeature[],
  review: Readonly<Record<string, Reviewed>>,
): EarthName[] {
  const together = new Map<string, EarthName & { lines: [number, number][][] }>();
  features.forEach((feature, at) => {
    const local = text(feature.properties['name']);
    if (local === undefined || feature.geometry === null) return;
    const number = text(feature.properties['rivernum']) ?? text(feature.properties['ne_id']) ?? String(at);
    const id = text(feature.properties['wikidataid']) ?? `${file}:${number}:${local}`;
    // In English, Adam's choice of 2026-10-06: the review's name of 1790, or the source's English one.
    const made = feature.properties['featurecla'] === 'Reservoir';
    const named = asIn1790(kind, text(feature.properties['name_en']), local, review[id], made);
    if (named === null) return;
    const elevation = feature.properties['elevation'];
    const rank = numeric(feature.properties['scalerank']);
    const from = numeric(feature.properties['min_label']) ?? numeric(feature.properties['min_zoom']);
    const before = together.get(id);
    // A river's pieces may be ranked apart; the river is as important as its most important piece.
    together.set(id, {
      id,
      kind,
      name: named.name,
      ...(named.also === undefined ? {} : { also: named.also }),
      ...(typeof elevation === 'number' ? { elevation } : {}),
      ...least('rank', before?.rank, rank),
      ...least('from', before?.from, from),
      ...(named.form === undefined ? {} : { form: named.form }),
      lines: [...(before?.lines ?? []), ...linesOf(feature.geometry)],
    });
  });
  return [...together.values()];
}

/**
 * The towns of 1790: every place in Natural Earth's populated places that `world/names/1790.json` says
 * stood then, under the name it gives, and the towns it adds that Natural Earth lacks; and how many it says had
 * not been founded or has not reviewed yet.
 */
async function townsOf1790(read: Review1790 | null): Promise<{ towns: EarthName[]; said: string }> {
  const placesPath = resolve(SOURCE_DIR, `${PLACES}.geojson`);
  if (read === null || !existsSync(placesPath)) {
    return { towns: [], said: `no towns, because ${read === null ? REVIEW : placesPath} is missing` };
  }
  const review = read.towns;
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
    const rank = numeric(feature.properties['SCALERANK']);
    const from = numeric(feature.properties['MIN_ZOOM']);
    towns.push({
      id: id!,
      kind: 'town',
      name: then,
      ...(today === then ? {} : { also: today }),
      ...(rank === undefined ? {} : { rank }),
      // Natural Earth ranks today's towns, and Leghorn is not what it was; every town the review kept
      // mattered in 1790, so none waits past this zoom to be named.
      from: Math.min(from ?? TOWN_FROM, TOWN_FROM),
      form: '1790',
      lines: linesOf(feature.geometry),
    });
  }
  const reviewed = towns.length;
  const known = new Set(
    features.map((feature) => text(feature.properties['WIKIDATAID'])).filter((id) => id !== undefined),
  );
  towns.push(...townsAdded(read.added, known, TOWN_FROM));
  return {
    towns,
    said:
      `${towns.length - reviewed} added by the review beside Natural Earth's places; ${unborn} reviewed places not yet founded in ` +
      `1790, ${features.length - reviewed - unborn} not reviewed yet`,
  };
}

/** The zoom by which every town of 1790 is named, however Natural Earth ranks it today. */
const TOWN_FROM = 4.5;

/**
 * The review of 1790, each part keyed as the names are: a town by its Wikidata id, a river or a lake as `namesIn`
 * keys it, a sea as `regionsIn` does.
 */
interface Review1790 {
  readonly towns: Readonly<Record<string, Reviewed>>;
  /** Towns of 1790 Natural Earth lacks, keyed by Wikidata id, each with where it stood. */
  readonly added: Readonly<Record<string, AddedTown>>;
  readonly rivers: Readonly<Record<string, Reviewed>>;
  readonly lakes: Readonly<Record<string, Reviewed>>;
  readonly seas: Readonly<Record<string, Reviewed>>;
}

const REVIEW = resolve(NAMES_DIR, '1790.json');
const ABOUT = resolve(NAMES_DIR, 'about.json');

/** The lines about the rivers, lakes and seas, or none without the file. See `src/about.ts`. */
async function readAbout(): Promise<AboutFile> {
  return existsSync(ABOUT) ? (JSON.parse(await readFile(ABOUT, 'utf8')) as AboutFile) : {};
}

/** The review, or null without one; a part it has not got yet is a part with nothing reviewed. */
async function readReview(): Promise<Review1790 | null> {
  if (!existsSync(REVIEW)) return null;
  const read = JSON.parse(await readFile(REVIEW, 'utf8')) as Partial<Review1790>;
  return {
    towns: read.towns ?? {},
    added: read.added ?? {},
    rivers: read.rivers ?? {},
    lakes: read.lakes ?? {},
    seas: read.seas ?? {},
  };
}

function numeric(value: unknown): number | undefined {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : undefined;
}

/** The smaller of two optional numbers, as a field of that name, or no field when there is neither. */
function least<Key extends string>(
  key: Key,
  one: number | undefined,
  other: number | undefined,
): { [k in Key]?: number } {
  const both = [one, other].filter((value): value is number => value !== undefined);
  return (both.length === 0 ? {} : { [key]: Math.min(...both) }) as { [k in Key]?: number };
}

/** A field as words, its spaces closed up: Natural Earth writes some names with two, São  Francisco. */
function text(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim() !== '' ? value.trim().replace(/\s+/g, ' ') : undefined;
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
