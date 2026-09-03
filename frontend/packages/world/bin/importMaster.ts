import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';

import { PNG } from 'pngjs';

import { byId, paletteProblems, preparePalette, snapPrepared, toRgb } from '../src/palette.ts';
import type { Palette, Rgb } from '../src/palette.ts';
import { createRaster } from '../src/raster.ts';
import type { ClassRaster } from '../src/raster.ts';
import { encodeIndexedPng } from '../src/png.ts';
import { doubleSignedArea, simplify, smooth } from '../src/simplify.ts';
import { MAX_MERCATOR_LATITUDE } from '../src/sphere.ts';
import { toLngLat, traceClass } from '../src/trace.ts';
import type { Ring } from '../src/trace.ts';

import { MASTER_DIR, OUTPUT_DIR, PALETTE } from './paths.ts';

/**
 * Reads the hand-edited master and gives the game its world.
 *
 * Every pixel is snapped to the terrain class it is nearest, so the fringe an image editor leaves along a
 * transformed edge becomes a clean boundary instead of an error. Then each class is traced into outlines,
 * simplified and smoothed, and written as one file of shapes the map can draw. A small copy of the terrain
 * grid goes out alongside it, for the questions the game asks of a place rather than of a shape.
 *
 * See docs/AUTHORING-THE-WORLD.md.
 */

/**
 * Below this many square pixels a shape is a speck. At 2.4 kilometres a pixel this is about 140 square
 * kilometres, which keeps a real island like Gotland, at some five hundred pixels, and throws away the
 * fringe left where two datasets disagree about where a coast is.
 */
const SMALLEST_SHAPE = 24;
/** How far a vertex may be moved to be dropped, in pixels of the master. */
const SIMPLIFY_TOLERANCE = 2;
const SMOOTHING_PASSES = 1;
/**
 * Smoothing puts two points where each corner was, most of them on runs that are straight again
 * afterwards. This second, gentler pass takes those back out.
 */
const TIDY_TOLERANCE = 0.7;
/** The terrain grid the game keeps for lookups, small enough to load without thinking about it. */
const LOOKUP_WIDTH = 2048;
/** A colour further than this from every class was probably not chosen on purpose. */
const SUSPICIOUS_DISTANCE = 24;

const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette;
const problems = paletteProblems(palette);
if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`palette: ${problem.kind}: ${problem.detail}`);
  }
  throw new Error('the palette is unusable; fix world/palette.json');
}

/** Reads `world/master/terrain.png` unless told otherwise, so a fresh master can be judged first. */
const named = process.argv[2];
const masterPath = named === undefined ? resolve(MASTER_DIR, 'terrain.png') : resolve(named);
const decoded = PNG.sync.read(await readFile(masterPath));
console.log(`read ${decoded.width} by ${decoded.height} from ${masterPath}\n`);

if (decoded.width !== palette.master.width || decoded.height !== palette.master.height) {
  console.warn(
    `the master is ${decoded.width} by ${decoded.height}, and world/palette.json expects ` +
      `${palette.master.width} by ${palette.master.height}. Reading it as it is.`,
  );
}

const raster: ClassRaster = createRaster(decoded.width, decoded.height);
const prepared = preparePalette(palette);
const reached = new Map<string, { count: number; distance: number }>();
let snapped = 0;

/**
 * Every distinct colour, answered once. A world has a handful of colours and a hundred million pixels, so
 * without this the same thirteen answers would be worked out over and over.
 */
const remembered = new Int16Array(1 << 24).fill(-1);
const rememberedDistance = new Float32Array(1 << 24);

const pixels = raster.cells.length;
const step = Math.ceil(pixels / 8);
console.log(`snapping ${(pixels / 1e6).toFixed(0)} megapixels to ${palette.classes.length} classes`);

