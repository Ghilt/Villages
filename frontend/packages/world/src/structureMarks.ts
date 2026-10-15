import { PICTURE_BOX, RUIN_PICTURE, hexOf, pictureFor, pictureParts } from './structureLooks.ts';

/*
 * The mark of each type of structure: what the map draws far out, where a structure stops shrinking and becomes a sign
 * for itself, at the size of a word. A pin whose foot is the structure's place, with the type's shape in it in outline,
 * one a type and the ruin's, in no culture's look because a mark says what a thing is and not where. A file a mark in
 * `world/sprites/marks/structures/`, named `<type>.png` and `ruin.png`, which `world:structures` cuts into the atlas
 * beside the structures' pictures, keyed `mark:castle`. Placeholders drawn here until Adam paints over them.
 */

/** The pin's colour, the deep plum of the moodboard's map pins. */
export const PIN = 0x3b2a3d;
/** The face the shape stands on inside the pin. */
export const PIN_FACE = 0xf4ece0;

/** The name the map asks for a type's mark by, or the ruin's. */
export function markKey(picture: string): string {
  return `mark:${picture}`;
}

/** The file a type's mark, or the ruin's, is saved as. */
export function structureMarkFile(picture: string): string {
  return `${picture === RUIN_PICTURE ? 'ruin' : picture}.png`;
}

/** The name the map asks for the mark in a file by, or null for a file that is not one. */
export function keyOfStructureMarkFile(file: string): string | null {
  const match = /^([a-z][a-zA-Z]*)\.png$/.exec(file);
  if (match === null) return null;
  return markKey(match[1] === 'ruin' ? RUIN_PICTURE : match[1]!);
}

/**
 * A type's mark as an SVG document `size` pixels tall: a pin standing on its point, a round face in its head, and the
 * type's shape on the face, every part of it the face's colour under an outline of the pin's, as a map's legend draws
 * a building. Laid out in a box a hundred wide and a hundred and thirty tall.
 */
export function structureMarkSvg(picture: string, size: number): string {
  const shape = pictureFor(picture, picture === RUIN_PICTURE);
  const pin = 'M50 128 C40 106 4 84 4 48 A46 46 0 0 1 96 48 C96 84 60 106 50 128 Z';
  const parts = pictureParts(shape, { fill: PIN_FACE, stroke: PIN, width: 5 });
  const width = Math.round((size * 100) / 130);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 130" width="${width}" height="${size}">` +
    `<path d="${pin}" fill="${hexOf(PIN)}" stroke="${hexOf(PIN_FACE)}" stroke-width="2.5"/>` +
    `<circle cx="50" cy="48" r="40" fill="${hexOf(PIN_FACE)}"/>` +
    `<svg x="10" y="10" width="80" height="80" viewBox="${PICTURE_BOX}">${parts}</svg>` +
    `</svg>`
  );
}
