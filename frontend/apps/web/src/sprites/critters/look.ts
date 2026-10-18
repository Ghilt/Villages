/**
 * Every number of the critters, for Adam's eye. Sizes and distances are world units, a master pixel each, about
 * 1.2 kilometres; times are seconds. A critter is drawn at the scenery's own scale, where a tree is three to five
 * world units tall, not at its own, which would be a three-hundredth of a pixel. See docs/plans/living-world.md.
 */
export const CRITTERS_LOOK = {
  /**
   * What low and high are for the critters, the levels in the Shaders section: how often they move. They are drawn
   * with the sprite canvas at its own size, so a level is only its frames; the Critters part sets it, low at every load.
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
  /**
   * How big each kind is drawn: how tall its frames stand, in world units. And how many come together, the fewest and
   * the most, where a kind's own number is not the flush's flock or a single bird circling: the crows of the ruins,
   * bursting out in a bigger flock than the songbirds', and circling over a ruin two or three together.
   */
  kinds: {
    songbird: { size: 0.55 },
    squirrel: { size: 0.45 },
    hare: { size: 0.55 },
    fish: { size: 0.6 },
    hawk: { size: 1.1 },
    crow: { size: 0.7, together: [4, 9] },
    'crow-aloft': { size: 0.9, together: [2, 3] },
    rat: { size: 0.35 },
    frog: { size: 0.5 },
    snake: { size: 1.1 },
  } as Record<string, KindLook | undefined>,
  /**
   * A flock bursting out of cover together, fanning out, climbing, flapping and gliding away, fading as it goes; or a
   * bird or two flitting from one tree into another near it, seeking shelter. A burst's birds may drop into a tree
   * near by too.
   */
  flush: {
    /** The share of the flights that are a bird or two flitting to shelter, rather than a flock bursting out. */
    flits: 0.4,
    /** The share of a bursting flock's birds that drop into a tree near by rather than flying off. */
    settle: 0.35,
    /** How near and how far another tree may stand for a bird to take shelter in it, in world units. */
    shelter: [2.5, 10],
    /** How fast a bird flies to its shelter, in world units a second, and the shortest and longest it takes. */
    shelterSpeed: 3,
    shelterSeconds: [1.2, 4],
    /** The share of a flight to shelter a bird takes to drop into the crown, fading as it goes in. */
    settleIn: 0.2,
    /** How many birds a flock has, the fewest and the most. */
    flock: [2, 5],
    /** How long a bird flies from its cover until it is gone, and how far it gets in that time. */
    seconds: 3.6,
    reach: 9,
    /** How high above its cover it climbs on the way. */
    climb: 2.5,
    /**
     * How far a bird flying off turns as it goes, at the most, in radians over its flight to the hook: the birds of a
     * burst all curve the same way, by much the same, so the flock turns together as birds in flight do, each on an
     * arc rather than a straight line. Adam's of 2026-10-17.
     */
    arc: 0.9,
    /**
     * How wide the flock fans out, in degrees, and how long after the first the last one leaves: narrow, a shotgun's
     * blast in one direction rather than a burst every way, Adam's of 2026-10-17.
     */
    spread: 16,
    stagger: 0.35,
    /**
     * How far apart in its cover the birds of a burst start, at the most, in world units, to each side and up or down
     * in the crown: a little, so they leave as a few birds and not as one.
     */
    scatter: 0.3,
    /** How fast a wing beats, and the share of the flight it flaps before it glides, flapping again now and then. */
    flapsPerSecond: 9,
    flapping: 0.55,
    /**
     * Where a bird flying off hooks down, as a share of its flight: from here it turns sharply and drops straight down
     * the screen, settling, whole, and once settled it fades, quickly, over the last `fadeOut` of its flight. How far it
     * carries on along its way into the turn, and how far it drops after it, in lengths of its own picture: Adam's
     * word of 2026-10-16, a turn and then a drop; and of 2026-10-17, the fade after the hook, and the drop half what it
     * was, a little over half a bird length. The share of the hook the turn takes; the rest is the drop.
     */
    hookAt: 0.845,
    hookTurn: 0.3,
    hookDrop: 0.625,
    hookTurning: 0.46,
    fadeOut: 0.07,
    /** The share of its flight away a bird takes to come out of its cover whole. */
    fadeIn: 0.05,
  },
  /**
   * A small animal bounding a few times from one piece of cover to another near it, and gone behind it: a squirrel
   * from tree to tree in the woods, a hare out from behind a bush or a tuft on grassland. Each kind's own numbers.
   */
  hop: {
    squirrel: {
      /** How near and how far the cover it bounds to may stand, in world units. */
      reach: [2, 7],
      /** How far one bound carries it, how high it goes, and how many it makes a second. */
      bound: 0.7,
      high: 0.35,
      boundsPerSecond: 2.6,
      /** How long it stops once on the way, sitting still, before going on. */
      pause: 0.4,
      /** Which frame of its strip is it gathered, in the air, landing, and sitting still. */
      frames: { gathered: 0, air: 1, landing: 2, still: 0 },
    },
    hare: {
      reach: [2.5, 8],
      bound: 1,
      high: 0.4,
      boundsPerSecond: 2.2,
      pause: 0.9,
      frames: { gathered: 2, air: 1, landing: 2, still: 0 },
    },
    /** A rat of the ruins: low and quick, in many short scurries, from one heap of rubble or broken house to the next. */
    rat: {
      reach: [1.5, 5],
      bound: 0.4,
      high: 0.06,
      boundsPerSecond: 5,
      pause: 0.35,
      frames: { gathered: 1, air: 0, landing: 2, still: 1 },
    },
    /**
     * A frog of the wet land: short low hops from one tuft to the next, sitting a long while between them; and beside
     * any water, a lake's or a river's, a few hops into it, a ring spreading where it went in. How near and how far the
     * water may be, in world units, for a frog to hop into it.
     */
    frog: {
      reach: [1, 3],
      bound: 0.45,
      high: 0.22,
      boundsPerSecond: 2.2,
      pause: 1.4,
      frames: { gathered: 0, air: 1, landing: 2, still: 0 },
      water: [0.75, 1.75],
    },
  } as Record<string, HopLook | undefined>,
  /** How long a hopping animal takes to come out from behind its cover, and to go behind the next. */
  hopFade: 0.25,
  /**
   * A fish jumping clear of the water and falling back, a ring spreading where it left and one where it fell. It
   * leaps across the screen, east or west and a little either way, so it is seen from the side as its picture is.
   */
  leap: {
    /** How far it carries through the air, in world units, and how high it goes: the least and the most of each. */
    reach: [0.5, 1.1],
    high: [0.35, 0.7],
    /** How long it is out of the water, the least and the most, in seconds. */
    seconds: [0.6, 0.95],
    /** How many times a second its tail flicks from one side to the other. */
    flicksPerSecond: 8,
    /** How long it takes to come clear of the water, and to go back into it. */
    splash: 0.12,
    /** A ring on the water: how wide it starts and ends, in world units, how long it spreads, and how bright at first. */
    ring: { from: 0.08, to: 0.7, seconds: 1.4, alpha: 0.7 },
  },
  /**
   * A snake gliding out of a tuft of the wet land's reeds or grass into another near it, low on the ground and seen from
   * above, as the map is, its body waving as it goes: how near and how far the tuft it goes to may be, in world units;
   * how fast it glides, in world units a second; how far its way swings to either side and how many times a second;
   * how many of its frames go by a second; and how long it takes to come out of its cover and to go into the next.
   */
  slither: {
    reach: [2, 5],
    speed: 0.7,
    sway: 0.05,
    swaysPerSecond: 0.9,
    wavesPerSecond: 4,
    fade: 0.45,
  },
  /**
   * A bird circling slowly high over open ground, a hawk, its shadow sweeping the ground below it and away from the
   * light and passing under the trees. Seen from above, as the map is, and turned to the way it flies, its circle
   * drifting slowly down the wind.
   */
  soar: {
    /** How high it circles, the least and the most, in world units above the ground. */
    high: [6, 9],
    /** How wide its circle is from its middle, the least and the most, in world units. */
    radius: [2.5, 4],
    /** How long one turn of its circle takes, in seconds. */
    circleSeconds: 11,
    /** How long it is in sight, the least and the most, and how long it takes to come and to go, in seconds. */
    seconds: [14, 22],
    fade: 2,
    /** How far down the wind its circle drifts, in world units a second. */
    drift: 0.12,
    /** The share of the time it beats its wings, between long glides, and how fast while it does. */
    flapping: 0.12,
    flapsPerSecond: 4,
    /**
     * How dark its shadow is, its own shape on the ground, against a low bird's, whose fades as it climbs: a hawk's
     * stays, so it can be seen sweeping the ground.
     */
    shadow: 0.8,
  },
} as const;

/** A kind's own numbers: see `CRITTERS_LOOK.kinds`. */
export interface KindLook {
  size: number;
  together?: readonly [number, number];
}

/** A hopping kind's numbers: see `CRITTERS_LOOK.hop`. */
export interface HopLook {
  reach: readonly [number, number];
  bound: number;
  high: number;
  boundsPerSecond: number;
  pause: number;
  frames: { gathered: number; air: number; landing: number; still: number };
  /** How near and how far the water may be for it to hop into: a frog's, and no other's. */
  water?: readonly [number, number];
}
