import { classesOfTile, terrainPalette } from '../geometry/terrainClasses';
import { FLAT_MAX_ZOOM } from '../geometry/world';

import type { FlowFiles } from './flowFiles';
import { textureOf } from './program';
import { SIDE, maskOf } from './waterMask';
import type { WaterKinds } from './waterMask';

/**
 * The water's mask tiles, one a flat tile in view, each with its rivers' flow beside it.
 *
 * A mask is worked out from the flat tile and its eight neighbours by `waterMask.ts`, a few distance transforms
 * and a handful of milliseconds, so they are worked out one at a time between frames. While a tile's own is on
 * its way, it borrows the part of an ancestor's that covers it. Textures are uploaded a few a frame, so a jump to
 * a new place does not hitch, and the tiles least lately drawn are forgotten beyond what is kept.
 */

/** Mask tiles kept as textures, a quarter of a megabyte each. */
const REMEMBER = 120;
/** At most this many textures uploaded in one frame. */
const UPLOADS_PER_FRAME = 4;
/** How many zooms up a tile may borrow an ancestor's mask while its own is on its way. */
const BORROW = 4;

interface MaskTile {
  /** Null while it is being worked out, or once it is known to hold no water. */
  texture: WebGLTexture | null;
  /** A mask worked out and waiting to be uploaded in the next frame. */
  pending: Uint8Array | null;
  state: 'loading' | 'ready' | 'dry';
  used: number;
  /** Which way its rivers run, from `npm run world:flow`, once it has arrived; null for a tile with none. */
  flow: WebGLTexture | null;
  flowPending: Uint8Array | null;
  /** How far down the river each pixel is, which the river ripples are laid along. */
  along: WebGLTexture | null;
  alongPending: Uint8Array | null;
}

/** What a tile in view is drawn with. */
export interface Drawable {
  mask: WebGLTexture;
  /** How many zooms up its mask was borrowed from: nought for its own. */
  up: number;
  /** Its rivers' flow and how far down them, or null: a borrowed mask has no flow that lines up with it. */
  flow: WebGLTexture | null;
  along: WebGLTexture | null;
}

export interface MaskTiles {
  /** Whether it knows yet which terrain classes are water. */
  ready(): boolean;
  /** A new frame: what was not asked for in this one is the first to be forgotten. */
  begin(): void;
  /** The tile at a zoom, asked for if it is new, or null while there is nothing of it to draw. */
  drawable(gl: WebGL2RenderingContext, z: number, x: number, y: number): Drawable | null;
  /** Forgets the tiles least lately drawn, beyond what is kept. */
  forget(gl: WebGL2RenderingContext): void;
  dispose(gl: WebGL2RenderingContext | null): void;
}

