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
  /**
   * How fast the patches drift against the clumps, a share of the speed: a little slower, so clumps come and go at a
   * patch's edge as they pass through it.
   */
  patchPace: 0.85,
  /**
   * How much faster than the clumps their finer detail and the warp drift, a share of the speed more: so the clumps
   * change shape as they go, slowly, rather than sliding by whole.
   */
  change: 0.35,
  /** How far the warp pushes the clumps about, a share of a clump's size. Its own cell is twice a clump's. */
  warp: 0.35,
  /** How much the patches the clumps gather in decide where there is cloud, against the clumps themselves. */
  patches: 0.35,
  /** How soft a cloud's edge is, in the field's own measure; never less than about a pixel. */
  edge: 0.035,
  /**
   * The brush their edges are broken by: how far it moves the cut, in the field's own measure, and its strokes'
   * length along the wind and width across, as shares of a clump. The length is one over a whole number, so the
   * strokes come round with the clumps.
   */
  brush: { strength: 0.04, along: 0.25, across: 0.06 },
  /**
   * How a cloud is lit: by whether its first `lumps` sizes of noise rise or fall towards the sun over a step of
   * `near` and one of `far` of a clump, the near one weighing `nearWeight`, times `contrast`. Lit full, it is the
   * relief's cream taken `litDepth` times as far from white; in between, `middle`; shaded full, white taken
   * `farSide` of the way to the relief's violet; and the three run into each other.
   */
  tones: {
    middle: [0.97, 0.97, 0.98],
    litDepth: 1.6,
    farSide: 0.4,
    lumps: 4,
    near: 0.07,
    far: 0.2,
    nearWeight: 0.6,
    contrast: 2.5,
  },
  /**
   * How far above its cut a cloud's field rises before the cloud is whole, so its margins are thin and the ground
   * shows through them; and the same for its shadow's darkness, so a thin margin casts a faint shadow.
   */
  thicken: 0.11,
  shadowThicken: 0.15,
  /**
   * How dark a cloud's shadow is, nought to one, laid in the relief's violet over whatever is under it, the haze
   * included; and how far from its cloud it falls, away from the light, as a share of a clump.
   */
  shadow: 0.5,
  reach: 0.5,
  /**
   * In the clouds, between `overFrom` and `inFrom`: the ring keeping the middle of the screen clear opens out to
   * `clearReach` of the way from the middle to a corner, soft over `clearSoft` either side; the tones run `mist` of
   * the way together towards white, and the edges soften `mistEdge` times more, where the camera is among them. How
   * many times the clouds are magnified there is `SWELL` in `cloudBands.ts`.
   */
  inside: { clearReach: 1.2, clearSoft: 0.3, mist: 0.7, mistEdge: 3 },
  /**
   * How far a mark's clearing lifts the cut, in the field's own measure, where it is whole: enough to clear all but
   * the thickest middle of a cloud, so the clouds thin from their edges. How far round a mark it reaches is the
   * `clearing` slider, in pixels.
   */
  lift: 0.7,
  clearing: 40,
  /** How opaque a cloud is at its thin edge, as a share of its middle, and at its middle. */
  thin: 0.5,
  opacity: 0.94,
} as const;
