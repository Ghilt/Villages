/**
 * Every number of the land's look, for Adam's eye, and what moves on every kind of land. Colours are red, green and
 * blue from nought to one; sizes are world units, a master pixel each, unless they say pixels. See
 * docs/plans/living-world.md and decision record 0102.
 */

/**
 * A kind of land's land motion, how it moves in the wind and the light, as the folds of the Land part name them: the
 * grass swaying, and the crops in their rows; the heath, the wet land, and the ice, the salt and the sand, each to
 * come in a step of its own and standing still until then. Or nothing of the land layer's, on purpose: the water,
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
} as const;

/** What moves on a kind of land, by its name in the palette; null for a name the table does not have. */
export function motionOf(name: string): LandMotion | null {
  return (LAND_LOOK.lands as Record<string, LandMotion | undefined>)[name] ?? null;
}
