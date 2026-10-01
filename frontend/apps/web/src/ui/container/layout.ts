import type { Sides, UiBorder } from '@villages/world';

import { contentInsetOf, fillInsetOf } from '../border/borderStyle';

/**
 * Where everything in a container goes: the arithmetic from a recipe to the padding its content is set in
 * by, the margin its overhangs are given, and the place of every embellishment. Worked out here so that
 * where a cherub stands is a test rather than a hope. See docs/UI-COMPONENTS.md and decision record 0068.
 */

/** Where on a container an embellishment is pinned: a corner, or the middle of an edge. */
export type Anchor =
  'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left';

export const ANCHORS: readonly Anchor[] = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
];

export type Side = 'top' | 'right' | 'bottom' | 'left';

/**
 * A picture pinned to a container that is not part of its border: a cherub, a cross, a drape. It takes no
 * room from the content. It stands where it is pinned, over the border or out past it, and the room it
 * needs is outside the box: the margin its overhang is given.
 */
export interface Embellishment {
  /** A picture in `world/ui/embellishments/`, by its name. */
  readonly art: string;
  readonly anchor: Anchor;
  /**
   * How far it stands out past the container's outer edge, in pixels as shown: `x` sideways, away from the
   * box, and `y` up or down, away from it. Nothing, and its own corner sits on the container's.
   */
  readonly overhang?: { readonly x?: number; readonly y?: number };
  /** Drawn under the whole container rather than over it, the fill too, like a drape behind a panel. */
  readonly behind?: boolean;
  /** How tall it is drawn, when not at the size its picture is shown. */
  readonly height?: number;
  /** Turned left to right, so one cherub does for both corners. */
  readonly mirrored?: boolean;
}

/** A named combination of a container's layers. */
export interface Recipe {
  /** A picture in `world/ui/borders/`, by its name; nothing, and the container has no border. */
  readonly border?: string;
  /** Draw the border this many times the size its picture is shown: a tooltip's finer than a pane's. */
  readonly scale?: number;
  /** A picture in `world/ui/fills/`, by its name; nothing, and the border's own middle shows, if it has one. */
  readonly fill?: string;
  readonly embellishments?: readonly Embellishment[];
  /** What the content is written in: ink on a light fill, cream on a dark one, which is the default. */
  readonly text?: 'ink' | 'cream';
  /**
   * Whether it has a softer ink as well, for what is said about a thing - a label, an aside - which it
   * does unless it says not. One whose fill is too dark or too light for the softer ink to be read on
   * says false, and whatever would be softer in it is in its main ink: the title plate's parchment.
   */
  readonly soft?: boolean;
  /** Room between the border's inner edge and the content, beyond the border's own inset. */
  readonly padding?: number | Sides;
  /**
   * Whether the container keeps a margin as wide as its overhangs, so nothing beside it runs under a
   * cherub. On unless it is said otherwise, for a container that sits in room of its own that is known to
   * be clear.
   */
  readonly roomForOverhangs?: boolean;
}

export interface Placed {
  readonly embellishment: Embellishment;
  readonly width: number;
  readonly height: number;
  /** Its place in the container, as CSS lengths for `top`, `right`, `bottom`, `left` and `transform`. */
  readonly place: {
    readonly top?: string;
    readonly right?: string;
    readonly bottom?: string;
    readonly left?: string;
    readonly transform?: string;
  };
}

export interface Layout {
  /** The content's padding: the border's cut and inset, and the recipe's padding. */
  readonly padding: Sides;
  /** The container's margin, as wide as its overhangs on each side, or nothing. */
  readonly margin: Sides;
  /** Where its fill stands, in from each edge. */
  readonly fillInset: Sides;
  readonly placed: readonly Placed[];
}

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

/** Four lengths at a scale, to the hundredth of a pixel. */
function times(sides: Sides, by: number): Sides {
  if (by === 1) {
    return sides;
  }
  const scaled = (length: number) => Math.round(length * by * 100) / 100;
  return [scaled(sides[0]), scaled(sides[1]), scaled(sides[2]), scaled(sides[3])];
}

const sidesOf = (value: number | Sides | undefined): Sides =>
  value === undefined ? [0, 0, 0, 0] : typeof value === 'number' ? [value, value, value, value] : value;

/** Which two sides an anchor stands out past: a corner, both of its sides; an edge's middle, the one. */
function sidesOfAnchor(anchor: Anchor): { across: Side | null; along: Side | null } {
  const across: Side | null = anchor.includes('left') ? 'left' : anchor.includes('right') ? 'right' : null;
  const along: Side | null = anchor.startsWith('top') ? 'top' : anchor.startsWith('bottom') ? 'bottom' : null;
  return { across, along };
}

/**
 * Where an embellishment of this size goes: pinned to its anchor, pushed out by its overhang, and centred
 * along the edge when it is pinned to an edge's middle rather than a corner.
 */
export function placeOf(embellishment: Embellishment, width: number, height: number): Placed {
  const { across, along } = sidesOfAnchor(embellishment.anchor);
  const x = embellishment.overhang?.x ?? 0;
  const y = embellishment.overhang?.y ?? 0;
  const place: { top?: string; right?: string; bottom?: string; left?: string; transform?: string } = {};
  const turns: string[] = [];
  if (across === null) {
    place.left = '50%';
    turns.push('translateX(-50%)');
  } else {
    place[across] = `${-x}px`;
  }
  if (along === null) {
    place.top = '50%';
    turns.push('translateY(-50%)');
  } else {
    place[along] = `${-y}px`;
  }
  if (embellishment.mirrored === true) {
    turns.push('scaleX(-1)');
  }
  if (turns.length > 0) {
    place.transform = turns.join(' ');
  }
  return { embellishment, width, height, place };
}

/**
 * A recipe laid out, given the border its file says and the size each embellishment's picture is shown at.
 * An embellishment whose picture is not there is not drawn, and its margin is kept all the same, so the
 * container does not move when the picture arrives.
 */
export function layoutOf(
  recipe: Recipe,
  border: UiBorder | undefined,
  sizeOf: (art: string) => { width: number; height: number } | undefined,
): Layout {
  const scale = recipe.scale ?? 1;
  const inset = times(contentInsetOf(border), scale);
  const padding = sidesOf(recipe.padding);
  const overhang: [number, number, number, number] = [0, 0, 0, 0];
  const placed: Placed[] = [];
  for (const embellishment of recipe.embellishments ?? []) {
    const { across, along } = sidesOfAnchor(embellishment.anchor);
    if (across !== null) {
      const at = SIDES.indexOf(across);
      overhang[at] = Math.max(overhang[at]!, embellishment.overhang?.x ?? 0);
    }
    if (along !== null) {
      const at = SIDES.indexOf(along);
      overhang[at] = Math.max(overhang[at]!, embellishment.overhang?.y ?? 0);
    }
    const size = sizeOf(embellishment.art);
    if (size === undefined) {
      continue;
    }
    const height = embellishment.height ?? size.height;
    const width = Math.round((size.width * height) / size.height);
    placed.push(placeOf(embellishment, width, height));
  }
  const room = recipe.roomForOverhangs ?? true;
  return {
    padding: [inset[0] + padding[0], inset[1] + padding[1], inset[2] + padding[2], inset[3] + padding[3]],
    margin: room ? overhang : [0, 0, 0, 0],
    fillInset: times(fillInsetOf(border), scale),
    placed,
  };
}
