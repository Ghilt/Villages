/**
 * What a diamond of worked ground is, in order of strength: where two meet, the stronger is drawn. The ground under a
 * road and along its sides, the wayside, is the weakest and is not drawn at all - the road is drawn as a shape over it
 * (`sprites/roads/`) - but no tree grows on it. A settlement's ground is the next, so its lanes, its streets and its
 * yards show on it; a street is stronger than a yard's ring and weaker than a footprint. Its own module, importing
 * nothing, because the renderer's scene carries worked ground and the ground's modules read the scene's sprites. See
 * docs/plans/worked-ground.md, docs/plans/settlements-and-roads.md and docs/plans/houses-bridges-and-road-render.md.
 */
export const WORKED = {
  wayside: 1,
  settlement: 2,
  path: 3,
  ruinRing: 4,
  ring: 5,
  road: 6,
  ruinFootprint: 7,
  footprint: 8,
} as const;
export type Worked = (typeof WORKED)[keyof typeof WORKED];
