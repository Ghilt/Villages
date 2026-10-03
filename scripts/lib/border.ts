/**
 * What a border is to the program: a picture, `world/ui/borders/<name>.webp`, and the file of cuts beside
 * it. This is a copy of the program's own description, `BorderFile` in
 * `frontend/packages/world/src/uiArt.ts`, because nothing here imports the program; the program's folder test
 * reads every border these tools write, so a file that has drifted from it fails there.
 */

/** A picture as four bytes a pixel, straight (not premultiplied) alpha. */
export interface Rgba {
  width: number;
  height: number;
  data: Uint8Array;
}

export const REPEATS = ['stretch', 'repeat', 'round', 'space'] as const;
export type Repeat = (typeof REPEATS)[number];

/** Four lengths, one a side, in the order CSS says them: top, right, bottom, left. */
export type Sides = readonly [number, number, number, number];

/** What the `<name>.json` beside a border says, every length in the picture's own pixels. */
export interface BorderFile {
  /** Where the four cuts are, each measured in from its own edge: top, right, bottom, left. */
  readonly slice: Sides;
  /** How the edges between the corners are laid along the box: one for both, or across and then down. */
  readonly repeat?: Repeat | readonly [Repeat, Repeat];
  /** How much further in than the cuts the content starts. */
  readonly inset?: Sides;
  /** Where the content starts, measured in from each edge of the box rather than from the cuts. */
  readonly content?: Sides;
  /** How far the border stands out past the box it frames. */
  readonly outset?: Sides;
  /** Whether the picture's own middle is drawn inside the border, rather than left for a fill. */
  readonly middle?: boolean;
  /** How far under the border a fill reaches, so no gap shows between an uneven inner edge and the fill. */
  readonly fillUnder?: Sides;
}
