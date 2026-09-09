import type { PainterlyStyle, Palette, TerrainClass } from '@villages/world';

import { TILE } from './painterlyMessages';

/**
 * Reading the terrain back out of the tiles, which is the only copy of the master a browser has.
 *
 * The flat tiles are indexed PNGs of thirty-two colours we chose, carrying no colour profile, so a canvas
 * hands their bytes back unchanged and the colour is the class. See docs/adr/0022.
 *
 * This lives apart from the painter because two things now ask the same question: the paint, which wants
 * the terrain around a tile it is about to draw, and an area, which wants the terrain under every pixel it
 * encloses. One definition of what a colour means, or the census and the picture could disagree about the
 * same ground.
 *
 * Module state is per realm, so a worker and the page each keep their own cache. That is what is wanted:
 * a decoded tile cannot be shared across a worker boundary without copying it.
 */

/** What `npm run world:paint` leaves for the browser: the palette, the colours, and the styles. */
export interface PaintFile {
  palette: Palette;
  colours: Record<string, string>;
  styles: Record<string, PainterlyStyle>;
}

/** The palette in the form a decoder wants: colour to class, and the shape of the master behind it. */
export interface TerrainPalette {
  /** Packed 0xRRGGBB of the colour a class is drawn in, to the class id. Grows as colours are met. */
  byColour: Map<number, number>;
  nearest: readonly { red: number; green: number; blue: number; id: number }[];
  masterWidth: number;
  masterHeight: number;
  classes: readonly TerrainClass[];
  /** The colour each class is drawn in, by name, so that a legend shows the ground it means. */
  colours: Record<string, string>;
}

let file: Promise<PaintFile> | null = null;

/** The one fetch of `/world/paint.json`, kept, because everything here needs it and it never changes. */
export function paintFile(): Promise<PaintFile> {
  file ??= (async () => {
    const response = await fetch('/world/paint.json');
    if (!response.ok) {
      throw new Error(`no /world/paint.json (${response.status}); run npm run world:paint --prefix frontend`);
    }
    return (await response.json()) as PaintFile;
  })();
  return file;
}

export function terrainOf(paint: PaintFile): TerrainPalette {
  const byColour = new Map<number, number>();
  const nearest: { red: number; green: number; blue: number; id: number }[] = [];
  for (const terrain of paint.palette.classes) {
    const hex = paint.colours[terrain.name];
    if (hex === undefined) {
      continue;
    }
    const packed = Number.parseInt(hex.slice(1), 16);
    byColour.set(packed, terrain.id);
    nearest.push({
      red: (packed >> 16) & 0xff,
      green: (packed >> 8) & 0xff,
      blue: packed & 0xff,
      id: terrain.id,
    });
  }

  return {
    byColour,
    nearest,
    masterWidth: paint.palette.master.width,
    masterHeight: paint.palette.master.height,
    classes: paint.palette.classes,
    colours: paint.colours,
  };
}

let terrain: Promise<TerrainPalette> | null = null;

/** The palette, ready to decode with. Asked for by whoever needs it first and kept for the rest. */
export function terrainPalette(): Promise<TerrainPalette> {
  terrain ??= paintFile().then(terrainOf);
  return terrain;
}

/** Decoded flat tiles, as classes. A tile and its neighbours are wanted again the moment the map moves. */
const decoded = new Map<string, Uint8Array | null>();
const DECODED_CAP = 400;

let guessedColours = 0;

/**
 * One tile of terrain, as class ids. A tile that is not there comes back as `null`.
 *
 * The class ids are on disk already, as the PNG's palette indices, but a canvas decodes through the
 * palette and hands back colour, so the colour is mapped home again. A colour that is not one of ours
 * takes the nearest class and says so once.
 */
export async function classesOfTile(
  tiles: string,
  zoom: number,
  x: number,
  y: number,
  palette: TerrainPalette,
): Promise<Uint8Array | null> {
  const across = 2 ** zoom;
  if (y < 0 || y >= across) {
    return null;
  }
  const wrapped = ((x % across) + across) % across;
  const key = `${tiles}/${zoom}/${wrapped}/${y}`;
  const held = decoded.get(key);
  if (held !== undefined) {
    return held;
  }

  let classes: Uint8Array | null = null;
  try {
    const response = await fetch(`${tiles}/tiles/${zoom}/${wrapped}/${y}.png`);
    if (response.ok) {
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = new OffscreenCanvas(TILE, TILE);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context === null) {
        throw new Error('no 2d context to read a tile with');
      }
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const { data } = context.getImageData(0, 0, TILE, TILE);

      classes = new Uint8Array(TILE * TILE);
      for (let index = 0; index < classes.length; index += 1) {
        const packed = (data[index * 4]! << 16) | (data[index * 4 + 1]! << 8) | data[index * 4 + 2]!;
        const known = palette.byColour.get(packed);
        if (known !== undefined) {
          classes[index] = known;
          continue;
        }
        let best = 0;
        let closest = Infinity;
        for (const candidate of palette.nearest) {
          const dr = ((packed >> 16) & 0xff) - candidate.red;
          const dg = ((packed >> 8) & 0xff) - candidate.green;
          const db = (packed & 0xff) - candidate.blue;
          const distance = dr * dr + dg * dg + db * db;
          if (distance < closest) {
            closest = distance;
            best = candidate.id;
          }
        }
        palette.byColour.set(packed, best);
        classes[index] = best;
        guessedColours += 1;
        if (guessedColours === 1) {
          console.warn('a tile colour was not one of ours, so the class was guessed');
        }
      }
    }
  } catch {
    classes = null;
  }

  if (decoded.size >= DECODED_CAP) {
    const oldest = decoded.keys().next();
    if (oldest.done !== true) {
      decoded.delete(oldest.value);
    }
  }
  decoded.set(key, classes);
  return classes;
}
