/**
 * How much of a house to draw at a given zoom. Pure, so the decisions can be tested without a renderer.
 *
 * There was an idle motion here until 2026-09-20: every mark breathed, lifting 2.2 pixels and leaning a
 * degree and a half over two and a half seconds, out of phase with its neighbours. It went because it
 * was asked to go, and it took two faults with it. The lift was in screen pixels, so a 7 pixel dot bobbed
 * by a third of itself while a castle barely stirred; and moving every mark by a fraction of a pixel every
 * frame made antialiased edges crawl, which is one of the things that read as flicker. The ring under a
 * selected house bobbed too, despite a comment saying it did not.
 */

export type SpriteDetail = 'hidden' | 'dot' | 'marker';

/**
 * Below the first threshold a house is not drawn at all, because a continent covered in dots says nothing.
 * Phase 2 replaces that silence with aggregates. Between the thresholds a house is a dot; above the second
 * it is a marker that will carry its banner.
 */
export const DETAIL_FROM_ZOOM = {
  dot: 3,
  marker: 8,
} as const;

export const DOT_RADIUS = 3.5;

/** A marker grows with the zoom, between these bounds, so that closeness reads as presence. */
export const MARKER_HEIGHT = {
  atZoom: { small: 8, large: 12 },
  inPixels: { small: 22, large: 46 },
} as const;

/**
 * How much of anything is drawn at this zoom.
 *
 * `everything` is the debug switch: with it on nothing is hidden for being far away. It cannot make a
 * house appear that the gateway never sent, which is why it comes with a frame. See 0038.
 */
export function detailForZoom(zoom: number, everything = false): SpriteDetail {
  if (zoom < DETAIL_FROM_ZOOM.dot) {
    return everything ? 'dot' : 'hidden';
  }
  return zoom < DETAIL_FROM_ZOOM.marker ? 'dot' : 'marker';
}

/** What one mark in particular may be spared, on top of what the camera says about all of them. */
export interface MarkContext {
  /** This window is showing everything, so no mark is hidden for distance. */
  everything?: boolean;
  /**
   * This mark is spared the distance floor: a candidate, because it is what the player is being asked
   * about, or one of the player's own holdings while the eye is open. Never anyone else's.
   */
  spared?: boolean;
}

/**
 * One mark's detail. A spared mark is never hidden, and is a dot where the rest are nothing; above the
 * floor it is drawn like anything else, because being kept in sight is about distance and not about
 * size. See decision record 0038.
 */
export function detailForMark(zoom: number, of: MarkContext = {}): SpriteDetail {
  const detail = detailForZoom(zoom, of.everything ?? false);
  return detail === 'hidden' && of.spared === true ? 'dot' : detail;
}

export function markerHeightForZoom(zoom: number): number {
  const { atZoom, inPixels } = MARKER_HEIGHT;
  const progress = (zoom - atZoom.small) / (atZoom.large - atZoom.small);
  const clamped = Math.min(1, Math.max(0, progress));
  return inPixels.small + clamped * (inPixels.large - inPixels.small);
}
