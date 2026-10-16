import { WATER_LOOK } from '../../water/look';

/**
 * Every number of the clouds' look, for Adam's eye. Colours are red, green and blue from nought to one; sizes are
 * world units, a master pixel each, about a kilometre, unless they say pixels. See docs/plans/clouds.md.
 */
export const CLOUD_LOOK = {
  /**
   * What low and high are for the clouds, the levels in the Shaders section: how much of the screen's width and
   * height they are worked out at, a half being a quarter of the pixels, and how often they move. They drift a few
   * pixels a second, so a frame every twentieth of a second is already smooth. High is at every load.
   */
  levels: {
    low: { resolution: 0.5, framesPerSecond: 10 },
    high: { resolution: 1, framesPerSecond: 20 },
  },
  /** The way the wind carries them, in degrees from east towards south: the sea's, so the world has one wind. */
  wind: WATER_LOOK.realistic.waves.wind,
  /**
   * The zooms the clouds are drawn between: whole from `overFrom` out to `fadeFrom`, fading to nothing by
   * `goneAt`; between `overFrom` and `inFrom` the camera is in the clouds, and closer than `inFrom` it is under
   * them and nothing is drawn.
   */
  zooms: { inFrom: 7, overFrom: 6, fadeFrom: 5.25, goneAt: 4.5 },
  /**
   * The clumps' size, the noise's coarsest cell they are cut from: a clump comes out about two thirds of it across,
   * about a tenth of the screen at zoom 5.5.
   */
  size: 240,
  /** How much of the sky is cloud, nought to one, which sets where the field is cut. */
  cover: 0.35,
  /** How fast the wind carries them, in world units a second: about three minutes across the screen at 5.5. */
  speed: 12,
  /** How much the patches the clumps gather in decide where there is cloud, against the clumps themselves. */
  patches: 0.35,
  /** How soft a cloud's edge is, in the field's own measure; never less than about a pixel. */
  edge: 0.06,
  /** A cloud where it is thin, and where it is thick, and how opaque it is at its thickest. */
  thin: [0.86, 0.87, 0.9],
  thick: [1, 1, 1],
  opacity: 0.92,
} as const;
