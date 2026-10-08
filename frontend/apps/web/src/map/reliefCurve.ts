/**
 * How strongly the relief is drawn at each zoom: `far` from the world's edge in to zoom `from`, `near` from zoom
 * `to` in to the closest, eased between, so the mountains can stand out heavily on the continent and be a light
 * shading close in, where the scenery and the paint carry the ground. Adam's, of 2026-10-07: heavy at zoom 5 and
 * 6, light up close.
 */
export interface ReliefCurve {
  far: number;
  near: number;
  from: number;
  to: number;
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** The strength at a zoom, from nought, as a share of the level's own. */
export function strengthAt(curve: ReliefCurve, zoom: number): number {
  const span = Math.max(0.01, curve.to - curve.from);
  const t = Math.min(1, Math.max(0, (zoom - curve.from) / span));
  return curve.far + (curve.near - curve.far) * ease(t);
}

/**
 * How many times steeper than it is the ground is shaded as at a zoom, before Adam's own steepness: MapLibre's
 * rule for its hillshade, two to the power of three tenths a zoom out from fifteen, on the zoom a 256-pixel tile
 * is drawn at. Far out a pixel covers kilometres, and a slope averaged over kilometres is gentle, so without it a
 * mountain range would barely show on the continent: about six and a half times at zoom 5, two and a third at 10.
 */
export function steepenedAt(zoom: number): number {
  return 2 ** ((15 - (zoom + 1)) * 0.3);
}

/** How many stops a MapLibre expression of the curve has: enough that its straight lines follow the ease. */
const STOPS = 6;

/**
 * The curve as a MapLibre expression of the zoom, for its own hillshade, with `value` turning a strength into
 * what the property takes: a number, or a colour with that much alpha.
 */
export function strengthByZoom<Value extends number | string>(
  curve: ReliefCurve,
  value: (strength: number) => Value,
): ['interpolate', ['linear'], ['zoom'], ...(number | Value)[]] {
  const span = Math.max(0.01, curve.to - curve.from);
  const stops: (number | Value)[] = [];
  for (let i = 0; i <= STOPS; i += 1) {
    const zoom = curve.from + (span * i) / STOPS;
    stops.push(zoom, value(strengthAt(curve, zoom)));
  }
  return ['interpolate', ['linear'], ['zoom'], ...stops];
}
