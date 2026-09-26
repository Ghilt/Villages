/**
 * How the fog of war looks: every number in it that is a matter of taste, in one place, for Adam's eye.
 *
 * Change one and save, and the page picks it up. Colours are red, green and blue from nought to one. A world
 * unit is the width of one pixel of the master: about 1.2 km on the equator and 0.8 km at fifty degrees north.
 * Decision records 0062 and 0065, and steps 6 and 7 of docs/plans/fog-of-war.md, say what each part is for.
 */
export const FOG_LOOK = {
  /** Unknown ground: a dark haze the coast and the lie of the land show through. */
  haze: {
    colour: [0.105, 0.098, 0.125],
    /** How dark it lies, nought to one, before the mist thickens and thins it. */
    opacity: 0.62,
  },

  /**
   * The mist the haze is made of: bands stretched along the screen, like mist lying over a field, big ones and
   * small ones drifting slowly across it the opposite way to each other. Far out the bands fade to a flat
   * haze rather than breaking into blotches, and only close in do they move.
   */
  mist: {
    /**
     * How much the haze thickens and thins in the bands, as a share of its darkness: 0.5 runs from half as
     * dark to half as dark again.
     */
    swell: 0.4,
    /** How many times wider than tall a band is on the screen. */
    stretch: 4,
    /** How tall the big bands are, and the small ones, in world units. */
    big: 36,
    small: 11,
    /** How fast the bands drift across the screen, in world units a second. */
    drift: 1,
    /**
     * How quickly the bands swell and thin where they lie, which is what makes the mist undulate: one is a
     * whole change a second, and 0.1 is one about every ten seconds.
     */
    churn: 0.3,
  },

  /** Revealed ground, once its colour is taken out: lifted a little towards this pale tone. */
  fade: {
    colour: [0.93, 0.91, 0.86],
    /** How far towards it, nought to one. */
    opacity: 0.24,
  },
} as const;
