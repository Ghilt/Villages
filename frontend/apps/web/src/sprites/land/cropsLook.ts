/**
 * The crops, on farmland and farmland with woods: fields of a few world units, each fallow, ripe or green, in rows
 * of its own way, with long slow waves rolling through them. What the sliders set is in `cropsTuning.ts`.
 */
export const CROPS_LOOK = {
  /** The share of the fields that are not fallow that stand ripe; the rest are green. */
  ripe: 0.55,
  /** How wide the bare track between two fields is, in world units: nothing grows on it. */
  track: 0.25,
  /** A faint wash of each kind of field's colour over the painted farmland, so the patchwork shows. */
  wash: { ripe: [0.85, 0.72, 0.35], green: [0.42, 0.55, 0.22], fallow: [0.42, 0.32, 0.2], opacity: 0.14 },
  waves: {
    /**
     * How fast the waves travel down the wind, in world units a second, slower than the gusts, and how many times
     * longer a wave is across the wind than along it, so it rolls as a long band.
     */
    speed: 1.3,
    stretch: 2.5,
    /** The paler side a wave shows as it bends the crops. */
    sheen: [0.97, 0.93, 0.72],
    /**
     * The darker side the crops just behind a wave show as they stand up again, how strong it is against the
     * sheen, and how far behind the wave it falls, as a share of a wave's length.
     */
    shade: [0.36, 0.3, 0.12],
    shadeOpacity: 0.7,
    behind: 0.5,
  },
  stalks: {
    /** How far apart the stalks of a row stand, as a share of how far apart the rows are. */
    along: 0.75,
    /** How thick a stalk is on the screen, in pixels, at the least. */
    width: 1.3,
    /** How far a whole wave bends a stalk down the wind, and how far it sways when there is none, as shares of its height. */
    bend: 0.6,
    sway: 0.08,
    /** How fast the gentle sway goes, in turns a second. */
    swaySpeed: 0.5,
    /** The shaded root and the lit tip of a ripe stalk and of a green one, and how strong each is. */
    ripeRoot: [0.45, 0.37, 0.16],
    ripeTip: [0.96, 0.86, 0.5],
    greenRoot: [0.2, 0.3, 0.1],
    greenTip: [0.62, 0.74, 0.32],
    rootOpacity: 0.35,
    tipOpacity: 0.5,
    /** From how many pixels apart the rows are drawn at all, and whole from how many. */
    fromPixels: 3,
    wholePixels: 5,
  },
} as const;
