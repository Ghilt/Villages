/**
 * Heath, scrub and tundra: low woody growth a gust only stirs, gentler than the grass, in clumps of each kind's
 * own size and colours, and cotton grass nodding its white heads on the tundra. What the sliders set is in
 * `heathTuning.ts`.
 */
export const HEATH_LOOK = {
  /**
   * Each kind's own look, in the order the mask numbers them: how big a clump is across from its middle, the share
   * of the cells that grow one, its shaded underside and its lit top, how strong it is, and whether cotton grass
   * grows among it. A kind of land whose motion is the heath's and is not here fails a test.
   */
  kinds: {
    heath: {
      radius: 0.11,
      thick: 0.95,
      dark: [0.22, 0.16, 0.19],
      light: [0.6, 0.4, 0.55],
      opacity: 0.6,
      cotton: 0,
    },
    scrub: {
      radius: 0.17,
      thick: 0.5,
      dark: [0.2, 0.23, 0.13],
      light: [0.52, 0.56, 0.38],
      opacity: 0.62,
      cotton: 0,
    },
    tundra: {
      radius: 0.07,
      thick: 0.85,
      dark: [0.3, 0.28, 0.17],
      light: [0.6, 0.58, 0.42],
      opacity: 0.45,
      cotton: 1,
    },
  },
  /** One clump to a cell this many world units across, from how many pixels it is drawn at all, and whole. */
  cell: 0.3,
  fromPixels: 2.5,
  wholePixels: 4.5,
  /** The faint paler side a gust shows on it, far fainter than on the grass, and how strong. */
  sheen: [0.9, 0.88, 0.75],
  sheenOpacity: 0.08,
  /** How far a whole gust nudges a clump down the wind, as a share of its size; how far it sways, and how fast. */
  nudge: 0.3,
  sway: 0.06,
  swaySpeed: 0.4,
  cotton: {
    /** How tall a stem stands, and how big its white head is, in world units. */
    height: 0.28,
    head: 0.04,
    /** How far a whole gust bends a stem down the wind, and how far it nods with none, as shares of its height. */
    bend: 0.8,
    sway: 0.15,
    swaySpeed: 0.7,
    stem: [0.45, 0.42, 0.28],
    stemOpacity: 0.35,
    white: [0.98, 0.97, 0.93],
    whiteOpacity: 0.8,
  },
} as const;
