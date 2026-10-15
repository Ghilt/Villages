import { pixelsPerWorldUnit } from '../geometry/cameraMath';

/**
 * The two ways the map has of showing a thing, and which of them is drawn at a given zoom.
 *
 * A thing on the map has up to two forms. Its **ground form** is what the thing is, given a height in
 * world units, so it grows with the terrain and holds its size against the ground at every zoom. Its
 * **icon** is what the thing means, given a height in screen pixels, the same size whatever the camera
 * is doing. Close in you see the thing; far out you see the sign for it. See decision record 0051.
 *
 * Pure, so the decisions can be tested without a renderer. It replaced a scheme of hard zoom thresholds
 * on 2026-09-20, which stepped a house from a 7 pixel dot centred on its place to a 22 pixel castle
 * standing on its place in one frame - a threefold jump in size and eleven pixels of jump in position.
 */

/** What a thing looks like, in the two ways there are of showing it. Either may be absent. */
export interface TwoForms {
  /** Its height on the ground, in world units. Absent for a thing that is only ever a sign. */
  groundHeight?: number;
  /**
   * Whether it becomes a mark, its icon, from `BECOMES_A_MARK_AT` out. A thing with none stays itself, shrinking with
   * the map until it fades.
   */
  marked: boolean;
  /** Its icon's height in pixels, for a thing with no ground form to take one from: a candidate. */
  iconHeight?: number;
}

export type Form = 'ground' | 'icon';

/**
 * How long the two forms take to trade places, once the camera has decided they should.
 *
 * **The trade is in time, not in zoom.** It was in zoom first, fading across a band either side of the
 * crossover, and that was wrong for a reason that only shows up when you stop: a zoom is somewhere you
 * can rest, so resting inside the band left two half-drawn castles on the screen indefinitely. A
 * transition wants to be something that finishes. The zoom now decides *which* form, and this decides
 * how long it takes to get there, so every place the camera can stop shows exactly one form.
 */
export const CROSSFADE_MS = 220;

/**
 * How far past the crossover the camera must go before the forms trade.
 *
 * Without it a camera resting on the crossover starts a fresh trade on every jitter of the wheel.
 */
export const CROSSOVER_STICK = 0.08;

/**
 * How long a thing takes to arrive, or to go.
 *
 * Shorter than the trade between forms, because arriving is a smaller event than changing into
 * something else and a mark that takes as long to appear as to transform reads as slow. Nothing on
 * the map pops: a house the gateway has just sent fades up, one that has gone fades out and is only
 * then let go of, and a mark crossing the distance floor does the same.
 */
export const PRESENCE_MS = 140;

/**
 * The longest step a single frame may take a change by, however long it really was since the last one.
 *
 * The overlay draws when the map draws, and a still map draws nothing, so the gap since the last frame
 * is often seconds rather than milliseconds - and a house arriving on a still map would be handed the
 * whole of its fade in one step and pop, which is the very thing the fade is for. Anything longer than
 * a few frames is treated as a few frames, so a change that begins after a pause still animates.
 *
 * The cost is that a tab coming back from the background takes a handful of frames to settle instead of
 * one. That is the better of the two: it looks like arriving rather than like a jump.
 */
export const LONGEST_STEP_MS = 50;

/**
 * Below this a thing is not drawn at all, whatever it is, whatever size it would be and however significant: everything
 * on the map fades in and out here together, a quarter of a level inside the zoom the server starts sending it at,
 * `ON_THE_MAP_FROM`, so it has arrived before it is wanted.
 *
 * This is about distance, not about size, and it is deliberately not part of the trade: a continent covered in marks
 * says nothing, and aggregates rather than marks are what low zoom wants. See decision records 0038 and 0096.
 */
export const DRAWN_FROM_ZOOM = 7.25;

/** How tall each form is on the screen right now. A form a thing has not got is nought. */
export interface Sizes {
  ground: number;
  icon: number;
}

/** How much of each form to draw. The two always sum to one. */
export interface Alphas {
  ground: number;
  icon: number;
}

/**
 * Where everything that becomes a mark becomes it: one zoom for every kind of thing, so the map turns from the world
 * into its marks at once. Further in, every sprite stands in scale with the map, a building growing and shrinking
 * with the ground under it; from here out, a thing that has a mark is its mark, the size of a word, and a thing that
 * has none goes on shrinking with the map until everything fades at `DRAWN_FROM_ZOOM`.
 *
 * Chosen, not worked out: it is where a castle of eight units is 44 pixels, which reads as a word. A mark is as tall
 * as its thing was here, so the trade changes the drawing and never the size. See decision record 0051.
 */
