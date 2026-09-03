import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';

import { classHistogram, createRaster, fillPolygon, strokeLine } from '../src/raster.ts';
import type { ClassRaster, Ring } from '../src/raster.ts';
import { encodeIndexedPng } from '../src/png.ts';
import { byId, paletteProblems, toRgb } from '../src/palette.ts';
import type { Palette, Rgb } from '../src/palette.ts';
import type { Feature } from '../src/geometry.ts';

import { MASTER_CONFIG, MASTER_DIR, PALETTE } from './paths.ts';
import { streamFeatures } from './sources.ts';

/**
 * Paints the master image: the world as one terrain class per pixel, from real Earth data.
 *
 * This is the file a human then edits. Everything the game knows about the shape of the world is derived
 * from it afterwards, so this script exists to give the editing a starting point, not to have the last
 * word. See docs/AUTHORING-THE-WORLD.md.
 */

interface LayerSpec {
  source: string;
  class?: string;
  classFrom?: { property: string; map: Record<string, string> };
  /** Present for a layer of lines, such as rivers, which would vanish if it were filled. */
  lineWidth?: number;
}

interface MasterConfig {
  base: string;
  layers: LayerSpec[];
}

const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette;
const problems = paletteProblems(palette);
if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`palette: ${problem.kind}: ${problem.detail}`);
  }
  throw new Error('the palette is unusable; fix world/palette.json');
}

const config = JSON.parse(await readFile(MASTER_CONFIG, 'utf8')) as MasterConfig;
const idOf = new Map(palette.classes.map((terrain) => [terrain.name, terrain.id]));
const classOf = (name: string): number => {
  const id = idOf.get(name);
  if (id === undefined) {
    throw new Error(`${name} is not a class in world/palette.json`);
  }
  return id;
};

const { width, height } = palette.master;
const raster: ClassRaster = createRaster(width, height, classOf(config.base));
console.log(`painting ${width} by ${height}, starting from ${config.base}\n`);

/** Rings of one feature, whatever geometry it happens to carry. */
function ringsOf(feature: Feature): Ring[][] {
  const geometry = feature.geometry;
  if (geometry === null) {
    return [];
  }
  switch (geometry.type) {
    case 'Polygon':
      return [geometry.coordinates as Ring[]];
    case 'MultiPolygon':
      return geometry.coordinates as Ring[][];
    case 'LineString':
      return [[geometry.coordinates as Ring]];
    case 'MultiLineString':
      return (geometry.coordinates as Ring[]).map((line) => [line]);
    default:
      return [];
  }
}

for (const layer of config.layers) {
  let painted = 0;
  let skipped = 0;

  for await (const feature of streamFeatures(layer.source)) {
    let value: number | undefined;
    if (layer.class !== undefined) {
      value = classOf(layer.class);
    } else if (layer.classFrom !== undefined) {
      const raw = feature.properties?.[layer.classFrom.property];
      const name = layer.classFrom.map[String(raw)];
      value = name === undefined ? undefined : classOf(name);
    }

    if (value === undefined) {
      skipped += 1;
      continue;
    }

    for (const rings of ringsOf(feature)) {
      if (layer.lineWidth !== undefined) {
        for (const line of rings) {
          strokeLine(raster, line, value, layer.lineWidth);
        }
      } else {
        fillPolygon(raster, rings, value);
      }
    }
    painted += 1;
  }

  const note = skipped > 0 ? `, ${skipped} without a class of ours` : '';
  console.log(`${layer.source.padEnd(42)} ${String(painted).padStart(5)} painted${note}`);
}

const colours: Rgb[] = [];
for (let id = 0; id <= Math.max(...palette.classes.map((terrain) => terrain.id)); id += 1) {
  colours.push(toRgb(byId(palette).get(id)?.colour ?? '#ff00ff'));
}

await mkdir(MASTER_DIR, { recursive: true });
const png = encodeIndexedPng(raster, colours, (data) => new Uint8Array(deflateSync(data, { level: 9 })));
await writeFile(resolve(MASTER_DIR, 'terrain.png'), png);

/** A strip of the palette, so that colours can be picked with an eyedropper rather than typed. */
const swatchHeight = 64;
const swatch = createRaster(palette.classes.length * swatchHeight, swatchHeight);
palette.classes.forEach((terrain, index) => {
  for (let row = 0; row < swatchHeight; row += 1) {
    swatch.cells.fill(
      terrain.id,
      row * swatch.width + index * swatchHeight,
      row * swatch.width + (index + 1) * swatchHeight,
    );
  }
});
await writeFile(
  resolve(MASTER_DIR, 'palette-strip.png'),
  encodeIndexedPng(swatch, colours, (data) => new Uint8Array(deflateSync(data, { level: 9 }))),
);

/**
 * A small copy for looking at. The master is far too large to open casually, and a glance at the whole
 * world is the quickest way to see that a build did what was asked. Nearest neighbour, because averaging
 * two terrain classes would invent a third.
 */
const PREVIEW_WIDTH = 2048;
const previewScale = Math.round(width / PREVIEW_WIDTH);
const preview = createRaster(Math.floor(width / previewScale), Math.floor(height / previewScale));
for (let row = 0; row < preview.height; row += 1) {
  for (let column = 0; column < preview.width; column += 1) {
    preview.cells[row * preview.width + column] =
      raster.cells[row * previewScale * width + column * previewScale] ?? 0;
  }
}
await writeFile(
  resolve(MASTER_DIR, 'terrain-preview.png'),
  encodeIndexedPng(preview, colours, (data) => new Uint8Array(deflateSync(data, { level: 9 }))),
);

const counts = classHistogram(raster);
const total = width * height;
console.log('\nthe world, by area:');
for (const terrain of palette.classes) {
  const share = ((counts.get(terrain.id) ?? 0) / total) * 100;
  console.log(`  ${terrain.name.padEnd(18)} ${share.toFixed(2).padStart(6)} %`);
}
console.log(`\nterrain.png is ${(png.length / 1048576).toFixed(2)} MB, in ${MASTER_DIR}`);
