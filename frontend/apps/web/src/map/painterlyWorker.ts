import { onLattice, paintPixel, preparePainterly } from '@villages/world';
import type { ClassSampler, Lattice, PreparedPainterly } from '@villages/world';

import { PAINTED_TILE, footprintOf } from './painterlyMessages';
import { TILE } from '../geometry/world';
import type { Footprint, PaintReply, PaintRequest } from './painterlyMessages';
import { classesOfTile, paintFile, terrainOf } from '../geometry/terrainClasses';
import type { TerrainPalette } from '../geometry/terrainClasses';

/**
 * Painting one map tile, off the main thread.
 *
 * A painted pixel costs about forty noise evaluations, so a tile is tens of milliseconds of arithmetic.
 * On the main thread that is a stutter every time the map moves, however fast the arithmetic gets; in a
 * worker it is throughput, and several workers is more throughput. Nothing here touches the document.
 *
 * The terrain comes from the flat colour tiles that are already served, read back through
 * `terrainClasses.ts`, which is the one place that knows a tile colour is a terrain class. An area asks
 * the same question of the same tiles, and the two must not answer it differently. See docs/adr/0022.
 */

interface Ready {
  styles: Map<string, PreparedPainterly>;
  terrain: TerrainPalette;
}

let ready: Promise<Ready> | null = null;

async function load(): Promise<Ready> {
  const paint = await paintFile();

  const styles = new Map<string, PreparedPainterly>();
  for (const [name, style] of Object.entries(paint.styles)) {
    styles.set(name, preparePainterly(style, paint.palette, paint.colours));
  }

  return { styles, terrain: terrainOf(paint) };
}

/**
 * The terrain around one tile, as a single flat array of classes, its footprint and a ring square.
 *
 * Flat and indexed with arithmetic rather than a map of tiles keyed by name: a pixel takes nine samples
 * and a tile has hundreds of thousands of pixels, so a string key here costs millions of allocations a
 * tile. Measured at half again the cost of the whole paint. A tile that is missing stays zero, which is
 * ocean.
 */
async function neighbourhood(tiles: string, around: Footprint, at: Ready): Promise<Uint8Array> {
  const { sourceZoom, firstX, firstY, cover, span } = around;
  const field = new Uint8Array(span * span);
  const steps = Array.from({ length: cover + 2 }, (_unused, index) => index - 1);
  await Promise.all(
    steps.flatMap((dy) =>
      steps.map(async (dx) => {
        const classes = await classesOfTile(tiles, sourceZoom, firstX + dx, firstY + dy, at.terrain);
        if (classes === null) {
          return;
        }
        const intoX = (dx + 1) * TILE;
        const intoY = (dy + 1) * TILE;
        for (let row = 0; row < TILE; row += 1) {
          field.set(classes.subarray(row * TILE, (row + 1) * TILE), (intoY + row) * span + intoX);
        }
      }),
    ),
  );
  return field;
}

/**
 * One painted tile.
 *
 * `masterPerPixel` comes from the tile's own zoom and its own width, and it is the whole of what the view
 * tells the paint: the master is 32768 across and a painted tile is 512, so at zoom six a painted pixel is
 * a master pixel and every zoom in halves it. That is what keeps a mark the size of a mark, and why this
 * cannot be baked.
 */
function paintTile(
  style: PreparedPainterly,
  field: Uint8Array,
  around: Footprint,
  zoom: number,
  x: number,
  y: number,
  at: Ready,
  lattice: Lattice,
): ImageData {
  const { sourceZoom, firstX, firstY, span } = around;
  const masterPerPixel = at.terrain.masterWidth / (PAINTED_TILE * 2 ** zoom);
  const sourcePerPixel = at.terrain.masterWidth / (TILE * 2 ** sourceZoom);
  const baseX = (firstX - 1) * TILE;
  const baseY = (firstY - 1) * TILE;

  const straight: ClassSampler = (worldX, worldY) => {
    const column = Math.floor(worldX / sourcePerPixel) - baseX;
    const row = Math.floor(worldY / sourcePerPixel) - baseY;
    if (column < 0 || column >= span || row < 0 || row >= span) {
      return 0;
    }
    return field[row * span + column]!;
  };

  // Every read the paint does goes through this, the wander and the nine neighbours alike, so the cells
  // it draws are the lattice's cells and their edges and their shores come out of the same arithmetic.
  const read = onLattice(straight, lattice);

  const originX = x * PAINTED_TILE;
  const originY = y * PAINTED_TILE;
  const image = new ImageData(PAINTED_TILE, PAINTED_TILE);
  const pixels = image.data;
  let at4 = 0;

  for (let row = 0; row < PAINTED_TILE; row += 1) {
    const worldY = (originY + row + 0.5) * masterPerPixel;
    for (let column = 0; column < PAINTED_TILE; column += 1) {
      const colour = paintPixel(
        style,
        read,
        (originX + column + 0.5) * masterPerPixel,
        worldY,
        masterPerPixel,
        lattice,
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
  const { id, style: styleName, tiles, zoom, x, y, latticeTurn, latticeSize } = event.data;
  try {
    ready ??= load();
    const at = await ready;
    const style = at.styles.get(styleName);
    if (style === undefined) {
      throw new Error(`no painterly style called ${styleName}`);
    }

    const started = performance.now();
    const around = footprintOf(zoom, x, y);
    const field = await neighbourhood(tiles, around, at);
    const assembled = performance.now();
    const image = paintTile(style, field, around, zoom, x, y, at, {
      turn: latticeTurn,
      size: latticeSize,
    });
    const pixels = image.data.buffer;
    const terrainMs = assembled - started;
    const paintMs = performance.now() - assembled;
    inside.postMessage({ id, pixels, terrainMs, paintMs }, [pixels]);
  } catch (cause) {
    inside.postMessage({ id, error: (cause as Error).message });
  }
});
