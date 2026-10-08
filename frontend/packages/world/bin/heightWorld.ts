import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

import sharp from 'sharp';

import {
  HEIGHT_BOUNDS,
  HEIGHT_FORMAT,
  HEIGHT_MAX_ZOOM,
  halve,
  heightAt,
  levelFor,
  toTerrarium,
  undoFloatPredictor,
} from '../src/height.ts';
import type { HeightGrid } from '../src/height.ts';
import { FILL_SPLIT, fillOf, fittedHeight } from '../src/heightFitted.ts';
import type { EarthHeight } from '../src/heightFitted.ts';
import { decodeOrigin } from '../src/originFile.ts';
import type { OriginFile } from '../src/originFile.ts';
import { DEFAULT_MASTER, masterNameOf, worldDirOf } from '../src/masters.ts';
import { TILE_SIZE } from '../src/tiles.ts';

import { flag, named } from './lib/flags.ts';
import { OUTPUT_DIR, SOURCE_DIR, masterAt } from './lib/paths.ts';
import { ETOPO_WORLD } from './lib/worldSources.ts';

/**
 * Height tiles for the relief (decision record 0090): ETOPO 2022's whole world, fitted to a master through its
 * origin map and cut into Terrarium tiles beside the master's other tiles, lossless WebP, for the relief's
 * shaders to read.
 *
 *   node bin/heightWorld.ts [master] [--max-zoom 7]
 *
 * Reads ETOPO's world at 60 arc-seconds from `world/source/`, which `npm run world:height` fetches first when it
 * is not there, 444 MB once, and writes every tile from zoom nought to `--max-zoom` into
 * `public/world/masters/<master>/height/`, with `height.json` saying where it reaches. A pixel reads the level of
 * a pyramid of halved grids nearest its own size, so a tile far out is the mean of the ground under it rather
 * than a few points of it. The sea is held at nought, so the shading stops at the shore, and the grid is read
 * round the antimeridian, so the Pacific has no edge.
 *
 * Every point of the master is given the height of the place on Earth its origin map says it was cut from
 * (`src/heightFitted.ts`), so land Adam moved takes its height with it, and invented land is filled from the
 * land around it. A master with no origin map yet is given plain Earth's, and told so. So the height is stale
 * whenever the origin map is, which is whenever the master was cut since: cutting it in the Debug map runs this
 * after the origin, and the quick start does whenever `origin.json` is newer than `height.json`.
 */

const masterPath = masterAt(named[0]);
const master = masterNameOf(basename(masterPath)) ?? DEFAULT_MASTER;
const outputDir = resolve(OUTPUT_DIR, worldDirOf(master), 'height');
const maxZoom = Number(flag('max-zoom') ?? HEIGHT_MAX_ZOOM);

const TAG = {
  width: 256,
  height: 257,
  bitsPerSample: 258,
  compression: 259,
  predictor: 317,
  tileWidth: 322,
  tileHeight: 323,
  tileOffsets: 324,
  tileByteCounts: 325,
  sampleFormat: 339,
  pixelScale: 33550,
  tiePoint: 33922,
} as const;

/** The numbers a tag holds, for the three types ETOPO's tags come in: short, long and double. */
function tagsOf(file: Buffer): Map<number, number[]> {
  if (file.toString('latin1', 0, 2) !== 'II' || file.readUInt16LE(2) !== 42) {
    throw new Error('not a little-endian TIFF');
  }
  const ifd = file.readUInt32LE(4);
  const tags = new Map<number, number[]>();
  for (let i = 0; i < file.readUInt16LE(ifd); i += 1) {
    const at = ifd + 2 + i * 12;
    const type = file.readUInt16LE(at + 2);
    const count = file.readUInt32LE(at + 4);
    const size = type === 3 ? 2 : type === 4 ? 4 : type === 12 ? 8 : 0;
    if (size === 0) {
      continue;
    }
    const from = size * count <= 4 ? at + 8 : file.readUInt32LE(at + 8);
    const read = (k: number) =>
      type === 3
        ? file.readUInt16LE(from + k * 2)
        : type === 4
          ? file.readUInt32LE(from + k * 4)
          : file.readDoubleLE(from + k * 8);
    tags.set(
      file.readUInt16LE(at),
      Array.from({ length: count }, (_, k) => read(k)),
    );
  }
  return tags;
}

