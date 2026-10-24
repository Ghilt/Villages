import type { Graphics } from 'pixi.js';

import type { ScreenPoint } from '../../geometry/cameraMath';

/**
 * The glow of a die at rest in the rarity its roll drew: a soft ring of light round it, `colour` any CSS colour, its
 * middle clear so the die is never tinted, rising over `RISES_MS` from the moment it came to rest and then breathing as
 * its ring does. None for a common roll, which is drab on Adam's word of 2026-10-24.
 */

/** How long the glow takes to rise once the die is at rest. */
export const RISES_MS = 450;

/**
 * Bands of light from the die outwards, each overlapping the next so they blur into one: how far out each lies and how
 * wide it is in die widths, and how strong.
 */
const BANDS: readonly (readonly [number, number, number])[] = [0, 1, 2, 3, 4, 5, 6, 7].map((at) => [
  0.9 + at * 0.3,
  0.6,
  0.3 * (1 - at / 8) ** 1.5,
]);
/** The fewest pixels a die width is taken as here, so the glow round a die far out is still seen. */
const AT_LEAST = 14;

export function drawGlow(
  glow: Graphics,
  ground: ScreenPoint,
  dieWide: number,
  colour: string,
  since: number,
  t: number,
): void {
  const rise = Math.min(1, Math.max(0, (t - since) / RISES_MS));
  const eased = 1 - (1 - rise) ** 3;
  const breath = 0.85 + 0.15 * Math.sin((t / 1600) * Math.PI * 2);
  glow.clear();
  const wide = Math.max(dieWide, AT_LEAST);
  // Round the die's body, a little above its ground point.
  const middle = { x: ground.x, y: ground.y - dieWide * 0.35 };
  const grown = 0.7 + 0.3 * eased;
  for (const [out, band, strength] of BANDS) {
    glow
      .circle(middle.x, middle.y, out * wide * grown)
      .stroke({ width: band * wide, color: colour, alpha: strength * eased * breath });
  }
}
