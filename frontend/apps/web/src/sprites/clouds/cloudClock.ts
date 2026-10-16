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

/**
 * How the wind carries one part of the field: from `from` world units at `atMs`, at `speed`. The one sky is carried
 * from nought at the start of 1970, so every browser at the default speed agrees; `respeed` starts a drift of its own
 * from wherever the sky stands when a slider changes the speed, so it changes pace without jumping.
 */
export interface Drift {
  atMs: number;
  from: number;
  speed: number;
}

/** The sky every browser draws at this speed. */
export function sharedDrift(speed: number): Drift {
  return { atMs: 0, from: 0, speed };
}

/** Where a drift has carried its part of the field at `nowMs`, modulo the period. */
export function carriedBy(drift: Drift, nowMs: number): number {
  if (drift.atMs === 0 && drift.from === 0) {
    return carried(nowMs, drift.speed);
  }
  const distance = (drift.from + ((nowMs - drift.atMs) / 1000) * drift.speed) % CLOUD_PERIOD;
  return distance < 0 ? distance + CLOUD_PERIOD : distance;
}

/**
 * The drift going on from `nowMs` at a new speed: the shared sky again when that is the shared speed, and otherwise
 * one carried on from where this one stands, so the clouds change pace where they are.
 */
export function respeed(drift: Drift, nowMs: number, speed: number, sharedSpeed: number): Drift {
  if (speed === drift.speed) {
    return drift;
  }
  return speed === sharedSpeed ? sharedDrift(speed) : { atMs: nowMs, from: carriedBy(drift, nowMs), speed };
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
