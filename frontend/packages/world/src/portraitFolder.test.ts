import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The rules `world/portraits/` is held to, by reading the folder itself: it is Adam's, he saves pictures
 * into it by hand, and the server picks a character's portrait from whatever is there. A file that breaks
 * a rule here is one the game would mis-read, so this is where it says so rather than a pane showing a
 * stranger's face or none. See `docs/plans/characters-and-key-figures.md`.
 */
const FOLDER = new URL('../../../../world/portraits/', import.meta.url);

/** The first word says whom it suits; the rest is whatever tells the pictures apart. A key's shape. */
const NAMED = /^(woman|man)(-[a-z0-9]+)+\.png$/;

/** The longest key the server keeps, `CharacterDecider.LONGEST_PORTRAIT_KEY`. */
const LONGEST_KEY = 40;

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A PNG's width and height, which are the first eight bytes of the IHDR chunk that always comes first. */
function shapeOf(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

const files = readdirSync(fileURLToPath(FOLDER));

describe("the portraits folder, which is Adam's", () => {
  it('holds only pictures named for whom they suit, in keys the server can keep', () => {
    for (const file of files) {
      expect(file, file).toMatch(NAMED);
      expect(file.replace(/\.png$/, '').length, file).toBeLessThanOrEqual(LONGEST_KEY);
    }
  });

  it('holds a portrait for a woman and one for a man, so either can be given one', () => {
    expect(files.some((file) => file.startsWith('woman-'))).toBe(true);
    expect(files.some((file) => file.startsWith('man-'))).toBe(true);
  });

  it('holds PNGs, upright, three wide by four tall, and at least 768 wide', () => {
    for (const file of files) {
      const bytes = new Uint8Array(readFileSync(new URL(file, FOLDER)));
      expect([...bytes.subarray(0, 8)], file).toEqual(SIGNATURE);
      const { width, height } = shapeOf(bytes);
      // Within a percent of three by four, because a picture drawn by hand is cropped by hand.
      expect(Math.abs(width / height - 0.75), `${file} is ${width} by ${height}`).toBeLessThan(0.0075);
      expect(width, file).toBeGreaterThanOrEqual(768);
    }
  });
});
