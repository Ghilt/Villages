/**
 * Which band of the clouds a camera zoom is in, and how much of them is drawn there. Pure, so the bands can be
 * held to having no gaps and no jumps without a renderer.
 *
 * Closer than `inFrom` the camera is under the clouds and nothing is drawn. From `inFrom` to `overFrom` it is in
 * them; from `overFrom` out it is over them, and they lie on the map whole down to `fadeFrom`, fading to nothing
 * by `goneAt`, past which the whole world reads clearly. Every fade is eased, so nothing pops at an edge.
 */

/** The zooms the bands change at, from the closest in. */
export interface CloudZooms {
  inFrom: number;
  overFrom: number;
  fadeFrom: number;
  goneAt: number;
}

export type CloudBandName = 'under' | 'in' | 'over' | 'fading' | 'gone';

export interface CloudBand {
  name: CloudBandName;
  /** How much of the clouds is drawn, nought to one. */
  clouds: number;
  /** How much of their shadows. */
  shadows: number;
}

const ease = (from: number, to: number, value: number): number => {
  if (to <= from) {
    return value >= to ? 1 : 0;
  }
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/** The zooms in order, whatever order the sliders were left in: each edge no closer in than the one before it. */
export function orderedZooms(zooms: CloudZooms): CloudZooms {
  const inFrom = zooms.inFrom;
  const overFrom = Math.min(zooms.overFrom, inFrom);
  const fadeFrom = Math.min(zooms.fadeFrom, overFrom);
  const goneAt = Math.min(zooms.goneAt, fadeFrom);
  return { inFrom, overFrom, fadeFrom, goneAt };
}

export function cloudBandAt(zoom: number, zooms: CloudZooms): CloudBand {
  const { inFrom, overFrom, fadeFrom, goneAt } = orderedZooms(zooms);
  if (zoom >= inFrom) {
    return { name: 'under', clouds: 0, shadows: 0 };
  }
  if (zoom > overFrom) {
    // Until the camera is drawn inside them, the clouds only thin away as it comes down through.
    const thinning = 1 - ease(overFrom, inFrom, zoom);
    return { name: 'in', clouds: thinning, shadows: thinning };
  }
  if (zoom >= fadeFrom) {
    return { name: 'over', clouds: 1, shadows: 1 };
  }
  if (zoom > goneAt) {
    const fading = ease(goneAt, fadeFrom, zoom);
    return { name: 'fading', clouds: fading, shadows: fading };
  }
  return { name: 'gone', clouds: 0, shadows: 0 };
}
