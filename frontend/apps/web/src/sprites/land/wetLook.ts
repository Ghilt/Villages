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
    /** The light a ruffled pool catches: its colour, how strong, and how fine the ripples, which run with the gusts. */
    glint: [0.88, 0.92, 0.94],
    glintOpacity: 0.55,
    ripple: 0.35,
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
  mist: {
    /** How big a bank of mist is, in world units, how fast it drifts down the wind, its colour and its most. */
    size: 14,
    speed: 0.35,
    colour: [0.93, 0.94, 0.95],
    opacity: 0.5,
  },
} as const;
