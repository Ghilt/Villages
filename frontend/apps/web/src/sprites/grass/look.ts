import { WATER_LOOK } from '../../water/look';

/**
 * WIP SPIKE: every number of the grass's look, for Adam's eye. Colours are red, green and blue from nought to
 * one; sizes are world units, a master pixel each, unless they say pixels.
 */
export const GRASS_LOOK = {
  /** Which terrain classes the grass grows on, by their names in `world/palette.json`. */
  classes: ['steppe', 'meadow', 'savanna', 'alpine-meadow'],
  /** Where it fades in, as the water does: whole half a zoom in from here, gone half a zoom out. */
  fromZoom: 8.5,
  /**
   * What low and high are for the grass, the levels in the Shaders section: how much of the screen's width and
   * height it is worked out at, a half being a quarter of the pixels and about a quarter of the cost, and how
   * often it moves. Low is at every load.
   */
  levels: {
    low: { resolution: 0.5, framesPerSecond: 15 },
    high: { resolution: 1, framesPerSecond: 30 },
  },
  /** The way the wind blows, in degrees from east towards south: the sea's, so the two agree. */
  wind: WATER_LOOK.realistic.waves.wind,
  gusts: {
    /** How big a gust is, and how fast it travels down the wind, in world units a second. */
    size: 9,
    speed: 2.2,
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
} as const;
