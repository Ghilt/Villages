/**
 * The simple shapes the critters' placeholders are drawn from, as SVG, in a frame `CRITTER_DRAWN` square: shared by the
 * first casts' drawings (`critterPlaceholders.ts`) and the rest of them (`critterPlaceholdersWild.ts`).
 */

/** One frame of a kind's strip, the frame's number in it to the SVG drawn there. */
export type CritterFrame = (at: number) => string;

export const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, turn = 0) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${turn} ${cx} ${cy})"/>`;
export const circle = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
export const path = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`;
export const leg = (x1: number, y1: number, x2: number, y2: number, colour: string, width = 5) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colour}" stroke-width="${width}" stroke-linecap="round"/>`;