for (let index = 0; index < pixels; index += 1) {
  const at = index * 4;
  const red = decoded.data[at]!;
  const green = decoded.data[at + 1]!;
  const blue = decoded.data[at + 2]!;
  const colour = (red << 16) | (green << 8) | blue;

  let id = remembered[colour]!;
  let distance: number;
  if (id < 0) {
    const found = snapPrepared([red, green, blue], prepared);
    id = found.id;
    distance = found.distance;
    remembered[colour] = id;
    rememberedDistance[colour] = distance;
  } else {
    distance = rememberedDistance[colour]!;
  }

  raster.cells[index] = id;

  if (distance > 0) {
    snapped += 1;
    if (distance > SUSPICIOUS_DISTANCE && reached.size < 64) {
      const name = `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
      const seen = reached.get(name) ?? { count: 0, distance };
      reached.set(name, { count: seen.count + 1, distance: Math.max(seen.distance, distance) });
    }
  }

  if (index % step === step - 1) {
    console.log(`  ${Math.round(((index + 1) / pixels) * 100)} %`);
  }
}

const total = raster.cells.length;
console.log(`${((snapped / total) * 100).toFixed(3)} % of pixels were not an exact class colour`);
if (reached.size > 0) {
  const worst = [...reached.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8);
  console.log('colours nowhere near a class, which usually means a feathered edit:');
  for (const [colour, { count, distance }] of worst) {
    console.log(`  ${colour} ${String(count).padStart(9)} pixels, ${distance.toFixed(0)} away`);
  }
}

interface ShapeFeature {
  type: 'Feature';
  properties: { class: string; id: number };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

const features: ShapeFeature[] = [];
// Four decimals is about eleven metres, far finer than a world painted at 2.4 kilometres a pixel.
const round = (value: number) => Number(value.toFixed(4));
/**
 * Mercator sends the poles to infinity, so a shape traced to the very edge of the image would carry a
 * coordinate the map cannot project. Antarctica reaches that edge, and four such points were enough to
 * stop the whole world from loading, silently, with the source simply never appearing.
 */
const holdInsideMercator = (latitude: number) =>
  Math.min(MAX_MERCATOR_LATITUDE, Math.max(-MAX_MERCATOR_LATITUDE, latitude));

/**
 * The coast is the one line that matters most, and no single class describes it: it is where anything that
 * is not sea meets the sea. So it is traced from a copy of the world reduced to land and water.
 */
const landMask = createRaster(raster.width, raster.height);
for (let index = 0; index < raster.cells.length; index += 1) {
  landMask.cells[index] = raster.cells[index] === 0 ? 0 : 1;
}

interface TraceTarget {
  name: string;
  id: number;
  from: ClassRaster;
  value: number;
}

const targets: TraceTarget[] = [
  { name: 'land', id: -1, from: landMask, value: 1 },
  ...palette.classes
    .filter((terrain) => terrain.id !== 0)
    .map((terrain) => ({ name: terrain.name, id: terrain.id, from: raster, value: terrain.id })),
];

console.log('\ntracing:');
for (const terrain of targets) {
  let kept = 0;
  let dropped = 0;
  let vertices = 0;

  for (const ring of traceClass(terrain.from, terrain.value)) {
    if (Math.abs(doubleSignedArea(ring)) / 2 < SMALLEST_SHAPE) {
      dropped += 1;
      continue;
    }

    const shaped: Ring = simplify(
      smooth(simplify(ring, SIMPLIFY_TOLERANCE), SMOOTHING_PASSES),
      TIDY_TOLERANCE,
    );
    if (shaped.length < 4) {
      dropped += 1;
      continue;
    }

    const coordinates = shaped.map((point) => {
      const [lng, lat] = toLngLat(point, terrain.from);
      return [round(lng), round(holdInsideMercator(lat))];
    });

    features.push({
      type: 'Feature',
      properties: { class: terrain.name, id: terrain.id },
      geometry: { type: 'Polygon', coordinates: [coordinates] },
    });
    kept += 1;
    vertices += coordinates.length;
  }

  const note = dropped > 0 ? `, ${dropped} too small` : '';
  console.log(
    `  ${terrain.name.padEnd(18)} ${String(kept).padStart(6)} shapes, ` +
      `${String(vertices).padStart(8)} points${note}`,
  );
}

await mkdir(OUTPUT_DIR, { recursive: true });
const shapes = JSON.stringify({ type: 'FeatureCollection', features });
await writeFile(resolve(OUTPUT_DIR, 'terrain.geojson'), shapes);

// The grid the game asks questions of: what terrain is under this place, and is it land at all.
const scale = Math.max(1, Math.round(raster.width / LOOKUP_WIDTH));
const lookup = createRaster(Math.floor(raster.width / scale), Math.floor(raster.height / scale));
for (let row = 0; row < lookup.height; row += 1) {
  for (let column = 0; column < lookup.width; column += 1) {
    lookup.cells[row * lookup.width + column] =
      raster.cells[row * scale * raster.width + column * scale] ?? 0;
  }
}

const index = byId(palette);
const colours: Rgb[] = [];
for (let id = 0; id <= Math.max(...palette.classes.map((terrain) => terrain.id)); id += 1) {
  colours.push(toRgb(index.get(id)?.colour ?? '#ff00ff'));
}
await writeFile(
  resolve(OUTPUT_DIR, 'terrain-lookup.png'),
  encodeIndexedPng(lookup, colours, (data) => new Uint8Array(deflateSync(data, { level: 9 }))),
);

/**
 * A small copy of the world for glancing at, written here rather than by the master build because this
 * is the only place that reads the image the game is actually drawn from. Nearest neighbour, since
 * averaging two terrain classes would invent a third.
 */
const previewScale = Math.max(1, Math.round(raster.width / 2048));
const preview = createRaster(
  Math.floor(raster.width / previewScale),
  Math.floor(raster.height / previewScale),
);
for (let row = 0; row < preview.height; row += 1) {
  for (let column = 0; column < preview.width; column += 1) {
    preview.cells[row * preview.width + column] =
      raster.cells[row * previewScale * raster.width + column * previewScale] ?? 0;
  }
}
await writeFile(
  resolve(MASTER_DIR, 'terrain-preview.png'),
  encodeIndexedPng(preview, colours, (data) => new Uint8Array(deflateSync(data, { level: 9 }))),
);

console.log(`\n${features.length} shapes, ${(shapes.length / 1048576).toFixed(2)} MB`);
console.log(`lookup grid ${lookup.width} by ${lookup.height}`);
console.log(`into ${OUTPUT_DIR}`);
