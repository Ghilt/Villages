/**
 * The one light the map is lit by, and the two colours it lights and shades the ground in: the relief's, and the
 * clouds', which take their lit side, their far side and their shadows from it so the clouds and the hills agree.
 * Nothing imported, so a shader anywhere can read it without bringing MapLibre along. The water's sun is still its
 * own, in `water/look.ts`; whether it joins this one is Adam's call.
 */

/**
 * From the upper right, as the scenery's shadows are cut for (`LOOK-AND-FEEL.md`): they fall a third of a sprite's
 * height to the left and a tenth below, so the light stands seventy degrees round from north, forty degrees up.
 */
export const LIGHT = { direction: 70, altitude: 40 } as const;

/** Faces turned from the light: a dusky violet. Red, green and blue from nought to one. */
export const SHADE_COLOUR = [52 / 255, 44 / 255, 72 / 255] as const;

/** Faces turned towards it: a warm cream. */
export const LIGHT_COLOUR = [1, 249 / 255, 230 / 255] as const;

/**
 * Which way the light comes from, on the ground, as a step of one world unit towards it: east and south positive, as
 * world units run.
 */
export function towardsTheLight(): { east: number; south: number } {
  const round = (LIGHT.direction * Math.PI) / 180;
  return { east: Math.sin(round), south: -Math.cos(round) };
}
