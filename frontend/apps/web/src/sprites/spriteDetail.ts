/**
 * How much of a house to draw at a given zoom, and the small idle motion that keeps the world from looking
 * like a printed map. Pure, so the decisions can be tested without a renderer.
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

export function detailForZoom(zoom: number): SpriteDetail {
  if (zoom < DETAIL_FROM_ZOOM.dot) {
    return 'hidden';
  }
  return zoom < DETAIL_FROM_ZOOM.marker ? 'dot' : 'marker';
}

export function markerHeightForZoom(zoom: number): number {
  const { atZoom, inPixels } = MARKER_HEIGHT;
  const progress = (zoom - atZoom.small) / (atZoom.large - atZoom.small);
  const clamped = Math.min(1, Math.max(0, progress));
  return inPixels.small + clamped * (inPixels.large - inPixels.small);
}

/** How long one breath of the idle motion takes, and how far it carries. */
export const IDLE_MOTION = {
  periodMs: 2600,
  liftPixels: 2.2,
  swayRadians: 0.028,
} as const;

/**
 * A stable, arbitrary offset into the idle motion, so that neighbouring houses do not breathe in unison.
 * Derived from the identifier rather than stored, because it must survive a reload and a reconnection.
 */
export function phaseFor(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 2 ** 32) * Math.PI * 2;
}

export interface IdleMotion {
  /** Pixels to raise the sprite by; positive is upwards on the screen. */
  lift: number;
  /** A slight lean, in radians. */
  tilt: number;
}

export function idleMotionAt(elapsedMs: number, phase: number): IdleMotion {
  const angle = (elapsedMs / IDLE_MOTION.periodMs) * Math.PI * 2 + phase;
  return {
    lift: Math.sin(angle) * IDLE_MOTION.liftPixels,
    tilt: Math.cos(angle) * IDLE_MOTION.swayRadians,
  };
}
