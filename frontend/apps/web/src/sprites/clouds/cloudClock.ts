import { WORLD_MASTER_WIDTH } from '../../geometry/world';

/**
 * Where the wind has carried the clouds, worked out from the wall clock so every browser draws the same sky.
 *
 * The field the clouds are cut from repeats along the wind once every `CLOUD_PERIOD` world units, at every one of
 * its sizes. How far the wind has carried it since 1970 is tens of billions of world units, which a shader's
 * single-precision numbers cannot hold to within a cloud; worked out here in full precision and handed over modulo
 * the period, it comes round without a seam. Pure, so that can be held to.
 */

/** How far along the wind the field repeats: the world's width. */
export const CLOUD_PERIOD = WORLD_MASTER_WIDTH;

/** How far along the wind something moving at `speed` world units a second has been carried at `nowMs`, modulo the period. */
export function carried(nowMs: number, speed: number): number {
  const distance = ((nowMs / 1000) * speed) % CLOUD_PERIOD;
  return distance < 0 ? distance + CLOUD_PERIOD : distance;
}

/** A lattice of noise near `size`: its cell, and how many cells go round the period along the wind. */
export interface CloudLattice {
  cell: number;
  /** A whole number, so the lattice comes round whole with the period. */
  around: number;
}

export function latticeNear(size: number): CloudLattice {
  const around = Math.max(1, Math.round(CLOUD_PERIOD / size));
  return { cell: CLOUD_PERIOD / around, around };
}