export function createMaskTiles(worldRoot: string, flow: FlowFiles, repaint: () => void): MaskTiles {
  const tiles = new Map<string, MaskTile>();
  let kinds: WaterKinds | null = null;
  let frame = 0;
  let uploads = 0;

  void terrainPalette().then((palette) => {
    const ids = (names: readonly string[]) =>
      new Set(palette.classes.filter((one) => names.includes(one.name)).map((one) => one.id));
    kinds = {
      deep: ids(['ocean']),
      shallow: ids(['shallow-sea', 'lake', 'river']),
      lake: ids(['lake']),
      river: ids(['river']),
    };
    repaint();
  });

  const flowOf = async (z: number, x: number, y: number, tile: MaskTile) => {
    if (z !== FLAT_MAX_ZOOM || !(await flow.tiles).has(`${x}/${y}`)) {
      return;
    }
    const [pixels, along] = await Promise.all([flow.pixels(x, y), flow.pixels(x, y, '-along')]);
    tile.flowPending = pixels;
    tile.alongPending = along;
    repaint();
  };

  const jobs: (() => void)[] = [];
  let pumping = false;
  const pump = () => {
    jobs.shift()?.();
    if (jobs.length > 0) {
      setTimeout(pump, 0);
    } else {
      pumping = false;
    }
  };
  const later = (job: () => void) => {
    jobs.push(job);
    if (!pumping) {
      pumping = true;
      setTimeout(pump, 0);
    }
  };

  const read = (key: string, z: number, x: number, y: number): MaskTile => {
    const tile: MaskTile = {
      texture: null,
      pending: null,
      state: 'loading',
      used: frame,
      flow: null,
      flowPending: null,
      along: null,
      alongPending: null,
    };
    tiles.set(key, tile);
    void flowOf(z, x, y, tile);
    void terrainPalette().then(async (palette) => {
      const around = await Promise.all(
        [-1, 0, 1].flatMap((dy) =>
          [-1, 0, 1].map((dx) => classesOfTile(worldRoot, z, x + dx, y + dy, palette)),
        ),
      );
      later(() => {
        if (tiles.get(key) !== tile) {
          return;
        }
        // Gone from the view while it waited: forgotten, to be asked for again if it comes back.
        if (tile.used < frame - 30) {
          tiles.delete(key);
          return;
        }
        const mask = kinds === null ? null : maskOf(around, 2 ** (FLAT_MAX_ZOOM - z), kinds);
        if (mask === null) {
          tile.state = 'dry';
          return;
        }
        tile.pending = mask;
        repaint();
      });
    });
    return tile;
  };

  /** Uploads whatever of a tile has arrived, as far as this frame allows. */
  const settle = (gl: WebGL2RenderingContext, tile: MaskTile) => {
    if (tile.pending !== null && uploads < UPLOADS_PER_FRAME) {
      tile.texture = textureOf(gl, tile.pending, SIDE);
      tile.pending = null;
      tile.state = 'ready';
      uploads += 1;
    }
    if (tile.flowPending !== null && uploads < UPLOADS_PER_FRAME) {
      tile.flow = textureOf(gl, tile.flowPending, SIDE);
      tile.flowPending = null;
      uploads += 1;
    }
    if (tile.alongPending !== null && uploads < UPLOADS_PER_FRAME) {
      tile.along = textureOf(gl, tile.alongPending, SIDE);
      tile.alongPending = null;
      uploads += 1;
    }
  };

  const drop = (gl: WebGL2RenderingContext | null, tile: MaskTile) => {
    for (const texture of [tile.texture, tile.flow, tile.along]) {
      if (texture !== null) {
        gl?.deleteTexture(texture);
      }
    }
  };

  return {
    ready: () => kinds !== null,

    begin() {
      frame += 1;
      uploads = 0;
    },

    drawable(gl, z, x, y) {
      const key = `${z}/${x}/${y}`;
      const tile = tiles.get(key) ?? read(key, z, x, y);
      tile.used = frame;
      settle(gl, tile);
      let source: MaskTile | undefined = tile;
      let up = 0;
      while (source !== undefined && source.state === 'loading' && up < BORROW && z - up > 0) {
        up += 1;
        source = tiles.get(`${z - up}/${x >> up}/${y >> up}`);
      }
      if (source === undefined || source.state !== 'ready' || source.texture === null) {
        return null;
      }
      source.used = frame;
      const own = up === 0;
      return { mask: source.texture, up, flow: own ? source.flow : null, along: own ? source.along : null };
    },

    forget(gl) {
      if (tiles.size <= REMEMBER) {
        return;
      }
      const oldest = [...tiles.entries()]
        .filter(([, tile]) => tile.used < frame && tile.state !== 'loading')
        .sort((a, b) => a[1].used - b[1].used);
      for (const [key, tile] of oldest.slice(0, tiles.size - REMEMBER)) {
        drop(gl, tile);
        tiles.delete(key);
      }
    },

    dispose(gl) {
      for (const tile of tiles.values()) {
        drop(gl, tile);
      }
      tiles.clear();
    },
  };
}
