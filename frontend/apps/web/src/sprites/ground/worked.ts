/**
 * What a diamond of worked ground is, in order of strength: where two meet, the stronger is drawn. Its own module,
 * importing nothing, because the renderer's scene carries worked ground and the ground's modules read the scene's
 * sprites. See docs/plans/worked-ground.md.
 */
export const WORKED = { path: 1, ruinRing: 2, ring: 3, ruinFootprint: 4, footprint: 5 } as const;
export type Worked = (typeof WORKED)[keyof typeof WORKED];
