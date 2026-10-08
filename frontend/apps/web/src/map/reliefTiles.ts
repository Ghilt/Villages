import { HEIGHT_BOUNDS, HEIGHT_FORMAT } from '@villages/world';

import { note } from '../log/log';

import { widen } from './reliefMargin';
import { createDownloadQueue } from './reliefQueue';
import { MARGIN } from './reliefShader';

/**
 * The relief's heights, a texture a tile: the tile's own 256 by 256 heights in whole metres with a margin of
 * `MARGIN` texels from each of its eight neighbours, so its slope at the edge reads both sides of it, read from
 * the Terrarium tiles `world:height` cuts (decision record 0090).
 *
 * Asked for a view at a time, its middle first, a few at once (`reliefQueue.ts`), and drawn as soon as the tile
 * itself is here: a neighbour still on its way is stood in for by the tile's own ground carried on past the edge
 * (`reliefMargin.ts`), and its texture is made again when the neighbour lands. A frame makes only so many
 * textures, so a screenful arriving at once is spread over a few frames rather than stalling one; the rest are
 * stood in for by a coarser tile meanwhile, which `reliefLayer.ts` draws. Textures and heights are let go of the
 * least lately used first, never one drawn in the frame that lets them go.
 */

const SIDE = 256;
const WIDE = SIDE + 2 * MARGIN;
const FLAT = new Int16Array(SIDE * SIDE);
/** Downloads at once: a page gets six from a server at a time, and the map's own tiles need the rest. */
const AT_ONCE = 4;
/** Height tiles held, about 48 MB: three or four screens' worth, and their neighbours. */
const HELD = 384;
/** Textures kept beyond those drawn in the frame, for a view that comes straight back. */
const SPARE = 64;
/** Textures made or made again a frame. */
const MADE_A_FRAME = 10;

const [WEST, SOUTH, EAST, NORTH] = HEIGHT_BOUNDS;

/** The tiles a view covers at one zoom of the height tiles, inclusive, from its west and north. */
export interface TileRange {
  z: number;
  fromX: number;
  toX: number;
  fromY: number;
  toY: number;
}

/** A tile's west, north, east and south edges in degrees. */
function edgesOf(z: number, x: number, y: number): [number, number, number, number] {
  const across = 2 ** z;
  const lat = (row: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / across))) * 180) / Math.PI;
  return [(x / across) * 360 - 180, lat(y), ((x + 1) / across) * 360 - 180, lat(y + 1)];
}

/** The tile's key, round the antimeridian, or null where there is no tile or no height. */
function keyOf(z: number, x: number, y: number): string | null {
  const across = 2 ** z;
  if (y < 0 || y >= across) {
    return null;
  }
  const wrapped = ((x % across) + across) % across;
  const [west, north, east, south] = edgesOf(z, wrapped, y);
  return east > WEST && west < EAST && north > SOUTH && south < NORTH ? `${z}/${wrapped}/${y}` : null;
}

async function decode(url: string, signal: AbortSignal): Promise<Int16Array> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  const bitmap = await createImageBitmap(await response.blob(), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });
  const canvas = new OffscreenCanvas(SIDE, SIDE);
  const drawing = canvas.getContext('2d', { willReadFrequently: true })!;
  drawing.drawImage(bitmap, 0, 0);
  bitmap.close();
  const bytes = drawing.getImageData(0, 0, SIDE, SIDE).data;
  // Terrarium in whole metres, as world:height rounds them, which is half the memory of a float.
  const heights = new Int16Array(SIDE * SIDE);
  for (let i = 0; i < heights.length; i += 1) {
    heights[i] = Math.round(bytes[i * 4]! * 256 + bytes[i * 4 + 1]! + bytes[i * 4 + 2]! / 256 - 32768);
  }
  return heights;
}

export interface ReliefTiles {
  /**
   * Asks for what a view needs, a coarse cover of it first, then its tiles from the middle out, then the ring
   * around it; anything else on its way is cancelled. Null asks for nothing.
   */
  want(view: TileRange | null): void;
  /** The tile's texture, made now if its heights are here and the frame can afford it, or null. */
  drawable(gl: WebGL2RenderingContext, z: number, x: number, y: number): WebGLTexture | null;
  /** Once a frame, after drawing: lets go of what was not drawn lately. True when something waits to be made. */
  forget(gl: WebGL2RenderingContext): boolean;
  dispose(gl: WebGL2RenderingContext): void;
}

interface Made {
  texture: WebGLTexture;
  used: number;
  /** Made with a neighbour stood in for, so made again when the neighbour lands. */
  guessed: boolean;
  stale: boolean;
}

