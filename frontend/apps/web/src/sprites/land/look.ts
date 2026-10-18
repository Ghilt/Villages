/**
 * Every number of the land's look, for Adam's eye, and what moves on every kind of land. Colours are red, green and
 * blue from nought to one; sizes are world units, a master pixel each, unless they say pixels. See
 * docs/plans/living-world.md and decision record 0102.
 */

/**
 * A kind of land's land motion, how it moves in the wind and the light, as the folds of the Land part name them: the
 * grass swaying, the crops in their rows, the heath, the scrub and the tundra stirring, and the wet land's water, reeds
 * and mist; the ice, the salt and the sand to come in a step of their own and standing still until then. Or nothing of the land layer's, on purpose: the water,
 * which the water shader moves; a wood, whose life is its trees bending, the Trees part's; and bare stone, which
 * stands still.
 */
export type LandMotion = 'grass' | 'crops' | 'heath' | 'wet' | 'ice-salt-sand' | 'water' | 'trees' | 'still';

export const LAND_LOOK = {
  /**
   * What moves on every kind of land in `world/palette.json`, by its name there. A kind added to the palette fails a
   * test until it is given one.
   */
  lands: {
    ocean: 'water',
    'shallow-sea': 'water',
    lake: 'water',
    river: 'water',
    ice: 'ice-salt-sand',
    'polar-desert': 'ice-salt-sand',
    tundra: 'heath',
    taiga: 'trees',
    'taiga-open': 'trees',
    'conifer-forest': 'trees',
    'broadleaf-forest': 'trees',
    'mixed-forest': 'trees',
    rainforest: 'trees',
    'dry-forest': 'trees',
    // Their trees bend as every wood's do, with pools between their roots.
    mangrove: 'wet',
    'swamp-forest': 'wet',
    steppe: 'grass',
    meadow: 'grass',
    savanna: 'grass',
    scrub: 'heath',
    heath: 'heath',
    farmland: 'crops',
    'farmland-with-woods': 'crops',
    paddy: 'wet',
    marsh: 'wet',
    bog: 'wet',
    // The grass's sway, with pools here and there.
    floodplain: 'wet',
    'salt-flat': 'ice-salt-sand',
    'desert-sand': 'ice-salt-sand',
    'desert-stone': 'still',
    'alpine-meadow': 'grass',
    'bare-rock': 'still',
  } satisfies Record<string, LandMotion>,
  /** Where it fades in, as the water does: whole half a zoom in from here, gone half a zoom out. */
  fromZoom: 8.5,
  /**
   * What low and high are for the land, the levels in the Shaders section: how much of the screen's width and
   * height it is worked out at, a half being a quarter of the pixels and about a quarter of the cost, and how
   * often it moves. Low is at every load.
   */
  levels: {
    low: { resolution: 0.5, framesPerSecond: 15 },
    high: { resolution: 1, framesPerSecond: 30 },
  },
  /** The grass, on steppe, meadow, savanna and alpine meadow: its gusts, its patches and its tufts. */
  grass: {
    /** The gusts are the world's one wind's, `../wind.ts`, blowing the sea's way; the grass gives them its colour. */
    gusts: {
      /** The paler side a bent field shows, and how much of it a full gust shows. */
      colour: [0.93, 0.9, 0.7],
      opacity: 0.22,
    },
    /**
     * The colours of the grass's patches, which grassTuning.ts and its sliders lay out: bare ground keeps this share
     * of its tufts; tall grass has a paler straw tip; brush is a low round clump, shaded under and lit on top.
     */
    patches: {
      bareLeft: 0.06,
      tallTip: [0.95, 0.89, 0.6],
      brushDark: [0.19, 0.25, 0.1],
      brushLight: [0.46, 0.52, 0.25],
      brushOpacity: 0.6,
    },
    blades: {
      /** One tuft to a cell this many world units across, and how tall a tuft stands. */
      cell: 0.42,
      height: 0.55,
      /** How thick a stroke is on the screen, in pixels, at the least. */
      width: 1.6,
      /** How far a full gust bends a tuft down the wind, and how far it sways when there is none, as shares of its height. */
      bend: 0.7,
      sway: 0.12,
      /** How fast the gentle sway goes, in turns a second. */
      swaySpeed: 0.6,
      /** The shaded root and the lit tip of a stroke, and how strong each is. */
      root: [0.24, 0.32, 0.12],
      rootOpacity: 0.32,
      tip: [0.86, 0.85, 0.58],
      tipOpacity: 0.42,
      /** From how many pixels apart the tufts are drawn at all, and whole from how many. */
      fromPixels: 3,
      wholePixels: 6,
    },
  },
  /**
   * The crops, on farmland and farmland with woods: fields of a few world units, each fallow, ripe or green, in rows
   * of its own way, with long slow waves rolling through them. What the sliders set is in `cropsTuning.ts`.
   */
  crops: {
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
  },
  /**
   * Heath, scrub and tundra: low woody growth a gust only stirs, gentler than the grass, in clumps of each kind's
   * own size and colours, and cotton grass nodding its white heads on the tundra. What the sliders set is in
   * `heathTuning.ts`.
   */
  heath: {
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
  },
  /**
   * The wet land: open water among the growth catching the light, a ring spreading on it now and then, stems standing
   * in it - reeds in the marsh, shoots in rows in the paddy - and mist lying low over the marsh and the bog, drifting
   * down the wind. What the sliders set is in `wetTuning.ts`.
   */
  wet: {
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
  },
} as const;

/** What moves on a kind of land, by its name in the palette; null for a name the table does not have. */
export function motionOf(name: string): LandMotion | null {
  return (LAND_LOOK.lands as Record<string, LandMotion | undefined>)[name] ?? null;
}

/** The looks a motion names, by the names of the kinds of land it is drawn on, for a motion with more than one. */
export function looksOf(motion: LandMotion | null): readonly string[] {
  if (motion === 'heath') return Object.keys(LAND_LOOK.heath.kinds);
  if (motion === 'wet') return Object.keys(LAND_LOOK.wet.kinds);
  return [];
}

/**
 * Which of its motion's looks a kind of land is, as the mask numbers them: its place among the kinds its motion
 * names, heath, scrub and tundra for the heath's; nought for a motion with only the one look.
 */
export function lookOf(name: string): number {
  return Math.max(0, looksOf(motionOf(name)).indexOf(name));
}
