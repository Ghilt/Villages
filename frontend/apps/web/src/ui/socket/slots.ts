/**
 * What a socket shows and how a slot's row of them is worked out, with no browser: a slot's places filled from the
 * start, an empty frame for each place left, a `?` in every place of a slot the viewer is not told about, and past
 * the most a row has room for, the last socket saying how many more there are. See docs/UI-COMPONENTS.md.
 */

/** What one socket shows: nothing yet, a person, a thing with how many of it, something not known, or more of them. */
export type SocketContent =
  | { readonly kind: 'empty' }
  | { readonly kind: 'portrait'; readonly picture: string; readonly name: string }
  | { readonly kind: 'item'; readonly name: string; readonly picture?: string; readonly amount?: number }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'more'; readonly count: number };

/** The most sockets a row draws before its last one says how many more. */
export const SLOT_MOST = 6;

const EMPTY: SocketContent = { kind: 'empty' };
const UNKNOWN: SocketContent = { kind: 'unknown' };

/**
 * The sockets a slot's row draws: what fills it, then an empty one for each place left; a slot the viewer is not
 * told about is a `?` in every place. Past `most`, the last socket drawn says how many are not.
 */
export function socketsOf(
  contents: readonly SocketContent[],
  places: number,
  { secret = false, most = SLOT_MOST }: { secret?: boolean; most?: number } = {},
): SocketContent[] {
  const every = secret
    ? Array.from({ length: places }, () => UNKNOWN)
    : [...contents, ...Array.from({ length: Math.max(0, places - contents.length) }, () => EMPTY)];
  if (every.length <= most) {
    return every;
  }
  const shown = every.slice(0, Math.max(0, most - 1));
  return [...shown, { kind: 'more', count: every.length - shown.length }];
}

/** How full a slot is, as its row says it: `2 of 4`; `? of 4` when the viewer is not told. */
export function fullnessSaid(filled: number, places: number, secret = false): string {
  return `${secret ? '?' : filled} of ${places}`;
}

/** What a socket is, in words, for a screen reader and a tooltip. */
export function socketSaid(content: SocketContent): string {
  switch (content.kind) {
    case 'empty':
      return 'an empty place';
    case 'portrait':
      return content.name;
    case 'item':
      return content.amount === undefined
        ? content.name
        : `${content.name}, ${content.amount.toLocaleString()}`;
    case 'unknown':
      return 'not known';
    case 'more':
      return `${content.count} more`;
  }
}
