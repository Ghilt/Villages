/**
 * A small, seeded, wrapping value noise over the map, used to give coastlines a wobble so that nothing
 * traces exactly. Deterministic, so the same seed always produces the same world.
 */

function hash(x: number, y: number, seed: number): number {
  let h = seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

/** Smoothstep, so that the value and its slope are continuous across a cell boundary. */
const ease = (t: number): number => t * t * (3 - 2 * t);

export interface NoiseField {
  /** How many cells the noise grid has east to west. Longitude wraps, so this also sets the wrap period. */
  cellsX: number;
  cellsY: number;
  seed: number;
}

/**
 * A value in [-1, 1] at a place on the map, varying smoothly and wrapping at the antimeridian.
 * The channel lets one field drive several independent offsets.
 */
export function noiseAt(lng: number, lat: number, field: NoiseField, channel = 0): number {
  const u = ((lng + 180) / 360) * field.cellsX;
  const v = ((lat + 90) / 180) * field.cellsY;

  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const fx = ease(u - x0);
  const fy = ease(v - y0);

  const wrapX = (x: number): number => ((x % field.cellsX) + field.cellsX) % field.cellsX;
  const seed = field.seed + channel * 0x9e3779b9;

  const c00 = hash(wrapX(x0), y0, seed);
  const c10 = hash(wrapX(x0 + 1), y0, seed);
  const c01 = hash(wrapX(x0), y0 + 1, seed);
  const c11 = hash(wrapX(x0 + 1), y0 + 1, seed);

  const top = c00 + (c10 - c00) * fx;
  const bottom = c01 + (c11 - c01) * fx;
  return (top + (bottom - top) * fy) * 2 - 1;
}