/**
 * One ETOPO tile: float heights, deflated in square tiles of their own with the floating-point predictor.
 * Hand written for the reason `src/png.ts` is: the part of the format needed is small.
 */
function readEtopo(path: string): HeightGrid {
  const file = readFileSync(path);
  const tags = tagsOf(file);
  const one = (tag: number) => tags.get(tag)?.[0] ?? Number.NaN;
  const shape = [TAG.bitsPerSample, TAG.compression, TAG.predictor, TAG.sampleFormat].map(one).join(' ');
  if (shape !== '32 8 3 3') {
    throw new Error(`${path}: expected 32-bit floats, deflated, predictor 3; found ${shape}`);
  }
  const width = one(TAG.width);
  const height = one(TAG.height);
  const tileWidth = one(TAG.tileWidth);
  const tileHeight = one(TAG.tileHeight);
  const offsets = tags.get(TAG.tileOffsets) ?? [];
  const counts = tags.get(TAG.tileByteCounts) ?? [];
  const tie = tags.get(TAG.tiePoint) ?? [];
  const across = Math.ceil(width / tileWidth);

  const heights = new Float32Array(width * height);
  const row = new Float32Array(tileWidth);
  offsets.forEach((offset, t) => {
    const bytes = inflateSync(file.subarray(offset, offset + counts[t]!));
    const left = (t % across) * tileWidth;
    const columns = Math.min(tileWidth, width - left);
    for (let r = 0; r < tileHeight; r += 1) {
      const y = Math.floor(t / across) * tileHeight + r;
      if (y >= height) {
        break;
      }
      undoFloatPredictor(bytes.subarray(r * tileWidth * 4, (r + 1) * tileWidth * 4), tileWidth, row, 0);
      heights.set(row.subarray(0, columns), y * width + left);
    }
  });
  return { width, height, west: tie[3]!, north: tie[4]!, cell: one(TAG.pixelScale), heights };
}

const started = performance.now();
if (!existsSync(resolve(SOURCE_DIR, ETOPO_WORLD))) {
  // Cutting a master in the Debug map runs this without fetching first; the quick start and npm run world:height
  // fetch it. Nothing is taken away: the tiles there are left as they are.
  console.log(
    `no ${ETOPO_WORLD} in world/source, so no height cut: npm run world:height --prefix frontend fetches it`,
  );
  process.exit(0);
}
const grid = readEtopo(resolve(SOURCE_DIR, ETOPO_WORLD));
const east = grid.west + grid.width * grid.cell;
const south = grid.north - grid.height * grid.cell;
console.log(
  `ETOPO ${grid.width} by ${grid.height}, ${grid.west} to ${east} east, ${south} to ${grid.north} north`,
);
const [WEST, SOUTH, EAST, NORTH] = HEIGHT_BOUNDS;
if (grid.west > WEST + 1e-6 || east < EAST - 1e-6 || south > SOUTH || grid.north < NORTH) {
  throw new Error(
    `the grid reaches ${[grid.west, south, east, grid.north].join()}; the page asks within ${HEIGHT_BOUNDS.join()}`,
  );
}

const pyramid: HeightGrid[] = [grid];
while (pyramid.at(-1)!.width > 64) {
  pyramid.push(halve(pyramid.at(-1)!));
}

const originDir = resolve(OUTPUT_DIR, worldDirOf(master), 'origin');
const fitting = existsSync(resolve(originDir, 'origin.json'))
  ? await (async () => {
      const file = JSON.parse(await readFile(resolve(originDir, 'origin.json'), 'utf8')) as OriginFile;
      const bytes = await readFile(resolve(originDir, 'origin.bin'));
      const origin = decodeOrigin(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        file,
      );
      const size = { width: file.width, height: file.height };
      // A cell of the fill read from the level of about a cell's size: the mean of the ground it came from.
      const coarse =
        pyramid[levelFor(((360 / file.width) * file.cell) / FILL_SPLIT, grid.cell, pyramid.length)]!;
      const fill = fillOf(origin, size, (lon, lat) => heightAt(coarse, lon, lat));
      const madeAt = (await stat(resolve(originDir, 'origin.json'))).mtime.toISOString();
      return { file, origin, size, fill, madeAt };
    })()
  : null;
