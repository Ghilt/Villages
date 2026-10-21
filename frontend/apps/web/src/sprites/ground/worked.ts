/**
 * What a diamond of worked ground is, in order of strength: where two meet, the stronger is drawn. A settlement's
 * ground is the weakest, so its lanes, its streets and its yards show on it; a road is stronger than a yard's ring and
 * weaker than a footprint. Its own module, importing nothing, because the renderer's scene carries worked ground and
 * the ground's modules read the scene's sprites. See docs/plans/worked-ground.md and docs/plans/settlements-and-roads.md.
 */
export const WORKED = {
  settlement: 1,
  path: 2,
  ruinRing: 3,
  ring: 4,
  road: 5,
  ruinFootprint: 6,
  footprint: 7,
} as const;
export type Worked = (typeof WORKED)[keyof typeof WORKED];
