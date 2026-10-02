/**
 * WIP SPIKE: every number of the water's look, for Adam's eye. Colours are red, green and blue from nought to
 * one. A world unit is a pixel of the master, about a kilometre; a "size band" is the four on-screen sizes in
 * pixels at which a pattern fades in, is whole, starts to fade and is gone, so it stays put on the ground and
 * about the same size on the screen while the camera zooms.
 */
export const WATER_LOOK = {
  /**
   * Everything fades in about this camera zoom, over half a zoom either side; further out the sea is as painted
   * and nothing redraws for it. Adam's number, 2026-10-02.
   */
  fromZoom: 8.5,
  /** The frame rate the water is moved at, which is the only thing keeping the map redrawing. */
  framesPerSecond: 30,

  /** The realistic water: depth, waves, sun, caustics and surf. */
  realistic: {
    /**
     * How deep the water reads, nought shallow to one deep: the shelf sits at `shelf`, the open ocean beyond its
     * edge at one, softened over `shelfEdge` world units either side, and the last `shoreReach` units before the
     * shore shoal towards nothing. Lakes read at `lake`, rivers at `river`.
     */
    depth: { shelf: 0.5, shelfEdge: 6, shoreReach: 5, shoaling: 0.85, lake: 0.45, river: 0.3 },
    /** Laid over the painted water: turquoise where it is shallow, a dark blue where it is deep. */
    shallow: { colour: [0.45, 0.82, 0.8], opacity: 0.26 },
    deep: { colour: [0.04, 0.16, 0.3], opacity: 0.46 },

    /** Where the light comes from: towards the north-west and this high, in degrees. */
    sun: { towards: [-0.55, -0.65], elevation: 50 },
    waves: {
      /** The smallest wave's length in world units, and how many sizes, each twice the last. */
      first: 0.5,
      sizes: 8,
      band: [8, 16, 120, 240] as const,
      /** The way the wind blows them, in degrees from east towards south, and how far their directions spread. */
      wind: 25,
      spread: 38,
      /** How steep they are: the slope each of them adds at its crest. */
      steepness: 0.075,
      /** How many seconds the smallest takes to pass its own length; a wave four times longer takes twice as long. */
      period: 2.2,
      /** How much the slopes light and shade the water, and how bright and how tight the sun's glints are. */
      relief: 0.55,
      glint: 1,
      shininess: 1500,
    },
    caustics: {
      /** The smallest net's cell in world units, and how many sizes, each twice the last. */
      first: 2,
      sizes: 4,
      band: [40, 70, 170, 300] as const,
      colour: [0.85, 1.0, 0.95],
      /** How bright, how thin the lines (higher is thinner), and how fast the net shifts. */
      strength: 0.42,
      sharpness: 14,
      speed: 0.45,
      /** How far the waves bend them, in cells for a slope of one. */
      refraction: 0.6,
      /** No caustics below this depth, nought to one. */
      deepest: 0.75,
    },
    /**
     * The rivers' current, from the flow `npm run world:flow` works out: how fast the water runs downstream, in
     * world units a second, the smallest river and the greatest; and how long one of the two copies of the
     * surface slides before it starts over, which is all that keeps a bend from stretching the pattern.
     */
    rivers: { slowest: 0.5, fastest: 2, cycle: 1.6 },
    surf: {
      colour: [0.97, 0.99, 1.0],
      /** The foam along the very edge, in world units wide, and how solid. */
      edge: 0.55,
      edgeOpacity: 0.85,
      /** The lines of foam rolling in: so many world units apart, out to so far, taking so long to come in one. */
      spacing: 1.6,
      reach: 5,
      period: 5,
      opacity: 0.55,
      /** Lakes have this share of the sea's surf, and rivers this, or their banks' foam would fill them. */
      lake: 0.25,
      river: 0.15,
    },
  },

  /** The first spike's stylised wavelets, kept to compare against. */
  wavelets: {
    firstCell: 1.5,
    step: 3,
    sizes: 5,
    band: [16, 32, 100, 180] as const,
    density: 0.55,
    shortestLife: 3,
    longestLife: 6,
    wind: [0.8, 0.25],
    drift: 0.12,
    arch: 0.35,
    crest: { colour: [0.97, 0.99, 0.98], opacity: 0.85 },
    trough: { colour: [0.08, 0.2, 0.27], opacity: 0.4 },
  },
} as const;
