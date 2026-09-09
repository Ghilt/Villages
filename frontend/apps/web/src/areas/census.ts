import { enclosedBy, mercatorRowOf } from '@villages/world';
import type { Fence } from '@villages/world';

import { FLAT_MAX_ZOOM, TILE } from '../map/painterlyMessages';
import { classesOfTile, terrainPalette } from '../map/terrainClasses';

/**
 * What terrain an area encloses, counted in the pixels the world is painted in.
 *
 * The master itself is twenty-four megabytes and is not served, so the count is read out of the zoom 7
 * tiles, which carry every master pixel exactly: the master is 32768 across and a tile is 256, so a tile
 * pixel is a master pixel there. `mercatorRowOf` finds which tile row holds a master row, which is the
 * only part of the arithmetic that is not a straight scaling, because the master runs linearly in
 * latitude and the tiles run linearly in Mercator. See docs/adr/0032.
 *
 * The terrain arrives through `classesOfTile`, the same reader the painter uses, so the census and the
 * picture cannot disagree about the same ground.
 */

/** Class ids to the pixels of them, and what it cost to find out. */
export interface Census {
  /** Master pixels enclosed, by terrain class id. Ids, because the palette is runtime data. */
  byClass: ReadonlyMap<number, number>;
  pixels: number;
  tiles: number;
  tookMs: number;
  /** Pixels no tile could answer for: past the edge Mercator draws, or a tile that is not there. */
  unknown: number;
}

/**
 * How many tiles one census may read.
 *
 * Four hundred is about three thousand kilometres across at our latitudes, which is more than anything a
 * fence is for, and it is where a census stops being a moment and starts being a download. An area past
 * it is refused with its size rather than fetched for a minute.
 */
export const MOST_TILES = 400;

/**
 * How many master pixels a fence may be built over.
 *
 * Set to bind at about the same size as `MOST_TILES`, so that a drag across a continent is refused while
 * it is being drawn rather than after its tiles have been counted: four hundred tiles is a Mercator box
 * of roughly five thousand pixels square, which at our latitudes is about this many of the master.
 */
export const MOST_PIXELS = 16 * 1024 * 1024;

/** How many tiles are asked for at once. The browser queues the rest anyway; this keeps it honest. */
const AT_ONCE = 12;

export async function censusOf(fence: Fence, tilesRoot: string): Promise<Census> {
  const started = performance.now();
  const palette = await terrainPalette();
  const enclosed = enclosedBy(fence);

  const across = TILE * 2 ** FLAT_MAX_ZOOM;
  // One at the zoom the tiles were cut to, where a tile pixel is a master pixel. Written out rather than
  // assumed, so that a master of another size still lands in the right column.
  const columnScale = across / palette.masterWidth;

  /** Which tile row holds each master row, worked out once a row rather than once a pixel. */
  const rowOf = new Map<number, number | null>();
  const wanted = new Set<string>();
  for (const span of enclosed.spans) {
    let row = rowOf.get(span.row);
    if (row === undefined) {
      row = mercatorRowOf(span.row, palette.masterHeight, FLAT_MAX_ZOOM);
      rowOf.set(span.row, row);
    }
    if (row === null) {
      continue;
    }
    const tileY = Math.floor(row / TILE);
    const first = Math.floor(Math.floor((span.from + 0.5) * columnScale) / TILE);
    const last = Math.floor(Math.floor((span.to + 0.5) * columnScale) / TILE);
    for (let tileX = first; tileX <= last; tileX += 1) {
      wanted.add(`${tileX}/${tileY}`);
    }
  }

  if (wanted.size > MOST_TILES) {
    throw new Error(`that area covers ${wanted.size} tiles, past the ${MOST_TILES} a census reads`);
  }

  const held = new Map<string, Uint8Array | null>();
  const addresses = [...wanted];
  for (let at = 0; at < addresses.length; at += AT_ONCE) {
    await Promise.all(
      addresses.slice(at, at + AT_ONCE).map(async (address) => {
        const [tileX, tileY] = address.split('/').map(Number) as [number, number];
        held.set(address, await classesOfTile(tilesRoot, FLAT_MAX_ZOOM, tileX, tileY, palette));
      }),
    );
  }

  const counts = new Uint32Array(256);
  let pixels = 0;
  let unknown = 0;

  for (const span of enclosed.spans) {
    const row = rowOf.get(span.row) ?? null;
    if (row === null) {
      unknown += span.to - span.from + 1;
      continue;
    }
    const tileY = Math.floor(row / TILE);
    const intoRow = (row - tileY * TILE) * TILE;

    // The tile is looked up only when a span crosses into the next one, which for a fence is rare.
    let heldX = -1;
    let classes: Uint8Array | null = null;

    for (let column = span.from; column <= span.to; column += 1) {
      const mercatorColumn = columnScale === 1 ? column : Math.floor((column + 0.5) * columnScale);
      const tileX = Math.floor(mercatorColumn / TILE);
      if (tileX !== heldX) {
        heldX = tileX;
        classes = held.get(`${tileX}/${tileY}`) ?? null;
      }
      if (classes === null) {
        unknown += 1;
        continue;
      }
      // A read past the end cannot happen, but the compiler checks every index, and nought is ocean:
      // the same thing the painter reads where a tile is missing.
      const id = classes[intoRow + (mercatorColumn - tileX * TILE)] ?? 0;
      counts[id] = (counts[id] ?? 0) + 1;
      pixels += 1;
    }
  }

  const byClass = new Map<number, number>();
  for (let id = 0; id < counts.length; id += 1) {
    const count = counts[id] ?? 0;
    if (count > 0) {
      byClass.set(id, count);
    }
  }

  return {
    byClass,
    pixels,
    tiles: wanted.size,
    tookMs: Math.round(performance.now() - started),
    unknown,
  };
}
