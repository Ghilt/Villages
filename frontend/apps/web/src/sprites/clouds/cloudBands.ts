/**
 * Which band of the clouds a camera zoom is in, and how they are drawn there. Pure, so the bands can be held to
 * having no gaps and no jumps without a renderer.
 *
 * Closer in than `inFrom` the camera is under the clouds and nothing is drawn. From `overFrom` out it is over them,
 * and they lie on the map glued to the ground, whole down to `fadeFrom` and fading to nothing by `goneAt`, past
 * which the whole world reads clearly. Between `overFrom` and `inFrom` it is in them: the same clouds, nearer the
 * camera the closer it comes, so they are drawn magnified about the screen's middle, swelling and sliding out past
 * its edges, with the middle kept clear by a ring that opens out towards `inFrom`, and their shadows on the ground
 * fading as it comes down through. Every change is eased, so nothing pops at an edge.
 */

import { CLOUD_LOOK } from './look';

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
  /** How far into the clouds the camera is: nought over them, one at `inFrom`. */
  inside: number;
  /** How many times the clouds are magnified about the screen's middle: exactly one over them. */
  magnification: number;
  /** How much of the clumps' own shapes is kept: all of it from `fadeFrom` in, `FAR_DETAIL` by `goneAt`. */
  detail: number;
}

/** How much of the clumps' own shapes is kept by `goneAt`, so the weather systems lead far out. */
export const FAR_DETAIL = CLOUD_LOOK.systems.farDetail;

/** How many times the clouds are magnified at `inFrom`, where the camera is among them. */
export const SWELL = 4;

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
    return { name: 'under', clouds: 0, shadows: 0, inside: 1, magnification: SWELL, detail: 1 };
  }
  if (zoom > overFrom) {
    // Linear in zoom, so the clouds swell steadily as the camera comes down; squared in the magnification, so the
    // swelling starts from nothing at the band's edge rather than with a kink.
    const inside = Math.min(1, Math.max(0, (zoom - overFrom) / (inFrom - overFrom)));
    return {
      name: 'in',
      clouds: 1 - ease(0.75, 1, inside),
      shadows: 1 - ease(0.3, 1, inside),
      inside,
      magnification: SWELL ** (inside * inside),
      detail: 1,
    };
  }
  if (zoom >= fadeFrom) {
    return { name: 'over', clouds: 1, shadows: 1, inside: 0, magnification: 1, detail: 1 };
  }
  if (zoom > goneAt) {
    const fading = ease(goneAt, fadeFrom, zoom);
    const detail = FAR_DETAIL + (1 - FAR_DETAIL) * fading;
    return { name: 'fading', clouds: fading, shadows: fading, inside: 0, magnification: 1, detail };
  }
  return { name: 'gone', clouds: 0, shadows: 0, inside: 0, magnification: 1, detail: FAR_DETAIL };
}
