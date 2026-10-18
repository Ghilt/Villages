/**
 * The ice, the polar desert, the salt flats and the sand desert: points of light flashing for a moment and gone on
 * the ice and the salt, and drift - snow streaming along the wind over the ice and the polar desert, sand blowing off
 * the crests of the dunes - in faint pale streamers that run faster than the gusts. What the sliders set is in
 * `iceTuning.ts`.
 */
export const ICE_LOOK = {
  /**
   * Each kind's own look, in the order the mask numbers them: the share of its cells that glint, and in what colour;
   * how strongly it drifts, and in what; and whether its drift comes off the crests of dunes. A kind of land whose
   * motion is this one's and is not here fails a test.
   */
  kinds: {
    // On the ice, near white, snow and light are seen by their cool shades rather than their white.
    ice: { glints: 0.35, glint: [0.55, 0.8, 1], drift: 1, colour: [0.72, 0.8, 0.9], crests: 0 },
    'polar-desert': { glints: 0.08, glint: [0.62, 0.84, 1], drift: 0.8, colour: [0.97, 0.98, 1], crests: 0 },
    'salt-flat': { glints: 0.4, glint: [0.78, 0.9, 1], drift: 0, colour: [0.98, 0.97, 0.94], crests: 0 },
    // Sand blowing off a crest is paler than the sand it lies on, so it reads.
    'desert-sand': { glints: 0, glint: [1, 0.97, 0.88], drift: 0.8, colour: [1, 0.95, 0.8], crests: 1 },
  },
  glints: {
    /**
     * One glint at the most to a cell this many world units across, and how big its point is on the screen, in pixels:
     * a small star of light, its rays three times as long.
     */
    cell: 0.45,
    size: 1.6,
    /** How long one flashes, in seconds, and how long it waits between flashes, the least and the most. */
    flash: 0.3,
    between: [2.5, 6],
    opacity: 0.9,
  },
  drift: {
    /** How long a streamer is down the wind and how thin across it, in world units, and how fast it runs. */
    long: 3,
    thin: 0.22,
    speed: 4,
    /** How strong a streamer is at its most, where a gust blows. */
    opacity: 0.55,
    /** How far apart the dunes' crests stand, down the wind, in world units. */
    dunes: 2.6,
  },
} as const;
