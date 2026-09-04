import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';

import { PNG } from 'pngjs';

import { preparePalette, snapPrepared, toRgb } from '../src/palette.ts';
import type { Palette, Rgb } from '../src/palette.ts';
import { createRaster } from '../src/raster.ts';
import type { ClassRaster } from '../src/raster.ts';
import { encodeRgbPng } from '../src/png.ts';
import type { RgbImage } from '../src/png.ts';
import { paintPixel, preparePainterly } from '../src/painterly.ts';
import type { ClassSampler, PainterlyStyle } from '../src/painterly.ts';

import { MASTER_DIR, PAINTERLY, PAINTERLY_DIR, PALETTE, RENDER } from './paths.ts';

/**
 * Paints views of the world, to settle what the world looks like.
 *
 * This is a spike, and it is deliberately offline. The unknown here is the look, not the plumbing: a
 * still image at full resolution answers what painterly should mean for this map, and it answers it in
 * twenty-five seconds against a style file that can be edited and rerun. Once the look is agreed, the
 * functions in `src/painterly.ts` port to a fragment shader and the live map draws them at any zoom.
 *
 * Every view is written twice, painted and flat, because the only useful judgement is the comparison.
 *
 *   node bin/renderPainterly.ts [--view name] [--out directory] [--width pixels]
 */

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? undefined : args[at + 1];
};

interface View {
  name: string;
  lng: [number, number];
  lat: [number, number];
  width: number;
}

const outputDir = flag('out') ?? PAINTERLY_DIR;
const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette;
const render = JSON.parse(await readFile(RENDER, 'utf8')) as { colours: Record<string, string> };
const style = JSON.parse(await readFile(PAINTERLY, 'utf8')) as PainterlyStyle & { views: View[] };

const prepared = preparePainterly(style, palette, render.colours);

/** The flat look, for the comparison: the colour of the class, and nothing else. */
const flatColours: Rgb[] = [];
for (let id = 0; id <= Math.max(...palette.classes.map((terrain) => terrain.id)); id += 1) {
  const terrain = palette.classes.find((candidate) => candidate.id === id);
  flatColours.push(toRgb(terrain === undefined ? style.cool : render.colours[terrain.name]!));
}

const only = flag('view');
const views = only === undefined ? style.views : style.views.filter((view) => view.name === only);
if (views.length === 0) {
  throw new Error(
    `no view called ${only}; world/painterly.json has ${style.views.map((v) => v.name).join(', ')}`,
  );
}

/**
 * The master, as one class per pixel. Read inside a function so the two gigabytes of RGBA that pngjs
 * hands back can be collected before any painting starts.
 */
function readMaster(): ClassRaster {
  const started = Date.now();
  const decoded = PNG.sync.read(readFileSync(resolve(MASTER_DIR, 'terrain.png')));
  const world = createRaster(decoded.width, decoded.height);
  const memo = new Int16Array(1 << 24).fill(-1);
  const preparedPalette = preparePalette(palette);

  for (let index = 0; index < world.cells.length; index += 1) {
    const at = index * 4;
    const red = decoded.data[at]!;
    const green = decoded.data[at + 1]!;
    const blue = decoded.data[at + 2]!;
    const colour = (red << 16) | (green << 8) | blue;
    let id = memo[colour]!;
    if (id < 0) {
      id = snapPrepared([red, green, blue], preparedPalette).id;
      memo[colour] = id;
    }
    world.cells[index] = id;
  }

  console.log(
    `master ${world.width} by ${world.height}, read in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  return world;
}

const RADIANS = Math.PI / 180;

/** Web Mercator's vertical coordinate. The map is linear in this and the master is linear in latitude. */
function mercatorY(latitude: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (latitude * RADIANS) / 2));
}

function latitudeAt(y: number): number {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RADIANS;
}

/**
 * One view, painted or flat.
 *
 * The view is in Web Mercator so that it is directly comparable with a screenshot of the running map,
 * which means every row has its latitude converted rather than scaled. `masterPerPixel` falls out of the
 * width asked for, and it is the whole of what the paint knows about the view.
 */
function renderView(view: View, world: ClassRaster, classAt: ClassSampler, paint: boolean): RgbImage {
  const [west, east] = view.lng;
  const [south, north] = view.lat;
  const width = Number(flag('width') ?? view.width);
  const top = mercatorY(north);
  const bottom = mercatorY(south);
  const height = Math.max(1, Math.round((width * (top - bottom)) / ((east - west) * RADIANS)));
  const masterPerPixel = (world.width * ((east - west) / 360)) / width;

  const pixels = new Uint8Array(width * height * 3);
  let at = 0;

  for (let row = 0; row < height; row += 1) {
    const latitude = latitudeAt(top - ((top - bottom) * (row + 0.5)) / height);
    const worldY = ((90 - latitude) / 180) * world.height;
    for (let column = 0; column < width; column += 1) {
      const longitude = west + ((east - west) * (column + 0.5)) / width;
      const worldX = ((longitude + 180) / 360) * world.width;
      const colour = paint
        ? paintPixel(prepared, classAt, worldX, worldY, masterPerPixel)
        : (flatColours[classAt(worldX, worldY)] ?? flatColours[0]!);
      pixels[at] = colour[0];
      pixels[at + 1] = colour[1];
      pixels[at + 2] = colour[2];
      at += 3;
    }
  }

  return { width, height, pixels };
}

const world = readMaster();

/**
 * Nearest, always: the average of two terrains is a third terrain. Longitude wraps, because the world
 * does; latitude clamps, because it does not.
 */
const classAt: ClassSampler = (x, y) => {
  const column = ((Math.floor(x) % world.width) + world.width) % world.width;
  const row = Math.min(world.height - 1, Math.max(0, Math.floor(y)));
  return world.cells[row * world.width + column]!;
};

await mkdir(outputDir, { recursive: true });
const deflate = (data: Uint8Array) => new Uint8Array(deflateSync(data, { level: 6 }));

console.log(`\npainting ${views.length} view${views.length === 1 ? '' : 's'} into ${outputDir}\n`);

for (const view of views) {
  for (const paint of [true, false]) {
    const started = Date.now();
    const image = renderView(view, world, classAt, paint);
    const png = encodeRgbPng(image, deflate);
    const name = paint ? `${view.name}.png` : `${view.name}-flat.png`;
    await writeFile(resolve(outputDir, name), png);

    const perPixel =
      (world.width * ((view.lng[1] - view.lng[0]) / 360)) / Number(flag('width') ?? view.width);
    const note = paint
      ? `${image.width} by ${image.height}, ${perPixel.toFixed(2)} master pixels a pixel, ` +
        `about zoom ${(7 - Math.log2(perPixel)).toFixed(1)}`
      : 'the same view, flat';
    console.log(
      `  ${name.padEnd(24)} ${(png.length / 1048576).toFixed(1)} MB  ` +
        `${((Date.now() - started) / 1000).toFixed(1)}s  ${note}`,
    );
  }
}

console.log(`\n${views.length * 2} images written. Every view is painted and flat, so they can be compared.`);