console.log(
  fitting === null
    ? `${master} has no origin map, so its height is plain Earth's: npm run world:origin --prefix frontend -- ${master}`
    : `fitted to ${master} through its origin map of ${fitting.madeAt}: ${fitting.file.counts.earth} squares from Earth, ` +
        `${fitting.file.counts.clone} copies, ${fitting.file.counts.invented} invented and filled from around them`,
);
/** The master's height at a longitude and latitude of the world, from one level of the pyramid. */
const heightOf = (level: HeightGrid): EarthHeight => {
  const earth: EarthHeight = (lon, lat) => heightAt(level, lon, lat);
  return fitting === null
    ? (lon, lat) => Math.max(0, earth(lon, lat))
    : fittedHeight(fitting.origin, fitting.size, fitting.fill, earth);
};

const within = (tile: number, zoom: number) => Math.min(2 ** zoom - 1, Math.max(0, Math.floor(tile)));
const tileX = (lon: number, zoom: number) => within(((lon + 180) / 360) * 2 ** zoom, zoom);
const tileY = (lat: number, zoom: number) =>
  within(((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * 2 ** zoom, zoom);

await rm(outputDir, { recursive: true, force: true });
const highest = { metres: -Infinity, lon: 0, lat: 0 };
let tiles = 0;
let bytes = 0;

for (let zoom = 0; zoom <= maxZoom; zoom += 1) {
  const size = TILE_SIZE * 2 ** zoom;
  const level = pyramid[levelFor(360 / size, grid.cell, pyramid.length)]!;
  const metresAt = heightOf(level);
  let written = 0;
  for (let x = tileX(WEST, zoom); x <= tileX(EAST - 1e-9, zoom); x += 1) {
    await mkdir(resolve(outputDir, String(zoom), String(x)), { recursive: true });
    // A column's tiles are encoded together, so the encoder's own threads work while the next heights are read.
    const encoding: Promise<void>[] = [];
    for (let y = tileY(NORTH, zoom); y <= tileY(SOUTH, zoom); y += 1) {
      const pixels = new Uint8Array(TILE_SIZE * TILE_SIZE * 3);
      for (let py = 0; py < TILE_SIZE; py += 1) {
        const lat =
          (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y * TILE_SIZE + py + 0.5)) / size))) * 180) / Math.PI;
        for (let px = 0; px < TILE_SIZE; px += 1) {
          const lon = ((x * TILE_SIZE + px + 0.5) / size) * 360 - 180;
          const metres = metresAt(lon, lat);
          if (metres > highest.metres) {
            Object.assign(highest, { metres, lon, lat });
          }
          toTerrarium(metres, pixels, (py * TILE_SIZE + px) * 3);
        }
      }
      const into = resolve(outputDir, String(zoom), String(x), `${y}.${HEIGHT_FORMAT}`);
      encoding.push(
        sharp(pixels, { raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 3 } })
          .webp({ lossless: true, effort: 4 })
          .toFile(into)
          .then((saved) => {
            bytes += saved.size;
          }),
      );
      written += 1;
    }
    await Promise.all(encoding);
  }
  tiles += written;
  console.log(`  zoom ${zoom}: ${written} tiles, read at ${(level.cell * 3600).toFixed(0)} arc-seconds`);
}

await writeFile(
  resolve(outputDir, 'height.json'),
  `${JSON.stringify(
    {
      source: 'ETOPO 2022, 60 arc-seconds, NOAA NCEI, public domain',
      encoding: 'terrarium',
      format: HEIGHT_FORMAT,
      tileSize: TILE_SIZE,
      maxzoom: maxZoom,
      bounds: HEIGHT_BOUNDS,
      fitted: fitting === null ? null : { master, origin: fitting.madeAt, from: fitting.file.from },
      highest: {
        metres: Math.round(highest.metres),
        lon: +highest.lon.toFixed(3),
        lat: +highest.lat.toFixed(3),
      },
    },
    null,
    2,
  )}\n`,
);

console.log(
  `\n${tiles} height tiles, ${(bytes / 1048576).toFixed(1)} MB, into ${outputDir}` +
    `\nhighest ${Math.round(highest.metres)} m at ${highest.lat.toFixed(3)} N ${highest.lon.toFixed(3)} E` +
    ` (Everest is 8,849 m at 27.988 N 86.925 E on Earth, where the master has not moved it)` +
    `\n${((performance.now() - started) / 1000).toFixed(1)} s`,
);
