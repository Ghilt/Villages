/**
 * A recipe, `<name>.recipe.json`: how a picture was made into a border, written by the tool beside the
 * border so that it can be made again the same way, and read when it is.
 */

import { REPEATS } from '../border.ts';
import type { Repeat, Sides } from '../border.ts';
import type { Background } from './frame.ts';
import type { Span } from './tiles.ts';

/** What a recipe says: how a picture is made into a border. */
export interface NineSliceRecipe {
  /** The picture it is made from, as Adam gave it: a path from the folder the recipe is in. */
  readonly picture: string;
  /** How the frame is told from what it stands on. */
  readonly background: Background;
  /** Where the tiles are, when the lines between them should not be found by themselves. */
  readonly columns?: readonly [Span, Span, Span];
  readonly rows?: readonly [Span, Span, Span];
  /** How the edges are laid between the corners: `round` unless it says otherwise. */
  readonly repeat: Repeat;
  /** A fill to make of the middle tile, by name; left out, the middle is dropped for a fill of another's. */
  readonly fill?: string;
  /** Whether the picture's own middle is kept as the border's middle, rather than dropped. */
  readonly middle?: boolean;
  /**
   * Where the words start, in from each edge of the joined picture, in its own pixels; left out, it is
   * worked out, past the edges and clear of the corners' ornaments.
   */
  readonly content?: Sides;
}

const isSpan = (value: unknown): value is Span =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((one) => Number.isInteger(one) && (one as number) >= 0) &&
  (value[0] as number) <= (value[1] as number);

const threeSpans = (value: unknown): value is readonly [Span, Span, Span] =>
  Array.isArray(value) && value.length === 3 && value.every(isSpan);

/** Reads a recipe, refusing anything it would have to guess at, with a message saying what to write. */
export function readNineSliceRecipe(text: string, where: string): NineSliceRecipe {
  let given: Record<string, unknown>;
  try {
    given = JSON.parse(text) as Record<string, unknown>;
  } catch (cause) {
    throw new Error(`${where} is not JSON: ${(cause as Error).message}`, { cause });
  }
  const known = new Set(['picture', 'background', 'columns', 'rows', 'repeat', 'fill', 'middle', 'content']);
  const stray = Object.keys(given).filter((key) => !known.has(key));
  if (stray.length > 0) {
    throw new Error(
      `${where}: ${stray.join(', ')} is not something a recipe says; it says ${[...known].join(', ')}`,
    );
  }
  if (typeof given.picture !== 'string' || given.picture === '') {
    throw new Error(`${where} says no picture: the file in world/ui/sources/ the border is made from`);
  }
  const background = given.background;
  const warmth = (background as { warmth?: unknown } | null)?.warmth;
  const named = background === 'alpha' || background === 'none' || background === 'checker';
  if (!named && !(typeof warmth === 'number' && warmth > 0 && warmth < 255)) {
    throw new Error(
      `${where}: background is "alpha", for a picture clear round its frame, "none", for one that stands on ` +
        'nothing, "checker", for one on painted checks, or { "warmth": 30 }, for a gilt frame on anything cooler',
    );
  }
  if (given.middle !== undefined && typeof given.middle !== 'boolean') {
    throw new Error(`${where}: middle is true, to keep the picture's own middle, or false`);
  }
  if (given.middle === true && given.fill !== undefined) {
    throw new Error(`${where}: the middle is kept or made a fill, not both`);
  }
  for (const key of ['columns', 'rows'] as const) {
    if (given[key] !== undefined && !threeSpans(given[key])) {
      throw new Error(`${where}: ${key} is three spans, [first, last] each, both counted`);
    }
  }
  const repeat = given.repeat ?? 'round';
  if (!(REPEATS as readonly unknown[]).includes(repeat)) {
    throw new Error(`${where}: repeat is one of ${REPEATS.join(', ')}`);
  }
  if (
    given.fill !== undefined &&
    (typeof given.fill !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(given.fill))
  ) {
    throw new Error(`${where}: fill is a name, lowercase words joined by hyphens, like dark-felt`);
  }
  return {
    picture: given.picture,
    background: named ? (background as 'alpha' | 'none' | 'checker') : { warmth: warmth as number },
    ...(given.columns === undefined ? {} : { columns: given.columns as [Span, Span, Span] }),
    ...(given.rows === undefined ? {} : { rows: given.rows as [Span, Span, Span] }),
    repeat: repeat as Repeat,
    ...(given.fill === undefined ? {} : { fill: given.fill as string }),
    ...(given.middle === true ? { middle: true } : {}),
    ...(given.content === undefined ? {} : { content: contentGiven(given.content, where) }),
  };
}

/** Where a recipe says the words start: one length for every side, or four. */
function contentGiven(value: unknown, where: string): Sides {
  const length = (one: unknown) => Number.isInteger(one) && (one as number) >= 0;
  if (length(value)) {
    return [value as number, value as number, value as number, value as number];
  }
  if (Array.isArray(value) && value.length === 4 && value.every(length)) {
    return [value[0] as number, value[1] as number, value[2] as number, value[3] as number];
  }
  throw new Error(
    `${where}: content is one length or four - top, right, bottom, left - in the picture's own pixels`,
  );
}

/** A recipe as it is written: its keys in the order they are read, each list of spans on one line. */
export function recipeText(recipe: NineSliceRecipe): string {
  const ordered = {
    picture: recipe.picture,
    background: recipe.background,
    ...(recipe.columns === undefined ? {} : { columns: recipe.columns }),
    ...(recipe.rows === undefined ? {} : { rows: recipe.rows }),
    repeat: recipe.repeat,
    ...(recipe.middle === true ? { middle: true } : {}),
    ...(recipe.fill === undefined ? {} : { fill: recipe.fill }),
    ...(recipe.content === undefined ? {} : { content: recipe.content }),
  };
  const oneLine = (_: string, inside: string) => `[${inside.replace(/\s+/g, ' ')}]`;
  const text = JSON.stringify(ordered, null, 2)
    .replace(/\[\s+([^[\]]*?)\s+\]/g, oneLine)
    .replace(/\[\s+(\[[^\]]*\](?:,\s+\[[^\]]*\])*)\s+\]/g, oneLine);
  return `${text}\n`;
}
