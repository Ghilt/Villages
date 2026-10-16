/**
 * Every number of the critters, for Adam's eye. Sizes and distances are world units, a master pixel each, about
 * 1.2 kilometres; times are seconds. A critter is drawn at the scenery's own scale, where a tree is three to five
 * world units tall, not at its own, which would be a three-hundredth of a pixel. See docs/plans/living-world.md.
 */
export const CRITTERS_LOOK = {
  /**
   * What low and high are for the critters, the levels in the Shaders section: how often they move. They are drawn
   * with the sprite canvas at its own size, so a level is only its frames. Low is at every load.
   */
  levels: {
    low: { resolution: 1, framesPerSecond: 15 },
    high: { resolution: 1, framesPerSecond: 30 },
  },
  /** From this zoom in they come, fading in until they are whole at the next. */
  fromZoom: 9,
  wholeAt: 9.5,
  /**
   * The ground is cut into cells this many world units across, and the wall clock into slots this many seconds long:
   * each cell's slot may bring one critter, or one flock, at a moment of its own inside the slot.
   */
  cell: 8,
  slot: 12,
  /** The chance a cell's slot brings anything at the fullest density, before its ground's own commonness. */
  chance: 0.05,
  /** How many critters there are, from nought, none, to one, the most: the Critters part's slider. */
  density: 0.4,
  /** How big each kind is drawn: how tall its frames stand, in world units. */
  kinds: {
    songbird: { size: 0.55 },
    squirrel: { size: 0.45 },
    hare: { size: 0.55 },
    fish: { size: 0.6 },
  } as Record<string, { size: number } | undefined>,
  /** A flock bursting out of cover together, fanning out, climbing, flapping and gliding away, fading as it goes. */
  flush: {
    /** How many birds a flock has, the fewest and the most. */
    flock: [2, 5],
    /** How long a bird flies from its cover until it is gone, and how far it gets in that time. */
    seconds: 3.6,
    reach: 9,
    /** How high above its cover it climbs on the way. */
    climb: 2.5,
    /** How wide the flock fans out, in degrees, and how long after the first the last one leaves. */
    spread: 70,
    stagger: 0.35,
    /** How fast a wing beats, and the share of the flight it flaps before it glides, flapping again now and then. */
    flapsPerSecond: 9,
    flapping: 0.55,
    /** The share of its flight a bird takes to come out of its cover whole, and to fade away at the end. */
    fadeIn: 0.05,
    fadeOut: 0.35,
  },
} as const;
