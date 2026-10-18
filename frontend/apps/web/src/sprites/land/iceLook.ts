/**
 * The ice, the polar desert, the salt flats and the sand desert: points of light flashing for a moment and gone on the
 * salt; snow streaming along the wind over the ice and the polar desert in faint streamers, and now and then a little
 * swirl of it; and on the sand, dunes standing up the screen as the trees do, lit and shaded by the one light, with
 * sand blowing over their crests. What the sliders set is in `iceTuning.ts`.
 */
export const ICE_LOOK = {
  /**
   * Each kind's own look, in the order the mask numbers them: the share of its cells that glint, and in what colour;
   * how strongly it drifts, and in what; how often the snow swirls; and whether it lies in dunes. A kind of land whose
   * motion is this one's and is not here fails a test.
   */
  kinds: {
    // On the ice, near white, snow is seen by its cool shade rather than its white.
    ice: { glints: 0, glint: [1, 1, 1], drift: 1, colour: [0.72, 0.8, 0.9], swirls: 1, dunes: 0 },
    'polar-desert': {
      glints: 0,
      glint: [1, 1, 1],
      drift: 0.8,
      colour: [0.97, 0.98, 1],
      swirls: 0.7,
      dunes: 0,
    },
    'salt-flat': { glints: 0.4, glint: [1, 1, 1], drift: 0, colour: [0.98, 0.97, 0.94], swirls: 0, dunes: 0 },
    // Sand blowing off a crest is paler than the sand it lies on, so it reads.
    'desert-sand': { glints: 0, glint: [1, 1, 1], drift: 1, colour: [1, 0.96, 0.84], swirls: 0, dunes: 1 },
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
  },
  swirls: {
    /** One swirl at the most to a cell this many world units across and a slot of the clock this many seconds long. */
    cell: 4,
    slot: 6,
    /** The share of the cells' slots that bring one, before the kind's own share and the slider. */
    chance: 0.35,
    /** How long one lasts, in seconds; how wide it is from its middle, in world units; how fast it drifts down the wind. */
    seconds: 2.6,
    radius: 0.9,
    drift: 0.6,
    /** How many times its two arms wind from the middle to the edge, and how many turns a second it spins. */
    turns: 1.4,
    spin: 0.5,
    colour: [0.62, 0.71, 0.85],
    opacity: 0.6,
  },
  dunes: {
    /**
     * The dunes lie in clumps of one, two or three over the sand desert, still sand between them, far fewer than they
     * were, Adam's word of the evening of 2026-10-18. The sand is cut into cells this many world units down the wind
     * and across it; this share of them holds a clump, wholly inside the cell and at least `margin` world units from
     * its edges, so no two clumps ever touch, more of them in some places and fewer in others by a slow pattern over
     * the cells this many of them across; and a clump is one dune, two or three, by these shares.
     */
    clumps: { cell: [62, 70], margin: 3, share: 1, patternSize: 5, together: [0.4, 0.35, 0.25] },
    /**
     * No dune of a clump ever touches another, Adam's word of the same evening. Two stand corner to corner, the second
     * behind the first down the wind and to one side of it across, with this many world units of sand between them
     * each way, the least and the most; a third stands straight behind one of them or straight beside it, end to end,
     * further off, by `far`, beside in this share of the clumps where it fits in the cell and behind where it does not.
     */
    near: [2, 4],
    far: [6, 10],
    beside: 0.5,
    /**
     * A dune is as deep down the wind as this at its biggest, in world units, twice what it was, Adam's word of that
     * evening. How big the smallest is against the biggest, how high the biggest stands, and how far through it its
     * crest lies, down the wind: a long gentle slope up to it from the windward side and a short steep slip face down
     * the lee.
     */
    depth: 8,
    smallest: 0.75,
    height: 2.4,
    crest: 0.78,
    /**
     * This share of the dunes are long ridges over two or three stretches this long; the rest crescents as long as
     * `length` at their biggest, highest in the middle and lower to their ends, their horns reaching down the wind by
     * `horns` of their depth. A long ridge's ends bend so too.
     */
    long: 0.65,
    stretch: 10,
    length: 10,
    horns: 0.45,
    /**
     * Some of the long ridges bend as an S, one end up the wind and the other down it, Adam's word of the evening of
     * 2026-10-18: this share of them, bent to either side by this share of their half-length, and by this many world
     * units at the most.
     */
    bends: { share: 0.45, by: 0.24, most: 3 },
    /** The lit faces and the shaded ones, against the flat sand, and how strongly a face is lit or shaded. */
    lit: [1, 0.95, 0.82],
    litOpacity: 0.5,
    shade: [0.5, 0.38, 0.24],
    shadeOpacity: 0.7,
    /** A thin bright line along each crest, where the lit slope meets the shaded slip face, and how wide, as a share of the dune. */
    crestLight: 0.5,
    crestWidth: 0.02,
    /** The ripples the wind lays across the windward slopes and the flat sand: how far apart, and how strongly they shade. */
    ripples: 0.5,
    rippleStrength: 0.12,
    /** How many steps the walk down the screen takes to find the dune a pixel sees. */
    steps: 16,
  },
  /**
   * The sand blowing over the dunes, in thin streaks along the screen's horizontal, flowing along it the way the wind
   * leans and curling as they go, Adam's word of 2026-10-18: how long a streak's cell is and how thin it is, in world
   * units; how fast it flows, in world units a second; and how many seconds a curl takes. Its flow over an hour is a
   * whole number of cells and its curls a whole number of turns, so it comes round with the clock without a jump.
   */
  sandFlow: {
    cell: 1.5,
    thin: 0.12,
    speed: 1.5,
    curl: 20,
  },
} as const;
