/**
 * What a card says of itself: the first sentence of what it is, and no more. The rest is shown when the card is
 * chosen, so the diagram stays a picture that can be read at a glance rather than a wall of words.
 */

/** The most a card's sentence may run to, in characters: four lines of a file's card, three of a piece's. */
export const SENTENCE_MOST = 110;

/**
 * The first sentence of a text: up to the first full stop, question mark or exclamation mark that ends it, the one
 * followed by a space and a capital or an opening bracket, or by the end. A full stop inside a number or a name, as
 * in `4.5` or `world:ready`, ends nothing.
 */
export function sentenceOf(text: string): string {
  const found = /^.*?[.!?](?=\s+[A-Z(]|$)/s.exec(text);
  return found === null ? text : found[0];
}