export function createReliefTiles(worldRoot: string, arrived: () => void): ReliefTiles {
  /** Insertion order is how lately each was wanted, the least lately first. */
  const heights = new Map<string, Int16Array>();
  const textures = new Map<string, Made>();
  let frame = 0;
  let budget = MADE_A_FRAME;
  let waited = false;
  let said = false;

  const hold = (key: string, tile: Int16Array) => {
    heights.delete(key);
    heights.set(key, tile);
    for (const old of heights.keys()) {
      if (heights.size <= HELD) {
        break;
      }
      heights.delete(old);
    }
  };

  const land = (key: string, tile: Int16Array) => {
    hold(key, tile);
    // The neighbours made without this one are made again with it.
    const [z, x, y] = key.split('/').map(Number) as [number, number, number];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const next = keyOf(z, x + dx, y + dy);
        const made = next === null ? undefined : textures.get(next);
        if (made?.guessed) {
          made.stale = true;
        }
      }
    }
    arrived();
  };

  const queue = createDownloadQueue<Int16Array>({
    most: AT_ONCE,
    load: (key, signal) => decode(`${worldRoot}/height/${key}.${HEIGHT_FORMAT}`, signal),
    landed: land,
    failed: (key, error) => {
      if (!said) {
        said = true;
        note('relief', `a height tile would not load, so it is drawn flat: ${String(error)}`);
      }
      land(key, FLAT);
    },
  });

  /** The tile and its eight neighbours from the north-west, null for each not here. */
  const nineOf = (z: number, x: number, y: number) => {
    const nine: (Int16Array | null)[] = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const key = keyOf(z, x + dx, y + dy);
        nine.push((key === null ? undefined : heights.get(key)) ?? null);
      }
    }
    return nine;
  };

  const upload = (gl: WebGL2RenderingContext, made: Made | null, z: number, x: number, y: number): Made => {
    const nine = nineOf(z, x, y);
    const wide = widen(nine, SIDE, MARGIN);
    const texture = made?.texture ?? gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (made === null) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16I, WIDE, WIDE, 0, gl.RED_INTEGER, gl.SHORT, wide);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, WIDE, WIDE, gl.RED_INTEGER, gl.SHORT, wide);
    }
    return { texture, used: frame, guessed: nine.includes(null), stale: false };
  };

  return {
    want(view) {
      if (view === null) {
        queue.want([]);
        return;
      }
      const { z, fromX, toX, fromY, toY } = view;
      const keys: string[] = [];
      const ask = (az: number, x: number, y: number) => {
        const key = keyOf(az, x, y);
        if (key === null) {
          return;
        }
        const here = heights.get(key);
        if (here === undefined) {
          keys.push(key);
        } else {
          hold(key, here);
        }
      };
      // A coarse cover first, a sixteenth as many tiles, so somewhere new is shaded after one round trip.
      const coarse = Math.max(0, z - 2);
      if (coarse < z) {
        const shift = z - coarse;
        for (let y = fromY >> shift; y <= toY >> shift; y += 1) {
          for (let x = fromX >> shift; x <= toX >> shift; x += 1) {
            ask(coarse, x, y);
          }
        }
      }
      const middleX = (fromX + toX) / 2;
      const middleY = (fromY + toY) / 2;
      const tiles: [number, number][] = [];
      for (let y = fromY; y <= toY; y += 1) {
        for (let x = fromX; x <= toX; x += 1) {
          tiles.push([x, y]);
        }
      }
      tiles.sort(
        ([ax, ay], [bx, by]) =>
          Math.hypot(ax - middleX, ay - middleY) - Math.hypot(bx - middleX, by - middleY),
      );
      for (const [x, y] of tiles) {
        ask(z, x, y);
      }
      // Then the ring around it, which only sharpens the edges of the view and readies a short move.
      for (let y = fromY - 1; y <= toY + 1; y += 1) {
        for (let x = fromX - 1; x <= toX + 1; x += 1) {
          if (y < fromY || y > toY || x < fromX || x > toX) {
            ask(z, x, y);
          }
        }
      }
      queue.want(keys);
    },

    drawable(gl, z, x, y) {
      const key = keyOf(z, x, y);
      if (key === null) {
        return null;
      }
      const made = textures.get(key);
      if (made !== undefined) {
        made.used = frame;
        if (made.stale) {
          if (budget > 0) {
            budget -= 1;
            textures.set(key, upload(gl, made, z, x, y));
          } else {
            waited = true;
          }
        }
        return made.texture;
      }
      if (!heights.has(key)) {
        return null;
      }
      if (budget <= 0) {
        waited = true;
        return null;
      }
      budget -= 1;
      const fresh = upload(gl, null, z, x, y);
      textures.set(key, fresh);
      return fresh.texture;
    },

    forget(gl) {
      const drawn = [...textures.values()].filter((made) => made.used === frame).length;
      if (textures.size > drawn + SPARE) {
        const oldest = [...textures.entries()]
          .filter(([, made]) => made.used !== frame)
          .sort((a, b) => a[1].used - b[1].used);
        for (const [key, { texture }] of oldest.slice(0, textures.size - drawn - SPARE)) {
          gl.deleteTexture(texture);
          textures.delete(key);
        }
      }
      frame += 1;
      budget = MADE_A_FRAME;
      const more = waited;
      waited = false;
      return more;
    },

    dispose(gl) {
      queue.want([]);
      for (const { texture } of textures.values()) {
        gl.deleteTexture(texture);
      }
      textures.clear();
      heights.clear();
    },
  };
}
