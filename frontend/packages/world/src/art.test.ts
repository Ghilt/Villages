import { describe, expect, it } from 'vitest';

import { SHADOW, backgroundOf, footOf, keyOut, opaqueBox, packShelves, shadowOf } from './art.ts';
import type { Rgba } from './art.ts';

const PAPER = [252, 252, 249] as const;
const LEAF = [70, 120, 60] as const;

/** A picture of a given size on paper, with whatever `paint` puts at each pixel instead. */
function picture(
  width: number,
  height: number,
  paint: (x: number, y: number) => readonly [number, number, number] | null,
): Rgba {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const colour = paint(x, y) ?? PAPER;
      data.set([...colour, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const pixel = (image: Rgba, x: number, y: number) =>
  [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)] as number[];

describe('taking the background away', () => {
  it('reads the paper colour off the border', () => {
    expect(backgroundOf(picture(20, 20, () => null))).toEqual([...PAPER]);
  });

  it('refuses a border that is not one colour, rather than guessing', () => {
    const striped = picture(20, 20, (x) => (x % 2 === 0 ? LEAF : null));
    expect(() => backgroundOf(striped)).toThrow(/not one colour/);
  });

  it('leaves the paper see-through and the picture solid', () => {
    const { image, background } = keyOut(
      picture(20, 20, (x, y) => (x > 5 && x < 14 && y > 5 && y < 14 ? LEAF : null)),
    );
    expect(background).toEqual([...PAPER]);
    expect(pixel(image, 1, 1)[3]).toBe(0);
    expect(pixel(image, 10, 10)).toEqual([...LEAF, 255]);
  });

  it('keeps a pale patch inside the picture, because only paper that reaches the border goes', () => {
    // A ring of leaf with paper-coloured bark inside it: the bark is not joined to the edge.
    const ringed = picture(20, 20, (x, y) => {
      const inside = x > 3 && x < 16 && y > 3 && y < 16;
      const hole = x > 7 && x < 12 && y > 7 && y < 12;
      return inside && !hole ? LEAF : null;
    });
    const { image } = keyOut(ringed);
    expect(pixel(image, 9, 9)[3]).toBe(255);
    expect(pixel(image, 1, 1)[3]).toBe(0);
  });

  it('takes the paper out of a soft edge, so no pale rim is left on it', () => {
    // Half leaf and half paper, which is what a lossy edge is.
    const mixed = LEAF.map((channel, index) =>
      Math.round((channel + PAPER[index]!) / 2),
    ) as unknown as readonly [number, number, number];
    // A block of leaf whose left column is that half-and-half edge, as a lossy picture leaves it.
    const { image } = keyOut(
      picture(20, 20, (x, y) => (y > 5 && y < 14 && x > 5 && x < 14 ? (x === 6 ? mixed : LEAF) : null)),
    );
    const [r, g, b, a] = pixel(image, 6, 10);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(255);
    // Un-mixed, the colour left is the leaf's and not the halfway colour it arrived as.
    expect(Math.abs(r! - LEAF[0])).toBeLessThan(30);
    expect(Math.abs(g! - LEAF[1])).toBeLessThan(30);
    expect(Math.abs(b! - LEAF[2])).toBeLessThan(30);
  });

  it('leaves a picture that brought its own transparency alone', () => {
    const own = picture(10, 10, () => LEAF);
    own.data[3] = 0;
    own.data[7] = 0;
    expect(keyOut(own).background).toBeNull();
    expect(keyOut(own).image).toBe(own);
  });
});

describe('trimming and the foot', () => {
  it('trims to what shows', () => {
    const { image } = keyOut(
      picture(30, 30, (x, y) => (x >= 10 && x < 20 && y >= 5 && y < 25 ? LEAF : null)),
    );
    expect(opaqueBox(image)).toEqual({ x: 10, y: 5, width: 10, height: 20 });
  });

  it('stands a tree on its trunk, not on the middle of a crown that leans', () => {
    // A crown out to the right over a trunk at x 5.
    const leaning = keyOut(
      picture(48, 48, (x, y) => {
        if (y >= 4 && y < 25 && x >= 5 && x < 38) {
          return LEAF;
        }
        return y >= 25 && y < 40 && x >= 4 && x < 7 ? LEAF : null;
      }),
    ).image;
    const foot = footOf(leaning);
    expect(foot.y).toBe(40);
    expect(foot.x).toBeCloseTo(5.5, 1);
  });
});

describe('packing the atlas', () => {
  it('never lets two frames, or their padding, overlap', () => {
    const sizes = Array.from({ length: 22 }, (_, index) => ({
      width: 40 + ((index * 37) % 90),
      height: 60 + ((index * 53) % 100),
    }));
    const pad = 2;
    const { placed, width, height } = packShelves(sizes, pad, 512);
    for (let a = 0; a < sizes.length; a += 1) {
      const pa = placed[a]!;
      expect(pa.x + sizes[a]!.width + pad).toBeLessThanOrEqual(width);
      expect(pa.y + sizes[a]!.height + pad).toBeLessThanOrEqual(height);
      for (let b = a + 1; b < sizes.length; b += 1) {
        const pb = placed[b]!;
        const apart =
          pa.x + sizes[a]!.width + pad <= pb.x ||
          pb.x + sizes[b]!.width + pad <= pa.x ||
          pa.y + sizes[a]!.height + pad <= pb.y ||
          pb.y + sizes[b]!.height + pad <= pa.y;
        expect(apart, `${a} and ${b}`).toBe(true);
      }
    }
    expect(width).toBeLessThanOrEqual(512);
  });
});

describe("a sprite's shadow, laid on the ground by the one light", () => {
  /** An upright block on nothing, `wide` pixels across and the picture's full height, its foot at x = 100. */
  function block(wide: number, height: number): Rgba {
    const width = 200;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 100 - wide / 2; x < 100 + wide / 2; x += 1) {
        data[(y * width + x) * 4 + 3] = 255;
      }
    }
    return { width, height, data };
  }

  /** One row of a shadow: where it is centred, how widely it spreads, and its darkest pixel. */
  function rowOf(image: Rgba, row: number): { centre: number; spread: number; darkest: number } {
    let weight = 0;
    let sum = 0;
    let squares = 0;
    let darkest = 0;
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(row * image.width + x) * 4 + 3]!;
      weight += alpha;
      sum += alpha * (x + 0.5);
      squares += alpha * (x + 0.5) ** 2;
      darkest = Math.max(darkest, alpha);
    }
    const centre = sum / weight;
    return { centre, spread: Math.sqrt(squares / weight - centre * centre), darkest };
  }

  it('lies to the left of the foot and a little towards the eye, the higher the part the farther', () => {
    // A trunk: thin, so that its pool is small and what is left is the shadow it casts.
    const height = 200;
    const shadow = shadowOf(block(4, height), 100);
    const rows = Math.round(height * SHADOW.flat);
    const slid = (v: number) => SHADOW.lean * ((v + 0.5) / rows) * height;
    // Clear of the pool at the foot - which the softening down the columns carries a few rows out - and
    // of the softening at the far end, every row of it is where the light puts that height of the trunk:
    // to within the lean of half a row, because that softening mixes each row with its neighbours, and
    // the nearer ones, being darker, pull the mix a third of a row towards the foot.
    const halfARow = (SHADOW.lean * height) / rows / 2;
    for (let v = 2 * SHADOW.soft[0] + 2; v < rows - 2 * SHADOW.soft[0]; v += 1) {
      const { centre } = rowOf(shadow.image, shadow.footY + v);
      expect(Math.abs(centre - (shadow.footX - slid(v))), `row ${v}`).toBeLessThan(halfARow);
    }
    // And from end to end it runs left: the higher the part, the farther its shadow.
    for (let v = 2 * SHADOW.soft[0] + 3; v < rows - 2 * SHADOW.soft[0]; v += 1) {
      expect(rowOf(shadow.image, shadow.footY + v).centre).toBeLessThan(
        rowOf(shadow.image, shadow.footY + v - 1).centre,
      );
    }
  });

  it('grows lighter and softer the farther it falls from the foot', () => {
    const height = 200;
    const shadow = shadowOf(block(4, height), 100);
    const rows = Math.round(height * SHADOW.flat);
    const near = rowOf(shadow.image, shadow.footY + 2 * SHADOW.soft[0]);
    const far = rowOf(shadow.image, shadow.footY + rows - 2 * SHADOW.soft[0] - 1);
    expect(far.darkest).toBeLessThan(near.darkest);
    expect(far.spread).toBeGreaterThan(near.spread);
  });

  it('pools darkest right under the foot, a little towards the shadow, and is black', () => {
    // A bush: wide, so the pool under it is broad.
    const shadow = shadowOf(block(60, 100), 100);
    let darkest = 0;
    let at = { x: 0, y: 0 };
    for (let y = 0; y < shadow.image.height; y += 1) {
      for (let x = 0; x < shadow.image.width; x += 1) {
        const alpha = shadow.image.data[(y * shadow.image.width + x) * 4 + 3]!;
        if (alpha > darkest) {
          darkest = alpha;
          at = { x: x + 0.5, y: y + 0.5 };
        }
      }
    }
    expect(darkest).toBeGreaterThanOrEqual(Math.floor(250 * SHADOW.pool.dark));
    // The middle of the pool: the foot, moved `toward` of the pool's half-width to the left.
    const across = (60 / 2) * SHADOW.pool.width;
    expect(Math.abs(at.y - shadow.footY)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(at.x - (shadow.footX - SHADOW.pool.toward * across))).toBeLessThanOrEqual(across * 0.25);
    // A shadow darkens; it never colours.
    for (let i = 0; i < shadow.image.width * shadow.image.height; i += 1) {
      expect(shadow.image.data[i * 4]! + shadow.image.data[i * 4 + 1]! + shadow.image.data[i * 4 + 2]!).toBe(
        0,
      );
    }
  });

  it('is nothing at all for a picture with nothing in it', () => {
    const empty = { width: 40, height: 60, data: new Uint8Array(40 * 60 * 4) };
    const shadow = shadowOf(empty, 20);
    expect(shadow.image.data.some((value) => value !== 0)).toBe(false);
  });
});
