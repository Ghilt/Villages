/**
 * The wet land: open water among the growth catching the light, a ring spreading on it now and then, stems standing
 * in it - reeds in the marsh, shoots in rows in the paddy - and mist lying low over the marsh and the bog, drifting
 * down the wind. What the sliders set is in `wetTuning.ts`.
 */
export const WET_LOOK = {
  /**
   * Each kind's own look, in the order the mask numbers them: how much of it is open water, at one a sheet of it;
   * the water's colour; how thickly stems stand, how tall, whether in rows, and their shaded root and lit tip; and
   * how much mist lies over it. A kind of land whose motion is the wet land's and is not here fails a test.
   */
  kinds: {
    mangrove: {
      pools: 0.45,
      water: [0.16, 0.24, 0.22],
      stems: 0,
      tall: 0,
      rows: 0,
      root: [0.2, 0.25, 0.12],
      tip: [0.5, 0.55, 0.3],
      mist: 0,
    },
    'swamp-forest': {
      pools: 0.4,
      water: [0.14, 0.2, 0.17],
      stems: 0,
      tall: 0,
      rows: 0,
      root: [0.2, 0.25, 0.12],
      tip: [0.5, 0.55, 0.3],
      mist: 0.5,
    },
    paddy: {
      pools: 2,
      water: [0.42, 0.56, 0.58],
      stems: 1,
      tall: 0.22,
      rows: 1,
      root: [0.2, 0.36, 0.1],
      tip: [0.58, 0.78, 0.32],
      mist: 0,
    },
    marsh: {
      pools: 0.35,
      water: [0.2, 0.3, 0.3],
      stems: 0.75,
      tall: 0.6,
      rows: 0,
      root: [0.25, 0.28, 0.12],
      tip: [0.66, 0.62, 0.38],
      mist: 1,
    },
    bog: {
      pools: 0.4,
      water: [0.12, 0.13, 0.1],
      stems: 0.25,
      tall: 0.3,
      rows: 0,
      root: [0.3, 0.25, 0.15],
      tip: [0.62, 0.52, 0.36],
      mist: 1,
    },
    floodplain: {
      pools: 0.15,
      water: [0.24, 0.34, 0.34],
      stems: 0.8,
      tall: 0.35,
      rows: 0,
      root: [0.22, 0.32, 0.12],
      tip: [0.62, 0.72, 0.42],
      mist: 0.3,
    },
  },
  pools: {
    /** How big a pool is, about, in world units, how strong its water, and how softly its edge goes. */
    size: 2.4,
    opacity: 0.5,
    soft: 0.05,
    /**
     * The light a ruffled pool catches: its colour, how strong, how fine the ripples, and how fast they run down the
     * wind, in world units a second - slowly, a tenth of the gusts' pace, Adam's word of 2026-10-18.
     */
    glint: [0.88, 0.92, 0.94],
    glintOpacity: 0.55,
    ripple: 0.35,
    rippleSpeed: 0.22,
    /**
     * Near a pool's edge the little waves follow it: bands along the shore, lapping in towards it, Adam's word of
     * 2026-10-18. How far in from the edge they reach and how far apart, in world units; how many seconds a wave takes
     * to come in by one band, a whole share of an hour; and how bright. The pools draw back from the wet land's own edge
     * by `recede` of the pattern they are cut from, so its edge is a shore too.
     */
    shore: { reach: 1.1, apart: 0.3, period: 3, opacity: 0.5, recede: 0.35 },
  },
  rings: {
    /** A pool is cut into cells this many world units across, and the clock into slots this many seconds long. */
    cell: 3,
    slot: 5,
    /** How long a ring spreads, in seconds, how wide it starts and ends, in world units, and how bright at first. */
    seconds: 1.6,
    from: 0.05,
    to: 0.6,
    opacity: 0.6,
    colour: [0.9, 0.94, 0.96],
  },
  stems: {
    /** One stem to a cell this many world units across; reeds stand in clumps this big, about. */
    cell: 0.22,
    clump: 1.5,
    /** In the paddy's rows: how big a field is, how far apart its rows, and its shoots along a row. */
    field: 2.2,
    row: 0.3,
    along: 0.24,
    /** How thick a stem is on the screen, in pixels, at the least, and how strong. */
    width: 1.1,
    opacity: 0.5,
    /** How far a whole gust bends a stem down the wind, and how far it sways with none, as shares of its height. */
    bend: 0.6,
    sway: 0.1,
    swaySpeed: 0.5,
    /** From how many pixels apart the stems are drawn at all, and whole from how many. */
    fromPixels: 2.5,
    wholePixels: 4.5,
  },
  /**
   * The mist, lying in banks along the screen's horizontal, long and thin and streaked, rising and falling along their
   * length and swaying slowly to and fro, Adam's word of 2026-10-18.
   */
  mist: {
    /** How long a bank is along the screen and how thin across it, in world units. */
    long: 9,
    thin: 0.9,
    /** How long a rise and fall along a bank is, and how far it rises, in world units. */
    wave: 3,
    sway: 0.35,
    /** How many seconds one sway to and fro takes: a whole share of an hour, so it comes round with the clock. */
    period: 60,
    colour: [0.93, 0.94, 0.95],
    opacity: 0.5,
  },
} as const;
