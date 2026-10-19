import { CROPS_LOOK } from './cropsLook';
import { HEATH_LOOK } from './heathLook';
import { ICE_LOOK } from './iceLook';
import { WET_LOOK } from './wetLook';

/**
 * Every number of the land's look, for Adam's eye, and what moves on every kind of land. Colours are red, green and
 * blue from nought to one; sizes are world units, a master pixel each, unless they say pixels. Each motion after the
 * grass keeps its numbers in a file of its own beside its shader, `cropsLook.ts` and the rest. See
 * docs/plans/living-world.md and decision record 0102.
 */

/**
 * A kind of land's land motion, how it moves in the wind and the light, as the folds of the Land part name them: the
 * grass swaying, on the grassland and under the woods' trees, the crops in their rows, the heath, the scrub and the
 * tundra stirring, the wet land's water, reeds and mist, and the ice's, the salt's and the sand's glints and drift. Or
 * nothing of the land layer's, on purpose: the water, which the water shader moves, and bare stone, which stands still.
 */
export type LandMotion = 'grass' | 'crops' | 'heath' | 'wet' | 'ice-salt-sand' | 'water' | 'still';

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
    taiga: 'grass',
    'taiga-open': 'grass',
    'conifer-forest': 'grass',
    'broadleaf-forest': 'grass',
    'mixed-forest': 'grass',
    rainforest: 'grass',
    'dry-forest': 'grass',
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
  /**
   * The grass, on steppe, meadow, savanna and alpine meadow, and under the woods' trees: its gusts, its patches, its
   * tufts, and each kind's own look.
   */
  grass: {
    /**
     * How much of the woods' undergrowth each kind's grass is, from nought, the grassland's own, to one, all of it:
     * under the woods' trees their ground looked too bare, Adam's word of 2026-10-19, and the steppe's tufts would
     * look good there. The conifers' floor of needles and moss is the sparest; the open taiga and the dry forest,
     * grassy under their trees, are half way. A kind of land whose motion is the grass and is not here fails a test.
     */
    woods: {
      steppe: 0,
      meadow: 0,
      savanna: 0,
      'alpine-meadow': 0,
      taiga: 1,
      'taiga-open': 0.6,
      'conifer-forest': 1,
      'broadleaf-forest': 0.85,
      'mixed-forest': 0.9,
      rainforest: 0.85,
      'dry-forest': 0.45,
    },
    /**
     * The woods' undergrowth at its fullest, which a kind's grass is as much of as `woods` says, and the grassland's
     * own the rest: this share of the tufts the grassland's density grows; a deeper green at the root and green at
     * the tip rather than straw; this share of the patches' tall grass, hardly any; this much low brush besides the
     * patches'; and the trees taking most of the gust, so this share of its sheen and of its bend.
     */
    undergrowth: {
      density: 0.4,
      root: [0.13, 0.2, 0.08],
      tip: [0.5, 0.6, 0.3],
      tall: 0.15,
      brush: 0.2,
      sheen: 0.3,
      bend: 0.5,
    },
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
      /** The shaded root and the lit tip of a stroke on the grassland, and how strong each is. */
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
   * The animal trails through the grass, the woods' undergrowth and the heath, Adam's word of 2026-10-19: the odd
   * little trail, only an absence of tufts. A trail runs where a field over the ground, a wander this many world units
   * across and a finer one this share of it, weighing this much, crosses its middle, and is this many world units to
   * each side of the line at its widest. Trails run only in patches a field this many world units across opens:
   * where it is more than `from`, less `by` for each step of the sliders' trails, opening over `soft` of it, the trail
   * narrowing to nothing as it closes. A tuft this far from the line by the field read about it never reads the field
   * at its own root.
   */
  trails: {
    scale: 14,
    fine: 0.3,
    fineWeight: 0.35,
    halfWidth: 0.26,
    patchSize: 50,
    from: 0.9,
    by: 0.3,
    soft: 0.08,
    margin: 0.8,
  },
  crops: CROPS_LOOK,
  heath: HEATH_LOOK,
  wet: WET_LOOK,
  ice: ICE_LOOK,
} as const;

/** What moves on a kind of land, by its name in the palette; null for a name the table does not have. */
export function motionOf(name: string): LandMotion | null {
  return (LAND_LOOK.lands as Record<string, LandMotion | undefined>)[name] ?? null;
}

/** The looks a motion names, by the names of the kinds of land it is drawn on, for a motion with more than one. */
export function looksOf(motion: LandMotion | null): readonly string[] {
  if (motion === 'heath') return Object.keys(LAND_LOOK.heath.kinds);
  if (motion === 'wet') return Object.keys(LAND_LOOK.wet.kinds);
  if (motion === 'ice-salt-sand') return Object.keys(LAND_LOOK.ice.kinds);
  return [];
}

/** How many steps of the woods' undergrowth the mask can tell apart, a kind's grass written that many below full. */
export const UNDERGROWTH_STEPS = 12;

/**
 * The byte a kind of land's motion is written in the mask at: full, but for the grass under the woods, a little below
 * full by how much of the woods' undergrowth it is, so a tuft knows it from the one look at the mask it takes anyway.
 * Never below 242 of 255, so the grass of the woods is as whole in the mask as the grassland's.
 */
export function strengthOf(name: string): number {
  const woods = (LAND_LOOK.grass.woods as Record<string, number | undefined>)[name] ?? 0;
  return motionOf(name) === 'grass' ? 255 - Math.round(woods * UNDERGROWTH_STEPS) : 255;
}

/**
 * Which of its motion's looks a kind of land is, as the mask numbers them: its place among the kinds its motion
 * names, heath, scrub and tundra for the heath's; nought for a motion with only the one look.
 */
export function lookOf(name: string): number {
  return Math.max(0, looksOf(motionOf(name)).indexOf(name));
}
