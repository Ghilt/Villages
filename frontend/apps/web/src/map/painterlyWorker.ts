import { paintPixel, preparePainterly } from '@villages/world';
import type { ClassSampler, Palette, PainterlyStyle, PreparedPainterly } from '@villages/world';

import { FLAT_MAX_ZOOM, TILE } from './painterlyMessages';
import type { PaintReply, PaintRequest } from './painterlyMessages';

/**
 * Painting one map tile, off the main thread.
 *
 * A painted pixel costs about forty noise evaluations, so a tile is tens of milliseconds of arithmetic.
 * On the main thread that is a stutter every time the map moves, however fast the arithmetic gets; in a
 * worker it is throughput, and several workers is more throughput. Nothing here touches the document.
 *
 * The terrain comes from the flat colour tiles that are already served: indexed PNGs of thirty-two
 * colours we chose, carrying no colour profile, so a canvas hands their bytes back unchanged and the
 * colour is the class. See docs/adr/0022.
 */

/** The neighbourhood is three tiles square, so the paint can look past the edge of what it draws. */
const SPAN = TILE * 3;

interface Ready {
  styles: Map<string, PreparedPainterly>;
  byColour: Map<number, number>;
  nearest: readonly { red: number; green: number; blue: number; id: number }[];
  masterWidth: number;
}

let ready: Promise<Ready> | null = null;
let guessedColours = 0;

async function load(): Promise<Ready> {
  const response = await fetch('/world/paint.json');
  if (!response.ok) {
    throw new Error(`no /world/paint.json (${response.status}); run npm run world:paint --prefix frontend`);
  }
  const paint = (await response.json()) as {
    palette: Palette;
    colours: Record<string, string>;
    styles: Record<string, PainterlyStyle>;
  };

  const styles = new Map<string, PreparedPainterly>();
  for (const [name, style] of Object.entries(paint.styles)) {
    styles.set(name, preparePainterly(style, paint.palette, paint.colours));
  }

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

  return { styles, byColour, nearest, masterWidth: paint.palette.master.width };
}

/** Decoded flat tiles, as classes. A tile and its neighbours are wanted again the moment the map moves. */
const decoded = new Map<string, Uint8Array | null>();
const DECODED_CAP = 400;

