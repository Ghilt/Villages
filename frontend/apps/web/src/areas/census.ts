import { diamondLattice, enclosedBy, frameOf, worldXOf, worldYOf } from '@villages/world';
import type { Fence } from '@villages/world';

import { FLAT_MAX_ZOOM, TILE } from '../map/painterlyMessages';
import { classesOfTile, terrainPalette } from '../map/terrainClasses';

/**
 * What terrain an area encloses, counted in the diamonds the ground is painted on.
 *
 * Each diamond is read at its middle out of the zoom 7 tiles, which is what the painter reads a diamond's
 * colour from once the map is in past zoom six and a half: the same middle, through the same arithmetic in
 * `lattice.ts`, floored to the same tile pixel as the painter's own sampler floors it. So what is counted is
 * what is painted. The master itself is twenty-four megabytes and is not served; at zoom 7 a tile pixel is
 * one world unit, and world space is already Mercator, so nothing here has to be projected. See
 * docs/adr/0032 and 0066.
 *
 * The terrain arrives through `classesOfTile`, the same reader the painter uses, so the census and the
 * picture cannot disagree about the same ground.
 */

/** Class ids to the diamonds of them, and what it cost to find out. */
export interface Census {
  /** Diamonds enclosed, by terrain class id. Ids, because the palette is runtime data. */
  byClass: ReadonlyMap<number, number>;
  diamonds: number;
  tiles: number;
  tookMs: number;
  /** Diamonds no tile could answer for, because the tile they fall in is not there. */
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
 * How many diamonds a fence may be built over.
 *
 * Set to bind at about the same size as `MOST_TILES`, so that a drag across a continent is refused while
 * it is being drawn rather than after its tiles have been counted: a round drag reaching four hundred tiles
 * is some five thousand diamonds across, and the box the drawing guards is about this many diamonds.
 */
export const MOST_DIAMONDS = 24 * 1024 * 1024;

/** How many tiles are asked for at once. The browser queues the rest anyway; this keeps it honest. */
const AT_ONCE = 12;

export async function censusOf(fence: Fence, tilesRoot: string): Promise<Census> {
  const started = performance.now();
  const palette = await terrainPalette();
  const enclosed = enclosedBy(fence);
  const frame = frameOf(diamondLattice(fence.grid));

  // How much world one tile pixel covers at the zoom the tiles were cut to: one, for a master 32768 across.
  // Written out rather than assumed, so that a master of another size still lands in the right pixel.
  const perPixel = fence.grid.width / (TILE * 2 ** FLAT_MAX_ZOOM);
  const tilesAcross = 2 ** FLAT_MAX_ZOOM;

  /**
   * Walks every enclosed diamond, handing over the tile pixel its middle falls in, or minus one when that
   * is on no tile. A fence never reaches off the world, so that is only ever a fence nothing drew.
   */
  const eachDiamond = (visit: (tile: number, pixel: number) => void): void => {
    for (const span of enclosed.spans) {
      const v = span.row + 0.5;
      for (let column = span.from; column <= span.to; column += 1) {
        const u = column + 0.5;
        const x = Math.floor(worldXOf(frame, u, v) / perPixel);
        const y = Math.floor(worldYOf(frame, u, v) / perPixel);
        const tileX = Math.floor(x / TILE);
        const tileY = Math.floor(y / TILE);
        if (tileX < 0 || tileY < 0 || tileX >= tilesAcross || tileY >= tilesAcross) {
          visit(-1, 0);
          continue;
        }
        visit(tileY * tilesAcross + tileX, (y - tileY * TILE) * TILE + (x - tileX * TILE));
      }
    }
  };

  // Which tiles, noted only when the walk crosses into another, which along a row is rare.
  const wanted = new Set<number>();
  let lastTile = -1;
  eachDiamond((tile) => {
    if (tile >= 0 && tile !== lastTile) {
      lastTile = tile;
      wanted.add(tile);
      if (wanted.size > MOST_TILES) {
        throw new Error(`that area covers more than the ${MOST_TILES} tiles a census reads`);
      }
    }
  });

  const held = new Map<number, Uint8Array | null>();
  const addresses = [...wanted];
  for (let at = 0; at < addresses.length; at += AT_ONCE) {
    await Promise.all(
      addresses.slice(at, at + AT_ONCE).map(async (tile) => {
        const tileX = tile % tilesAcross;
        const tileY = (tile - tileX) / tilesAcross;
        held.set(tile, await classesOfTile(tilesRoot, FLAT_MAX_ZOOM, tileX, tileY, palette));
      }),
    );
  }

  const counts = new Uint32Array(256);
  let diamonds = 0;
  let unknown = 0;
  let heldTile = -1;
  let classes: Uint8Array | null = null;
  eachDiamond((tile, pixel) => {
    if (tile !== heldTile) {
      heldTile = tile;
      classes = tile < 0 ? null : (held.get(tile) ?? null);
    }
    if (classes === null) {
      unknown += 1;
      return;
    }
    // A read past the end cannot happen, but the compiler checks every index, and nought is ocean: the
    // same thing the painter reads where a tile is missing.
    const id = classes[pixel] ?? 0;
    counts[id] = (counts[id] ?? 0) + 1;
    diamonds += 1;
  });

  const byClass = new Map<number, number>();
  for (let id = 0; id < counts.length; id += 1) {
    const count = counts[id] ?? 0;
    if (count > 0) {
      byClass.set(id, count);
    }
  }

  return {
    byClass,
    diamonds,
    tiles: wanted.size,
    tookMs: Math.round(performance.now() - started),
    unknown,
  };
}
