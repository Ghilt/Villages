import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';

import { classHistogram, createRaster, fillPolygon, strokeLine } from '../src/raster.ts';
import type { ClassRaster, Ring } from '../src/raster.ts';
import { encodeIndexedPng } from '../src/png.ts';
import { byId, paletteProblems, toRgb } from '../src/palette.ts';
import { fillUnassigned } from '../src/fill.ts';
import type { Palette, Rgb } from '../src/palette.ts';
import type { Feature } from '../src/geometry.ts';

import { MASTER_CONFIG, MASTER_DIR, PALETTE } from './paths.ts';
import { streamFeatures } from './sources.ts';

/**
 * Paints a master image: the world as one terrain class per pixel, from real Earth data.
 *
 * STALE. This built the thirteen-class master. The world now has thirty-two classes and is painted by the
 * generator in `world/master/experiment/tools`, from land cover, lake and river data this script knows
 * nothing about. It will refuse to run against the current palette, because the class names in
 * `world/master.json` no longer exist, and that is the intended behaviour until the newer generator is
 * ported into this package. See the last section of `world/master/experiment/README.md`.
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
/**
 * Land whose terrain has not been decided yet. Deliberately not a class in the palette: it exists only
 * while the master is being painted, and the fill resolves every one of them before anything is written,
 * so a human never sees it and can never paint with it.
 */
const UNASSIGNED = 255;

const idOf = new Map(palette.classes.map((terrain) => [terrain.name, terrain.id]));
const classOf = (name: string): number => {
  if (name === 'unassigned') {
    return UNASSIGNED;
  }
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
  let covered = 0;

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
        covered += fillPolygon(raster, rings, value);
      }
    }
    painted += 1;
  }

  const note = skipped > 0 ? `, ${skipped} without a class of ours` : '';
  console.log(
    `${layer.source.padEnd(42)} ${String(painted).padStart(5)} painted, ` +
      `${covered.toLocaleString('en')} pixels${note}`,
  );
}

// Resolve the coastal fringe before anything is written, so no sliver of a fallback terrain survives.
const water = new Set(
  palette.classes.filter((terrain) => terrain.water === true).map((terrain) => terrain.id),
);
const fill = fillUnassigned(raster, {
  sentinel: UNASSIGNED,
  blocked: water,
  fallback: classOf('grassland'),
});
console.log(
  `
fringe: ${fill.unassigned} pixels had land but no terrain; ` +
    `${fill.filled} took it from their neighbours in ${fill.passes} passes, ${fill.fellBack} fell back`,
);
if (raster.cells.includes(UNASSIGNED)) {
  throw new Error('the fill left pixels unassigned, which must never reach the master');
}

const colours: Rgb[] = [];
for (let id = 0; id <= Math.max(...palette.classes.map((terrain) => terrain.id)); id += 1) {
  colours.push(toRgb(byId(palette).get(id)?.colour ?? '#ff00ff'));
}

await mkdir(MASTER_DIR, { recursive: true });
const png = encodeIndexedPng(raster, colours, (data) => new Uint8Array(deflateSync(data, { level: 9 })));

/**
 * The master is hand-authored, so a rebuild refuses to overwrite one that already exists. It writes
 * alongside instead and says so: replacing a world somebody painted has to be their decision, not a
 * side effect of running a build.
 */
const masterPath = resolve(MASTER_DIR, 'terrain.png');
const spare = resolve(MASTER_DIR, 'terrain-fresh.png');
const forced = process.argv.includes('--force');
const wrote = !existsSync(masterPath) || forced ? masterPath : spare;
await writeFile(wrote, png);

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

const counts = classHistogram(raster);
const total = width * height;
console.log('\nthe world, by area:');
for (const terrain of palette.classes) {
  const share = ((counts.get(terrain.id) ?? 0) / total) * 100;
  console.log(`  ${terrain.name.padEnd(18)} ${share.toFixed(2).padStart(6)} %`);
}
console.log(`\n${(png.length / 1048576).toFixed(2)} MB written to ${wrote}`);
if (wrote === spare) {
  console.log('terrain.png already exists and was left alone. Compare them, and replace it');
  console.log('yourself if the fresh one is what you want, or rerun the build with --force.');
}
