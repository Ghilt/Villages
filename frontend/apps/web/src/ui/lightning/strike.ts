import { arcOf, boltAlong, boltOn, crackleOn, forksOf, grownTo, leaderShare, wanderOf } from './bolt';
import type { Box, Spot } from './bolt';

/**
 * How a strike looks as it goes, worked out for a moment of it and not drawn: the lines of light there are, each in its
 * colour, how bright and how thick, and the flashes. Whatever draws them - strokes on a canvas, or a shader - draws the
 * same moment, so a look and a way of drawing it are chosen apart.
 */

/**
 * The ways a strike goes. `forked`: a bolt leaps the whole way at once, forking, and flickers. `leader`: a faint leader
 * feels its way there in jerks, then the strike comes back along it, bright, and again. `tendrils`: threads of light
 * writhe from the source to what they reach, as from a coil.
 */
export type Look = 'forked' | 'leader' | 'tendrils';

export const LOOKS: readonly Look[] = ['forked', 'leader', 'tendrils'];

/** A strike from a place to a box: from the receptacle to a slice. `key` changes with each, and starts it again. */
export interface Strike {
  readonly key: string;
  readonly from: Spot;
  readonly to: Box;
  /** Any CSS colour, a custom property's among them. */
  readonly colour: string;
  /**
   * Where its box is now, asked every frame, for a box that moves or grows as it is struck - a pane opening out: the
   * bolt comes down on it and the crackle runs round its edges as they go. `to` when absent, or when it says null.
   */
  readonly follow?: () => Box | null;
}

/** A line of light: its points, its colour, how bright from 0 to about 1, and its core's thickness in pixels. */
export interface Light {
  readonly points: readonly Spot[];
  readonly colour: string;
  readonly bright: number;
  readonly width: number;
}

/** A flash of light round a place, `reach` pixels across. */
export interface Flash {
  readonly at: Spot;
  readonly colour: string;
  readonly bright: number;
  readonly reach: number;
}

export interface Moment {
  readonly lights: readonly Light[];
  readonly flashes: readonly Flash[];
}

/** How long a strike lasts, in milliseconds, whatever its look. */
export const LIFE = 1000;

/** When, in milliseconds, each look's strike reaches what it strikes: when the slice should flash. */
export const REACHES: Readonly<Record<Look, number>> = { forked: 90, leader: 300, tendrils: 160 };

/** How often a bolt is worked out again, in milliseconds: its flicker. */
const FLICKER = 55;

/** A strike's own seed, from its key. */
function seedOf(key: string): number {
  let hash = 2166136261;
  for (const letter of key) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Where on its box a strike comes down: the left of it, where a slice's aspect is. */
export function strikePoint(to: Box): Spot {
  return { x: to.x + Math.min(24, to.width / 2), y: to.y + to.height / 2 };
}

/** From 0 to 1 and back, as a strike flares and dies: up over `rise`, held, and down over `fall`, ending at `end`. */
const flare = (t: number, start: number, rise: number, end: number, fall: number) =>
  t < start || t > end ? 0 : Math.min(1, (t - start) / Math.max(rise, 1), (end - t) / Math.max(fall, 1));

/** The crackle round what a strike reached, from `from` for 600 milliseconds, dying as it goes. */
function crackling(strike: Strike, seed: number, t: number, from: number): Light[] {
  const bright = flare(t, from, 30, from + 600, 450);
  if (bright <= 0) return [];
  // More round a bigger box, so a pane's long edges crackle along their length as a slice's short ones do.
  const count = Math.max(4, Math.round((strike.to.width + strike.to.height) / 60));
  return crackleOn(strike.to, seed + Math.floor(t / 45), count).map((points) => ({
    points,
    colour: strike.colour,
    bright: bright * 0.9,
    width: 1.1,
  }));
}

/** How high a strike arches above the straight way, by how far it goes. */
const riseOf = (from: Spot, to: Spot) => Math.max(70, 0.32 * Math.hypot(to.x - from.x, to.y - from.y));

/** One strike `t` milliseconds after it began, in a look; nothing once it is over. */
export function momentOf(look: Look, strike: Strike, t: number): Moment {
  if (t < 0 || t > LIFE) return { lights: [], flashes: [] };
  const seed = seedOf(strike.key);
  const to = strikePoint(strike.to);
  const arc = arcOf(strike.from, to, riseOf(strike.from, to));
  const lights: Light[] = [];
  const flashes: Flash[] = [];
  const flicker = seed + Math.floor(t / FLICKER);
  if (look === 'forked') {
    const bright = flare(t, 0, 20, 800, 260) * (0.7 + 0.3 * Math.abs(Math.sin(t / 37)));
    const bolt = boltAlong(arc, flicker, { detail: 6, rough: 0.075 });
    const grown = grownTo(bolt, Math.min(1, t / REACHES.forked));
    lights.push({ points: grown, colour: strike.colour, bright, width: 2.4 });
    for (const fork of forksOf(bolt, flicker, 4)) {
      if (grown.length === bolt.length)
        lights.push({ points: fork, colour: strike.colour, bright: bright * 0.55, width: 1.3 });
    }
    flashes.push({ at: strike.from, colour: strike.colour, bright: bright * 0.8, reach: 70 });
    lights.push(...crackling(strike, seed, t, REACHES.forked));
  } else if (look === 'leader') {
    const channel = boltAlong(arc, seed, { detail: 6, rough: 0.07 });
    const reached = REACHES.leader;
    if (t < reached) {
      const grown = grownTo(channel, leaderShare(t / reached, 9, seed));
      lights.push({ points: grown, colour: strike.colour, bright: 0.35, width: 1.2 });
      for (const fork of forksOf(grown, seed + Math.floor(t / 70), 3)) {
        lights.push({ points: fork.slice(0, 9), colour: strike.colour, bright: 0.2, width: 0.9 });
      }
    } else {
      const back = Math.max(
        flare(t, reached, 1, reached + 330, 330),
        0.85 * flare(t, reached + 190, 1, reached + 450, 260),
      );
      lights.push({ points: channel, colour: strike.colour, bright: 1.25 * back, width: 2.8 });
      for (const fork of forksOf(channel, seed, 5)) {
        lights.push({ points: fork, colour: strike.colour, bright: 0.5 * back, width: 1.2 });
      }
      flashes.push({ at: strike.from, colour: strike.colour, bright: back, reach: 90 });
      flashes.push({ at: to, colour: strike.colour, bright: back * 0.8, reach: 60 });
    }
    lights.push(...crackling(strike, seed, t, reached));
  } else {
    const bright = flare(t, 0, 140, 900, 300);
    const slow = t / 90;
    const step = Math.floor(slow);
    const part = slow - step;
    for (let thread = 0; thread < 4; thread += 1) {
      const jag = { detail: 5, rough: 0.06, calm: 0.62 };
      const one = wanderOf(seed + thread * 101 + step, jag, arc.length);
      const next = wanderOf(seed + thread * 101 + step + 1, jag, arc.length);
      const offsets = one.map((offset, at) => offset + (next[at]! - offset) * part);
      const grown = grownTo(boltOn(arc, offsets), Math.min(1, t / REACHES.tendrils));
      lights.push({
        points: grown,
        colour: strike.colour,
        bright: bright * (thread === 0 ? 0.95 : 0.55),
        width: thread === 0 ? 1.8 : 1.1,
      });
    }
    flashes.push({ at: strike.from, colour: strike.colour, bright: bright * 0.6, reach: 60 });
    lights.push(...crackling(strike, seed, t, REACHES.tendrils));
  }
  return { lights, flashes };
}
