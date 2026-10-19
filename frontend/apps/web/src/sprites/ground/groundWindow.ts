import type { Worked } from './worked';
import { diamondOf } from './workedGround';

/**
 * The part of the worked ground the graphics card is handed: a window of the ground's lattice, a byte a diamond, laid
 * out in the lattice's own whole numbers so the shader reads a diamond with one look. It covers the view and a margin,
 * so a camera moving about inside it never has it made again; it is made again when the view leaves it, or when the
 * buildings change. See docs/plans/worked-ground.md.
 */

/** Diamonds the lattice runs from and how many across and down: `u` and `v` are the first texel's. */
export interface GroundWindow {
  u: number;
  v: number;
  width: number;
  height: number;
}

/** A stretch of the lattice, its ends included, in diamonds. */
export interface LatticeBounds {
  fromU: number;
  toU: number;
  fromV: number;
  toV: number;
}

/** How far past the view a window reaches each way, in diamonds: a camera moves that far before it is made again. */
export const MARGIN = 96;
/** The most diamonds a window is across or down; a view wider than it is too far out for worked ground to be seen. */
export const WIDEST = 4096;
/**
 * What a window's width is a whole number of, in diamonds, which is bytes. Pixi hands a texture's bytes to WebGL with
 * its rows aligned to four, its default, so a row of one byte a texel must be a multiple of four long: any other width
 * is refused as too short, and the texture reads as nothing - worked ground drawn only when a zoom happened to land on
 * a width of four, and never otherwise.
 */
export const ROW_ALIGNMENT = 4;

/** Whether a window holds the whole of a stretch of the lattice. */
export function covers(window: GroundWindow, bounds: LatticeBounds): boolean {
  return (
    bounds.fromU >= window.u &&
    bounds.fromV >= window.v &&
    bounds.toU < window.u + window.width &&
    bounds.toV < window.v + window.height
  );
}

/** The window for a view's stretch of the lattice, the margin round it; null when it would be too big to hand over. */
export function windowFor(bounds: LatticeBounds): GroundWindow | null {
  const u = Math.floor(bounds.fromU) - MARGIN;
  const v = Math.floor(bounds.fromV) - MARGIN;
  const reach = Math.ceil(bounds.toU) + MARGIN - u + 1;
  const width = Math.ceil(reach / ROW_ALIGNMENT) * ROW_ALIGNMENT;
  const height = Math.ceil(bounds.toV) + MARGIN - v + 1;
  return width > WIDEST || height > WIDEST ? null : { u, v, width, height };
}

/** The worked ground inside a window, a byte a diamond, row by row: nought where nothing is worn. */
export function fillWindow(worked: ReadonlyMap<number, Worked>, window: GroundWindow): Uint8Array {
  const bytes = new Uint8Array(window.width * window.height);
  for (const [key, kind] of worked) {
    const { u, v } = diamondOf(key);
    const across = u - window.u;
    const down = v - window.v;
    if (across >= 0 && down >= 0 && across < window.width && down < window.height) {
      bytes[down * window.width + across] = kind;
    }
  }
  return bytes;
}
