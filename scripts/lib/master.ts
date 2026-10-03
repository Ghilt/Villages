import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodeIndexedPng, readPng } from './png.ts';

/**
 * A master as the tools see it: one terrain class a pixel. The classes and their colours are
 * `world/palette.json`, which is read as data; nothing of the program is imported.
 */

export type Rgb = readonly [number, number, number];

export interface ClassRaster {
  width: number;
  height: number;
  /** One class id per pixel, row by row from the north edge. */
  cells: Uint8Array;
}

export interface TerrainClass {
  id: number;
  name: string;
  colour: Rgb;
}

/** The repository this folder is in: `scripts/lib` is two levels below it. */
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const PALETTE = resolve(REPO, 'world', 'palette.json');

export function readPalette(path = PALETTE): TerrainClass[] {
  const json = JSON.parse(readFileSync(path, 'utf8')) as {
    classes: { id: number; name: string; colour: string }[];
  };
  return json.classes.map(({ id, name, colour }) => ({
    id,
    name,
    colour: [1, 3, 5].map((at) => Number.parseInt(colour.slice(at, at + 2), 16)) as unknown as Rgb,
  }));
}

/** The class whose colour is nearest, and how far it was: 0 for a pixel painted in a class's own colour. */
export function nearestClass(
  colour: Rgb,
  classes: readonly TerrainClass[],
): { id: number; distance: number } {
  let best = { id: classes[0]!.id, distance: Infinity };
  for (const terrain of classes) {
    const distance = Math.hypot(...terrain.colour.map((value, at) => value - colour[at]!));
    if (distance < best.distance) {
      best = { id: terrain.id, distance };
    }
  }
  return best;
}

export interface ReadMaster {
  raster: ClassRaster;
  /** Pixels not painted in a class's own colour, each snapped to the nearest class. */
  offColour: number;
}

/** Reads a master of any eight-bit kind, snapping every colour to the nearest class. */
export async function readMaster(path: string, classes: readonly TerrainClass[]): Promise<ReadMaster> {
  let offColour = 0;
  const remembered = new Int16Array(1 << 24).fill(-1);
  const exact = new Uint8Array(1 << 24);
  const classOf = (red: number, green: number, blue: number) => {
    const colour = (red << 16) | (green << 8) | blue;
    let id = remembered[colour]!;
    if (id < 0) {
      const nearest = nearestClass([red, green, blue], classes);
      id = remembered[colour] = nearest.id;
      exact[colour] = nearest.distance === 0 ? 1 : 0;
    }
    if (exact[colour] === 0) {
      offColour += 1;
    }
    return id;
  };
  let cells = new Uint8Array(0);
  let byIndex: Uint8Array | null = null;
  const offByIndex = new Uint8Array(256);
  const header = await readPng(path, (row, y, { width, height, colourType, channels, palette }) => {
    if (y === 0) {
      cells = new Uint8Array(width * height);
    }
    const at = y * width;
    if (colourType === 3) {
      if (byIndex === null) {
        byIndex = new Uint8Array(256);
        for (let index = 0; index < palette.length / 3; index += 1) {
          const colour: Rgb = [palette[index * 3]!, palette[index * 3 + 1]!, palette[index * 3 + 2]!];
          const nearest = nearestClass(colour, classes);
          byIndex[index] = nearest.id;
          offByIndex[index] = nearest.distance === 0 ? 0 : 1;
        }
      }
      for (let x = 0; x < width; x += 1) {
        const index = row[x]!;
        cells[at + x] = byIndex[index]!;
        offColour += offByIndex[index]!;
      }
      return;
    }
    const grey = colourType === 0 || colourType === 4;
    for (let x = 0; x < width; x += 1) {
      const red = row[x * channels]!;
      cells[at + x] = grey
        ? classOf(red, red, red)
        : classOf(red, row[x * channels + 1]!, row[x * channels + 2]!);
    }
  });
  return { raster: { width: header.width, height: header.height, cells }, offColour };
}

/** The colours a master is written in: every class in its own colour, magenta for an id with no class. */
export function masterColours(classes: readonly TerrainClass[]): Rgb[] {
  const colours: Rgb[] = [];
  for (let id = 0; id <= Math.max(...classes.map((terrain) => terrain.id)); id += 1) {
    colours.push(classes.find((terrain) => terrain.id === id)?.colour ?? [255, 0, 255]);
  }
  return colours;
}

/** Writes an indexed PNG, and returns its size in bytes. */
export async function writeIndexed(
  path: string,
  raster: ClassRaster,
  colours: readonly Rgb[],
): Promise<number> {
  const png = encodeIndexedPng(raster.width, raster.height, raster.cells, colours);
  await writeFile(path, png);
  return png.length;
}
