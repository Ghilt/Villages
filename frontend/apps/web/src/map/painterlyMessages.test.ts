import { describe, expect, it } from 'vitest';

import {
  FLAT_MAX_ZOOM,
  PAINTED_MAX_ZOOM,
  PAINTED_STEP,
  PAINTED_TILE,
  TILE,
  footprintOf,
} from './painterlyMessages';
import { WORLD_MAX_ZOOM } from './worldStyle';

/** MapLibre's own rule for which tile zoom a raster source is asked for, from its covering-tiles code. */
const askedFor = (mapZoom: number, tileSize: number, maxZoom: number) =>
  Math.min(Math.round(mapZoom + Math.log2(512 / tileSize)), maxZoom);

/** How many painted pixels span the whole world, at a map zoom, for a source of this shape. */
const paintedAcross = (mapZoom: number, tileSize: number, maxZoom: number) =>
  tileSize * 2 ** askedFor(mapZoom, tileSize, maxZoom);

/**
 * The painted tile is one number, and experiment 0008 tried both of its values. Both geometries are
 * checked here whichever is live, so that the other stays one character away rather than one bug away.
 */
const SIZES = [
  { tile: 256, step: 0 },
  { tile: 512, step: 1 },
] as const;

describe('the painted tile', () => {
  it('is as many zooms ahead of a flat one as it is times wider', () => {
    expect(PAINTED_TILE / TILE).toBe(2 ** PAINTED_STEP);
  });

  it('stops as far short of the world as it is ahead, which the constant cannot import and so is told', () => {
    expect(PAINTED_MAX_ZOOM).toBe(WORLD_MAX_ZOOM - PAINTED_STEP);
  });

  it('is drawn at exactly the resolution a 256 tile is, at every zoom the map can reach, at either size', () => {
    // The claim that makes the size a free choice: the same pixels everywhere. Left at the world's ten, a
    // 512 tile would paint four times what a 256 one does at the closest half-zoom.
    for (const { tile, step } of SIZES) {
      for (let mapZoom = 0; mapZoom <= WORLD_MAX_ZOOM; mapZoom += 0.25) {
        expect(paintedAcross(mapZoom, tile, WORLD_MAX_ZOOM - step)).toBe(
          paintedAcross(mapZoom, 256, WORLD_MAX_ZOOM),
        );
      }
    }
  });

  it('is, live, one of the sizes those checks cover', () => {
    expect(SIZES.some(({ tile }) => tile === PAINTED_TILE)).toBe(true);
  });
});

describe('the flat tiles a painted tile is painted from', () => {
  it('are the one it sits inside, once the painted tile is deeper than the flat ones', () => {
    for (const { step } of SIZES) {
      expect(footprintOf(9, 100, 37, step)).toEqual({
        sourceZoom: FLAT_MAX_ZOOM,
        firstX: 25,
        firstY: 9,
        cover: 1,
        span: 3 * TILE,
      });
    }
  });

  it('are the tile itself at 256 and the two by two it covers at 512, read a zoom finer so a pixel is a pixel', () => {
    expect(footprintOf(5, 10, 3, 0)).toEqual({
      sourceZoom: 5,
      firstX: 10,
      firstY: 3,
      cover: 1,
      span: 3 * TILE,
    });
    expect(footprintOf(5, 10, 3, 1)).toEqual({
      sourceZoom: 6,
      firstX: 20,
      firstY: 6,
      cover: 2,
      span: 4 * TILE,
    });
  });

  it('always cover the ground the painted tile covers, at every zoom, wherever it is, at either size', () => {
    for (const { step } of SIZES) {
      for (let zoom = 0; zoom <= WORLD_MAX_ZOOM - step; zoom += 1) {
        const across = 2 ** zoom;
        for (const x of [0, 1, Math.floor(across / 3), across - 1]) {
          const { sourceZoom, firstX, cover } = footprintOf(zoom, x, 0, step);
          // The block of flat tiles, as a fraction of the world, has to contain the painted tile's span.
          expect(firstX / 2 ** sourceZoom).toBeLessThanOrEqual(x / across);
          expect((firstX + cover) / 2 ** sourceZoom).toBeGreaterThanOrEqual((x + 1) / across);
        }
      }
    }
  });

  it('are never read finer than the flat tiles exist', () => {
    for (const { step } of SIZES) {
      for (let zoom = 0; zoom <= WORLD_MAX_ZOOM - step; zoom += 1) {
        expect(footprintOf(zoom, 0, 0, step).sourceZoom).toBeLessThanOrEqual(FLAT_MAX_ZOOM);
      }
    }
  });
});
