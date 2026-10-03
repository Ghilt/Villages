import type { FlowFiles } from './flowFiles';
import { begin, smoothstep, textureOf } from './program';
import type { DrawStart, Program } from './program';
import { SIDE } from './waterMask';

/**
 * WIP SPIKE: the Flow renderer, which the water layer draws in place of the water: every river in view coloured
 * by which way it runs, from the flow tiles alone. Its tiles are kept apart from the water's, because it needs
 * no mask and reaches further out.
 */

/**
 * It draws from this zoom in, over at most so many of the flow tiles, which are all zoom 7; an arrow's cell is
 * about so many pixels across.
 */
const FROM_ZOOM = 6;
const MOST_TILES = 400;
const CELL_PIXELS = 26;
/** At most this many tiles uploaded in one frame. */
const UPLOADS_PER_FRAME = 4;

/** The tiles of one zoom that the view covers, from its four corners. */
export interface TileRange {
  across: number;
  fromX: number;
  toX: number;
  fromY: number;
  toY: number;
}

interface ViewTile {
  texture: WebGLTexture | null;
  pending: Uint8Array | null;
  used: number;
}

export interface FlowView {
  /** Draws what of it is in the zoom 7 tiles in view, and says how many tiles that was. */
  draw(
    gl: WebGL2RenderingContext,
    program: Program,
    start: DrawStart,
    zoom: number,
    range: TileRange,
  ): number;
  dispose(gl: WebGL2RenderingContext | null): void;
}

export function createFlowView(flow: FlowFiles, repaint: () => void): FlowView {
  const tiles = new Map<string, ViewTile>();
  let frame = 0;

  const forget = (gl: WebGL2RenderingContext) => {
    if (tiles.size <= MOST_TILES) {
      return;
    }
    const oldest = [...tiles.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [key, tile] of oldest.slice(0, tiles.size - MOST_TILES)) {
      if (tile.used === frame) {
        break;
      }
      if (tile.texture !== null) {
        gl.deleteTexture(tile.texture);
      }
      tiles.delete(key);
    }
  };

  return {
    draw(gl, program, start, zoom, { across, fromX, toX, fromY, toY }) {
      frame += 1;
      const known = flow.known();
      if (known === null || zoom < FROM_ZOOM || (toX - fromX + 1) * (toY - fromY + 1) > MOST_TILES) {
        return 0;
      }
      const { where } = program;
      begin(gl, program, start);
      gl.uniform1i(where.uFlow!, 0);
      gl.uniform1f(where.uCell!, CELL_PIXELS / start.scale);
      gl.uniform1f(where.uMarch!, smoothstep(2.5, 4, start.scale));
      gl.uniform4f(where.uTexRect!, 0, 0, 1, 1);
      let uploads = 0;
      let drawn = 0;
      for (let y = fromY; y <= toY; y += 1) {
        for (let x = fromX; x <= toX; x += 1) {
          const key = `${x}/${y}`;
          if (!known.has(key)) {
            continue;
          }
          let tile = tiles.get(key);
          if (tile === undefined) {
            const fresh: ViewTile = { texture: null, pending: null, used: frame };
            tiles.set(key, fresh);
            void flow.pixels(x, y).then((pixels) => {
              fresh.pending = pixels;
              repaint();
            });
            tile = fresh;
          }
          tile.used = frame;
          if (tile.pending !== null && uploads < UPLOADS_PER_FRAME) {
            tile.texture = textureOf(gl, tile.pending, SIDE);
            tile.pending = null;
            uploads += 1;
          }
          if (tile.texture === null) {
            continue;
          }
          gl.bindTexture(gl.TEXTURE_2D, tile.texture);
          gl.uniform3f(where.uTile!, x / across, y / across, 1 / across);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          drawn += 1;
        }
      }
      gl.bindVertexArray(null);
      forget(gl);
      return drawn;
    },

    dispose(gl) {
      for (const tile of tiles.values()) {
        if (tile.texture !== null) {
          gl?.deleteTexture(tile.texture);
        }
      }
      tiles.clear();
    },
  };
}