export const BECOMES_A_MARK_AT = 8.46;

/**
 * How tall a thing's icon is on the screen, in pixels, or null for a thing that has none: as tall as its ground form
 * stands at `BECOMES_A_MARK_AT`, or what it says itself when it has no ground form to measure.
 */
export function iconHeightOf(forms: TwoForms): number | null {
  if (forms.groundHeight === undefined) {
    return forms.iconHeight ?? null;
  }
  return forms.marked ? forms.groundHeight * pixelsPerWorldUnit(BECOMES_A_MARK_AT) : null;
}

/** The zoom a thing trades its two forms at, `BECOMES_A_MARK_AT`, or null when it has not got both. */
export function crossoverZoom(forms: TwoForms): number | null {
  return forms.groundHeight !== undefined && forms.groundHeight > 0 && forms.marked
    ? BECOMES_A_MARK_AT
    : null;
}

/**
 * How tall each form would be drawn at this zoom.
 *
 * The ground form is measured in world units and so doubles with every zoom level, exactly as the
 * terrain under it does. The icon is measured in screen pixels and does not move at all.
 */
export function sizesAt(zoom: number, forms: TwoForms): Sizes {
  return {
    ground: forms.groundHeight === undefined ? 0 : forms.groundHeight * pixelsPerWorldUnit(zoom),
    icon: iconHeightOf(forms) ?? 0,
  };
}

/**
 * Which form the camera says should be showing, given which one is showing now.
 *
 * A hard decision with a little stickiness, rather than a blend: where the camera can rest, one form is
 * drawn and the other is not. What makes the change bearable to watch is that it takes time, not that
 * it is spread over a range of zooms.
 */
export function wantedForm(zoom: number, forms: TwoForms, showing: Form): Form {
  const at = crossoverZoom(forms);
  if (at === null) {
    return forms.groundHeight === undefined ? 'icon' : 'ground';
  }
  return showing === 'icon'
    ? zoom >= at + CROSSOVER_STICK
      ? 'ground'
      : 'icon'
    : zoom < at - CROSSOVER_STICK
      ? 'icon'
      : 'ground';
}

/**
 * Moves something part-way done on by however long the last frame took.
 *
 * Used for both of the things that change over time here: the trade between the two forms, and a
 * thing arriving or going. It lands exactly on the target rather than overshooting; the caller is the
 * one that keeps a frame from being too long a step, with `LONGEST_STEP_MS`.
 */
export function easeTowards(
  value: number,
  target: number,
  elapsedMs: number,
  overMs: number = CROSSFADE_MS,
): number {
  const step = Math.max(0, elapsedMs) / overMs;
  return target > value ? Math.min(target, value + step) : Math.max(target, value - step);
}

/** Whether something is part-way done, and so whether another frame is owed to it. */
export function midTrade(value: number): boolean {
  return value > 0 && value < 1;
}

/**
 * How much of each form to draw, part-way through a trade.
 *
 * Eased at both ends, so the change does not start or stop abruptly, and summing to one throughout, so
 * the mark never dims or doubles in the middle of itself.
 */
export function alphasFor(blend: number): Alphas {
  const t = Math.min(1, Math.max(0, blend));
  const ground = t * t * (3 - 2 * t);
  return { ground, icon: 1 - ground };
}

/** What one mark in particular may be spared, on top of what the camera says about all of them. */
export interface MarkContext {
  /** This window is showing everything, so no mark is hidden for distance. */
  everything?: boolean;
  /**
   * This mark is spared the distance floor: a candidate, because it is what the player is being asked
   * about, or one of the player's own holdings while the eye is open. Never anyone else's.
   */
  spared?: boolean;
}

/**
 * Whether a thing is drawn at this zoom at all.
 *
 * Kept apart from the sizes because being far away and being small are different questions, and 0038
 * leans on the difference: a spared mark is drawn where the rest are nothing, and is **no larger** for
 * being spared, because the eye is about distance and not about size.
 */
export function isDrawn(zoom: number, of: MarkContext = {}): boolean {
  return zoom >= DRAWN_FROM_ZOOM || of.everything === true || of.spared === true;
}

/**
 * Which form answers a click.
 *
 * Whichever one is showing, which mid-trade is whichever is more of the two. There is no ambiguity to
 * resolve at rest, because at rest there is only ever one.
 */
export function formForHit(blend: number): Form {
  return blend >= 0.5 ? 'ground' : 'icon';
}
