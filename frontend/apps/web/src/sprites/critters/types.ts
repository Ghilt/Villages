import type { Behaviour } from './casts';

/**
 * The shapes the critters are told in: the cover they come out of, what the clock needs of the ground, a critter and
 * its animals, where one is at a moment, and the rings a fish leaves on the water. Apart from the clock
 * (`critterClock.ts`) so the hop and the leap (`hop.ts`, `leap.ts`), which the clock calls, can take them without
 * importing each other round a ring.
 */

/** A piece of the scenery a critter can come out of: where it stands, what kind it is, and how tall. */
export interface Cover {
  x: number;
  y: number;
  kind: string;
  height: number;
}

/** What the clock needs to know about the ground. */
export interface Ground {
  /** The scenery standing in a square of world units, in its own order; null while it is not yet known. */
  coverIn(fromX: number, fromY: number, toX: number, toY: number): readonly Cover[] | null;
  /** The terrain class at a place, by its name in `world/palette.json`, or null where there is none. */
  classAt(x: number, y: number): string | null;
  /** Whether the house sees the place now. Critters are only where it does. */
  sees(x: number, y: number): boolean;
}

/**
 * One animal of a critter, a bird of a flock or the one that hops: which way it goes, how long after the first it
 * leaves, how far, its own wingbeat or where on its way it stops, and the cover it goes into, if it does, with how
 * long it takes to get there and which way its path bows.
 */
export interface Animal {
  /** On the ground, in radians from east towards south, as world units run. */
  heading: number;
  delay: number;
  /** A share of the flock's reach. */
  reach: number;
  phase: number;
  /** The tree or bush it goes into; null for a bird that flies off and fades. */
  to: Cover | null;
  seconds: number;
  /** From one side to the other, minus one to one. */
  bow: number;
  /** Where in its cover a bird of a burst starts, off the cover's own point and up or down in its crown. */
  nudge?: { x: number; y: number; height: number };
}

export interface CritterEvent {
  /** Its identity: the cell and the slot it came out of. */
  key: string;
  kind: string;
  behaviour: Behaviour;
  /** When it begins, in seconds of the wall clock since 1970. */
  startsAt: number;
  /** What it comes out of. */
  from: Cover;
  animals: readonly Animal[];
}

/** Where one critter is at a moment: the ground under it, how high above that, which frame, and how much of it. */
export interface Pose {
  x: number;
  y: number;
  height: number;
  frame: number;
  alpha: number;
  /** How far its nose is tipped up from level, in radians, down below nought: a leaping fish's. */
  tilt?: number;
  /** Which way it flies, on the ground, in radians from east towards south: a soaring bird's, seen from above. */
  heading?: number;
}

/** A ring spreading on the water at a moment: where, how wide across from its middle, and how bright. */
export interface Ring {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

/** A critter asked for by a click on the map (`critterSpawn.ts`): what, where in world units, and when, in seconds. */
export interface SpawnAsk {
  id: number;
  kind: string;
  x: number;
  y: number;
  at: number;
}
