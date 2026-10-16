import { crop, opaqueBox } from './art.ts';
import type { Box, Rgba } from './art.ts';

/*
 * The critters' pictures as files and as an atlas. A kind is one picture in `world/sprites/critters/`, its frames side
 * by side from left to right, each as wide as the picture over how many frames `world/critters.json` gives it, which
 * `world:critters` cuts into an atlas of its own, keyed `songbird/0`, `songbird/1`. Every frame of a kind is cut to
 * the same box, the smallest that holds all of them, so a critter does not jump about from one frame to the next: its
 * frames register. Placeholders are drawn from simple shapes until Adam paints over them. See
 * docs/plans/living-world.md.
 */

/** One kind of critter as `world/critters.json` lists it: its name, and how many frames its picture holds. */
export interface CritterKind {
  name: string;
  frames: number;
}

/** `world/critters.json`. */
export interface CritterFile {
  kinds: CritterKind[];
}

/** One frame in the atlas: where it is, how big, whether it is still a placeholder, and the file it came from. */
export interface CritterFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  placeholder: boolean;
  source: string;
}

/** One kind in the atlas: its frames in order, and where it stands in each, in its frames' own pixels. */
export interface CritterCut {
  frames: string[];
  footX: number;
  footY: number;
  placeholder: boolean;
  source: string;
}

/** `critters.json` beside the atlas. */
export interface CritterAtlasFile {
  /** A hash of the atlas's bytes, so a page asks again for a picture cut again. */
  version: string;
  cutAt: string;
  width: number;
  height: number;
  frames: Record<string, CritterFrame>;
  kinds: Record<string, CritterCut>;
}

/** What a frame of a kind is called in the atlas. */
export function critterFrameKey(kind: string, frame: number): string {
  return `${kind}/${frame}`;
}

/** The kinds a critters file lists, or what is wrong with it: a name twice, or a kind with no frames. */
export function critterKindsOf(file: CritterFile): CritterKind[] {
  const seen = new Set<string>();
  for (const kind of file.kinds) {
    if (!/^[a-z][a-z-]*$/.test(kind.name)) {
      throw new Error(`a critter's name is lower-case letters and dashes, not "${kind.name}"`);
    }
    if (seen.has(kind.name)) {
      throw new Error(`world/critters.json names ${kind.name} twice`);
    }
    if (!Number.isInteger(kind.frames) || kind.frames < 1) {
      throw new Error(`${kind.name} has ${kind.frames} frames; a picture holds one or more`);
    }
    seen.add(kind.name);
  }
  return file.kinds;
}

/**
 * A strip cut into its frames, side by side and as nearly as wide as each other as whole pixels allow. A picture too
 * narrow to hold its frames is an error, since it can only have been painted with fewer.
 */
export function framesOf(strip: Rgba, count: number): Rgba[] {
  if (strip.width < count) {
    throw new Error(`a picture ${strip.width} pixels wide cannot hold ${count} frames`);
  }
  return Array.from({ length: count }, (_, at) => {
    const from = Math.round((at * strip.width) / count);
    const to = Math.round(((at + 1) * strip.width) / count);
    return crop(strip, { x: from, y: 0, width: to - from, height: strip.height });
  });
}

/** The smallest box that holds what is drawn in every one of the frames, in a frame's own pixels; null for none. */
export function commonBox(frames: readonly Rgba[]): Box | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const frame of frames) {
    const box = opaqueBox(frame);
    if (box === null) continue;
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.width);
    bottom = Math.max(bottom, box.y + box.height);
  }
  if (right === -Infinity) return null;
  // Every frame is cut to the same width, the narrowest of them, so the box fits each one.
  const narrowest = Math.min(...frames.map((frame) => frame.width));
  return { x: left, y: top, width: Math.min(right, narrowest) - left, height: bottom - top };
}
