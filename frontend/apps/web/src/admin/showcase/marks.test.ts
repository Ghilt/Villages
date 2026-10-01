import { describe, expect, it } from 'vitest';

/**
 * The library's marks that the game already draws are the game's drawings, stroke for stroke.
 *
 * The library cannot import the game, so it keeps its own copy of the number marks, the close and the
 * eye, and a copy is a drawing that can drift: a player who has learnt the house card's cross would find
 * another on a card built from the library. Read as text, both sides, until the game draws its marks from
 * the library and there is one copy again. This lives with the page rather than the library because only
 * the page may look at the game's files.
 */
const LIBRARY = import.meta.glob<string>('../../ui/mark/Mark.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const GAME = import.meta.glob<string>(
  ['../../marks/Mark.tsx', '../../stage/Icons.tsx', '../../house/HouseBar.tsx'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);

const library = Object.values(LIBRARY).join('\n');
const game = Object.values(GAME).join('\n');

/** Every path a source spells out as a quoted string of its own: the number marks and the eye. */
const quotedPaths = (source: string): string[] =>
  [...source.matchAll(/'(M[\d .,A-Za-z-]+)'/g)].map((match) => match[1]!);

describe("the library's marks", () => {
  it('has marks to hold to the rule', () => {
    expect(quotedPaths(library).length).toBeGreaterThan(20);
  });

  it('draws the number marks and the eye exactly as the game does', () => {
    const strays = quotedPaths(library).filter((path) => !game.includes(path));
    expect(strays).toEqual([]);
  });

  it('draws the close exactly as the game does', () => {
    const close = 'M7 7 L17 17 M17 7 L7 17';
    expect(library).toContain(close);
    expect(game).toContain(close);
  });
});
