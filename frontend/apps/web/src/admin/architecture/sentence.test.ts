import { describe, expect, it } from 'vitest';

import { WORLD_CACHE } from './cache';
import { SENTENCE_MOST, sentenceOf } from './sentence';
import { ARTIFACTS, CLUSTERS, GROUPS, PIECES, TOOLS } from './world';

/**
 * Adam's word of 2026-10-16: with so many boxes on the diagram, each says what it is in one sentence, and the rest
 * waits for a click on it. So every card's text opens with a sentence short enough to read on the card.
 */
describe("the architecture page's cards", () => {
  it('each say what they are in one short sentence, and keep the rest for when they are chosen', () => {
    const said = [
      ...ARTIFACTS.map((a) => [`file ${a.id}`, a.what] as const),
      ...TOOLS.map((t) => [`tool ${t.script}`, t.what] as const),
      ...PIECES.map((p) => [`piece ${p.id}`, p.what] as const),
      ...GROUPS.map((g) => [`group ${g.id}`, g.what] as const),
      ...CLUSTERS.map((c) => [`cluster ${c.id}`, c.what] as const),
      ['the world cache', WORLD_CACHE.what] as const,
    ];
    const long = said
      .map(([card, what]) => [card, sentenceOf(what).length] as const)
      .filter(([, length]) => length > SENTENCE_MOST);
    expect(long).toEqual([]);
  });

  it('take the first sentence whole, and not one cut short at a number or a script', () => {
    expect(sentenceOf('The clouds from zoom 7 out, gone by 4.5. Drawn over the fog.')).toBe(
      'The clouds from zoom 7 out, gone by 4.5.',
    );
    expect(sentenceOf('It runs first. world:ready fills it. And more.')).toBe(
      'It runs first. world:ready fills it.',
    );
    expect(sentenceOf('Shaded by its slope. (Decision record 0090.)')).toBe('Shaded by its slope.');
    expect(sentenceOf('One sentence and nothing after.')).toBe('One sentence and nothing after.');
  });
});
