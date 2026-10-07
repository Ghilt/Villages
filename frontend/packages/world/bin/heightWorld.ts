import { readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

import {
  HEIGHT_BOUNDS,
  HEIGHT_MAX_ZOOM,
  edgeWeight,
  halve,
  heightAt,
  levelFor,
  toTerrarium,
  undoFloatPredictor,
} from '../src/height.ts';
import type { HeightGrid } from '../src/height.ts';
import { DEFAULT_MASTER, masterNameOf, worldDirOf } from '../src/masters.ts';
import { encodeRgbPng } from '../src/png.ts';
import { TILE_SIZE } from '../src/tiles.ts';

import { flag, named } from './lib/flags.ts';
import { OUTPUT_DIR, SOURCE_DIR, masterAt } from './lib/paths.ts';
import { ETOPO_TILES } from './lib/worldSources.ts';

/**
 * Height tiles for the relief experiment (0016): ETOPO 2022 cut into Terrarium PNGs beside a master's other
 * tiles, for MapLibre's hillshade to read.
 *
 *   node bin/heightWorld.ts [master] [--max-zoom 8] [--band 1]
 *
 * Reads the 15-degree tiles `worldSources.ts` lists from `world/source/etopo/`, which
 * `npm run world:fetch-all -- --only etopo` fetches, joins them into one grid, and writes every tile from zoom
 * nought to `--max-zoom` that touches it into `public/world/masters/<master>/height/`, with `height.json`
 * saying where the height reaches. A pixel reads the level of a pyramid of halved grids nearest its own size,
 * so a tile far out is the mean of the ground under it rather than a few points of it. The sea is held at
 * nought, so the shading stops at the shore, and the height eases to nothing over `--band` degrees inside the
 * grid's edge, so that the edge is not shaded as a cliff.
 *
 * It reads real Earth and nothing of the master: wherever the master has moved the land, the relief lies in
 * the wrong place, and seeing whether that matters is part of the experiment.
 */

const masterPath = masterAt(named[0]);
const master = masterNameOf(basename(masterPath)) ?? DEFAULT_MASTER;
const outputDir = resolve(OUTPUT_DIR, worldDirOf(master), 'height');
const maxZoom = Number(flag('max-zoom') ?? HEIGHT_MAX_ZOOM);
const band = Number(flag('band') ?? 1);

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

/** Grids that tile a rectangle between them, as one. */
function join(parts: readonly HeightGrid[]): HeightGrid {
  const cell = parts[0]!.cell;
  const west = Math.min(...parts.map((part) => part.west));
  const north = Math.max(...parts.map((part) => part.north));
  const east = Math.max(...parts.map((part) => part.west + part.width * cell));
  const south = Math.min(...parts.map((part) => part.north - part.height * cell));
  const width = Math.round((east - west) / cell);
  const height = Math.round((north - south) / cell);
  const heights = new Float32Array(width * height);
  for (const part of parts) {
    const left = Math.round((part.west - west) / cell);
    const top = Math.round((north - part.north) / cell);
    for (let r = 0; r < part.height; r += 1) {
      heights.set(part.heights.subarray(r * part.width, (r + 1) * part.width), (top + r) * width + left);
    }
  }
  return { width, height, west, north, cell, heights };
}

const started = performance.now();
const grid = join(
  ETOPO_TILES.map((tile) => readEtopo(resolve(SOURCE_DIR, 'etopo', `ETOPO_2022_v1_15s_${tile}_surface.tif`))),
);
const east = grid.west + grid.width * grid.cell;
const south = grid.north - grid.height * grid.cell;
console.log(
  `ETOPO ${grid.width} by ${grid.height}, ${grid.west} to ${east} east, ${south} to ${grid.north} north`,
);
if ([grid.west, south, east, grid.north].join() !== HEIGHT_BOUNDS.join()) {
  throw new Error(
    `the tiles reach ${[grid.west, south, east, grid.north].join()}; the page asks within ${HEIGHT_BOUNDS.join()}`,
  );
}

const pyramid: HeightGrid[] = [grid];
while (pyramid.at(-1)!.width > 64) {
  pyramid.push(halve(pyramid.at(-1)!));
}

const tileX = (lon: number, zoom: number) => Math.floor(((lon + 180) / 360) * 2 ** zoom);
const tileY = (lat: number, zoom: number) =>
  Math.floor(((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * 2 ** zoom);

await rm(outputDir, { recursive: true, force: true });
const highest = { metres: -Infinity, lon: 0, lat: 0 };
let tiles = 0;
let bytes = 0;

for (let zoom = 0; zoom <= maxZoom; zoom += 1) {
  const size = TILE_SIZE * 2 ** zoom;
  const level = pyramid[levelFor(360 / size, grid.cell, pyramid.length)]!;
  let written = 0;
  for (let x = tileX(grid.west, zoom); x <= tileX(east - 1e-9, zoom); x += 1) {
    await mkdir(resolve(outputDir, String(zoom), String(x)), { recursive: true });
    for (let y = tileY(grid.north, zoom); y <= tileY(south + 1e-9, zoom); y += 1) {
      const pixels = new Uint8Array(TILE_SIZE * TILE_SIZE * 3);
      for (let py = 0; py < TILE_SIZE; py += 1) {
        const lat =
          (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y * TILE_SIZE + py + 0.5)) / size))) * 180) / Math.PI;
        for (let px = 0; px < TILE_SIZE; px += 1) {
          const lon = ((x * TILE_SIZE + px + 0.5) / size) * 360 - 180;
          const metres = Math.max(0, heightAt(level, lon, lat) * edgeWeight(grid, lon, lat, band));
          if (metres > highest.metres) {
            Object.assign(highest, { metres, lon, lat });
          }
          toTerrarium(metres, pixels, (py * TILE_SIZE + px) * 3);
        }
      }
      const png = encodeRgbPng({ width: TILE_SIZE, height: TILE_SIZE, pixels }, deflateSync);
      await writeFile(resolve(outputDir, String(zoom), String(x), `${y}.png`), png);
      bytes += png.length;
      written += 1;
    }
  }
  tiles += written;
  console.log(`  zoom ${zoom}: ${written} tiles, read at ${(level.cell * 3600).toFixed(0)} arc-seconds`);
}

await writeFile(
  resolve(outputDir, 'height.json'),
  `${JSON.stringify(
    {
      source: 'ETOPO 2022, 15 arc-seconds, NOAA NCEI, public domain',
      encoding: 'terrarium',
      tileSize: TILE_SIZE,
      maxzoom: maxZoom,
      bounds: [grid.west, south, east, grid.north],
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
    ` (Mont Blanc is 4,806 m at 45.833 N 6.865 E)` +
    `\n${((performance.now() - started) / 1000).toFixed(1)} s`,
);