async function classesOf(zoom: number, x: number, y: number, at: Ready): Promise<Uint8Array | null> {
  const across = 2 ** zoom;
  if (y < 0 || y >= across) {
    return null;
  }
  const wrapped = ((x % across) + across) % across;
  const key = `${zoom}/${wrapped}/${y}`;
  const held = decoded.get(key);
  if (held !== undefined) {
    return held;
  }

  let classes: Uint8Array | null = null;
  try {
    const response = await fetch(`/world/tiles/${zoom}/${wrapped}/${y}.png`);
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
        const known = at.byColour.get(packed);
        if (known !== undefined) {
          classes[index] = known;
          continue;
        }
        let best = 0;
        let closest = Infinity;
        for (const candidate of at.nearest) {
          const dr = ((packed >> 16) & 0xff) - candidate.red;
          const dg = ((packed >> 8) & 0xff) - candidate.green;
          const db = (packed & 0xff) - candidate.blue;
          const distance = dr * dr + dg * dg + db * db;
          if (distance < closest) {
            closest = distance;
            best = candidate.id;
          }
        }
        at.byColour.set(packed, best);
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

/**
 * The terrain around one tile, as a single flat array of classes, three tiles square.
 *
 * Flat and indexed with arithmetic rather than a map of tiles keyed by name: a pixel takes nine samples
 * and a tile has sixty-five thousand pixels, so a string key here costs half a million allocations a
 * tile. Measured at half again the cost of the whole paint. A tile that is missing stays zero, which is
 * ocean.
 */
async function neighbourhood(
  sourceZoom: number,
  centreX: number,
  centreY: number,
  at: Ready,
): Promise<Uint8Array> {
  const field = new Uint8Array(SPAN * SPAN);
  await Promise.all(
    [-1, 0, 1].flatMap((dy) =>
      [-1, 0, 1].map(async (dx) => {
        const classes = await classesOf(sourceZoom, centreX + dx, centreY + dy, at);
        if (classes === null) {
          return;
        }
        const intoX = (dx + 1) * TILE;
        const intoY = (dy + 1) * TILE;
        for (let row = 0; row < TILE; row += 1) {
          field.set(classes.subarray(row * TILE, (row + 1) * TILE), (intoY + row) * SPAN + intoX);
        }
      }),
    ),
  );
  return field;
}

/**
 * One painted tile.
 *
 * `masterPerPixel` comes from the tile's own zoom, and it is the whole of what the view tells the paint:
 * the master is 32768 across and a tile is 256, so at zoom seven a tile pixel is a master pixel and every
 * zoom in halves it. That is what keeps a mark the size of a mark, and why this cannot be baked.
 */
function paintTile(
  style: PreparedPainterly,
  field: Uint8Array,
  sourceZoom: number,
  centreX: number,
  centreY: number,
  zoom: number,
  x: number,
  y: number,
  at: Ready,
): ImageData {
  const masterPerPixel = at.masterWidth / (TILE * 2 ** zoom);
  const sourcePerPixel = at.masterWidth / (TILE * 2 ** sourceZoom);
  const baseX = (centreX - 1) * TILE;
  const baseY = (centreY - 1) * TILE;

  const read: ClassSampler = (worldX, worldY) => {
    const column = Math.floor(worldX / sourcePerPixel) - baseX;
    const row = Math.floor(worldY / sourcePerPixel) - baseY;
    if (column < 0 || column >= SPAN || row < 0 || row >= SPAN) {
      return 0;
    }
    return field[row * SPAN + column]!;
  };

  const originX = x * TILE;
  const originY = y * TILE;
  const image = new ImageData(TILE, TILE);
  const pixels = image.data;
  let at4 = 0;

  for (let row = 0; row < TILE; row += 1) {
    const worldY = (originY + row + 0.5) * masterPerPixel;
    for (let column = 0; column < TILE; column += 1) {
      const colour = paintPixel(
        style,
        read,
        (originX + column + 0.5) * masterPerPixel,
        worldY,
        masterPerPixel,
      );
      pixels[at4] = colour[0];
      pixels[at4 + 1] = colour[1];
      pixels[at4 + 2] = colour[2];
      pixels[at4 + 3] = 255;
      at4 += 4;
    }
  }

  return image;
}

/**
 * The worker's own globals. Declared rather than pulled in from the webworker library, because this app
 * is compiled with the DOM library and the two disagree about half of what `self` is.
 */
const inside = self as unknown as {
  addEventListener(type: 'message', handler: (event: MessageEvent<PaintRequest>) => void): void;
  postMessage(message: PaintReply, transfer?: Transferable[]): void;
};

inside.addEventListener('message', async (event) => {
  const { id, style: styleName, zoom, x, y } = event.data;
  try {
    ready ??= load();
    const at = await ready;
    const style = at.styles.get(styleName);
    if (style === undefined) {
      throw new Error(`no painterly style called ${styleName}`);
    }

    const sourceZoom = Math.min(zoom, FLAT_MAX_ZOOM);
    const scale = 2 ** (zoom - sourceZoom);
    const centreX = Math.floor(x / scale);
    const centreY = Math.floor(y / scale);

    const field = await neighbourhood(sourceZoom, centreX, centreY, at);
    const image = paintTile(style, field, sourceZoom, centreX, centreY, zoom, x, y, at);
    const pixels = image.data.buffer;
    inside.postMessage({ id, pixels }, [pixels]);
  } catch (cause) {
    inside.postMessage({ id, error: (cause as Error).message });
  }
});
