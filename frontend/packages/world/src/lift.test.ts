import { describe, expect, it } from 'vitest';

import { backgroundOf } from './art.ts';
import type { Rgba } from './art.ts';
import { findPlinth, liftOffPlinth } from './lift.ts';

/** The paper every diorama here is drawn on. */
const PAPER: [number, number, number] = [228, 229, 224];

/** A little deterministic noise, so that nothing depends on colours being exactly flat. */
const grain = (x: number, y: number): number => ((((x * 73856093) ^ (y * 19349663)) >>> 0) % 5) - 2;

interface Diorama {
  image: Rgba;
  /** Where the things in it are, to look at afterwards. */
  trunk: { left: number; right: number; top: number; bottom: number };
}

/**
 * A diorama the way an image model draws one, at a little under half the size: a plinth of turf with soil
 * down its two sides, seen from a corner, on paper with a soft shadow beside it, and a tree standing on
 * it - a crown over a trunk, the crown with a gap of paper in it, and litter strewn at the trunk's foot.
 */
function diorama(options: { paleTrunk?: boolean } = {}): Diorama {
  const width = 520;
  const height = 520;
  const data = new Uint8Array(width * height * 4);
  const bottom = { x: 260, y: 470 };
  const half = 150;
  const rise = 0.58;
  const sides = 34;
  const sideBottom = bottom.y - rise * half;
  const front = { x: bottom.x, y: bottom.y - sides };
  const topY = sideBottom - sides;
  const backY = topY - (front.y - topY);
  const trunk = options.paleTrunk
    ? { left: 250, right: 270, top: 200, bottom: 400 }
    : { left: 250, right: 270, top: 290, bottom: 400 };
  const crown = options.paleTrunk ? { x: 260, y: 150, r: 55 } : { x: 260, y: 230, r: 60 };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const n = grain(x, y);
      // The paper, and the shadow on it left of the plinth: soft, colourless and a little blue.
      const shade = Math.exp(-(((x - 70) / 70) ** 2) - ((y - 400) / 40) ** 2);
      let colour: number[] = [PAPER[0] - 62 * shade, PAPER[1] - 56 * shade, PAPER[2] - 50 * shade];

      const across = Math.abs(x - bottom.x);
      const insideTop = across <= half && y >= backY + rise * across && y <= front.y - rise * across;
      const onSide = across <= half && y > front.y - rise * across && y <= bottom.y - rise * across;
      if (insideTop) {
        // Turf, and the tree's own shadow on it, to the left of the trunk - as dark as the shaded side
        // face below it, which is why the plinth's bright rim along its front edge is what is looked for.
        const inShade = Math.max(0, Math.min(1, (trunk.left - x) / 40)) * (y < trunk.bottom + 20 ? 1 : 0);
        colour = [175 - 80 * inShade, 197 - 72 * inShade, 120 - 40 * inShade];
        if (y > front.y - rise * across - 3) colour = x < bottom.x ? [134, 165, 97] : [185, 205, 130];
      } else if (onSide) {
        const soil = y > bottom.y - rise * across - sides / 2;
        const left = x < bottom.x;
        colour = soil ? (left ? [88, 70, 58] : [164, 129, 97]) : left ? [95, 122, 78] : [165, 186, 117];
      }
      // Litter at the trunk's foot, on the turf either side of it and touching it, along the ground.
      if (insideTop && (x - 244) ** 2 + (y - 394) ** 2 < 36) colour = [190, 150, 105];
      if (insideTop && (x - 276) ** 2 + (y - 392) ** 2 < 36) colour = [186, 146, 102];
      // The tree: the trunk, then the crown over it, with a gap of paper seen through the crown.
      if (x >= trunk.left && x < trunk.right && y >= trunk.top && y < trunk.bottom) {
        colour = options.paleTrunk ? [212, 213, 203] : [110, 72, 48];
      }
      if ((x - crown.x) ** 2 + (y - crown.y) ** 2 < crown.r ** 2) {
        colour = (x + y) % 9 < 4 ? [58, 98, 60] : [72, 112, 70];
        if (x >= crown.x - 5 && x < crown.x + 5 && y >= crown.y - 25 && y < crown.y - 15) colour = PAPER;
      }
      const at = (y * width + x) * 4;
      data[at] = Math.max(0, Math.min(255, Math.round(colour[0]! + n)));
      data[at + 1] = Math.max(0, Math.min(255, Math.round(colour[1]! + n)));
      data[at + 2] = Math.max(0, Math.min(255, Math.round(colour[2]! + n)));
      data[at + 3] = 255;
    }
  }
  return { image: { width, height, data }, trunk };
}

const alphaAt = (image: Rgba, x: number, y: number): number => image.data[(y * image.width + x) * 4 + 3]!;

/** Of the pixels in a box, how many are at least half opaque. */
function shareOpaque(image: Rgba, left: number, top: number, right: number, bottom: number): number {
  let opaque = 0;
  let all = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      all += 1;
      if (alphaAt(image, x, y) >= 128) opaque += 1;
    }
  }
  return opaque / all;
}

describe('lifting a thing off its diorama plinth', () => {
  it('finds the plinth by its soil: its corner, its slope, its width and the height of its sides', () => {
    const plinth = findPlinth(diorama().image)!;
    expect(plinth).not.toBeNull();
    expect(plinth.bottom.x).toBeCloseTo(260, -1);
    expect(plinth.bottom.y).toBeCloseTo(470, -1);
    expect(plinth.rise).toBeCloseTo(0.58, 1);
    expect(plinth.halfWidth).toBeCloseTo(150, -1);
    expect(Math.abs(plinth.sides - 34)).toBeLessThan(4);
  });

  it('finds no plinth in a picture that stands on nothing, so that it is keyed as before', () => {
    const width = 200;
    const height = 200;
    const data = new Uint8Array(width * height * 4);
    for (let at = 0; at < width * height; at += 1) {
      const x = at % width;
      const y = (at - x) / width;
      const tree = (x - 100) ** 2 + (y - 90) ** 2 < 50 ** 2 || (x > 94 && x < 106 && y > 90 && y < 180);
      data.set(tree ? [60, 110, 55, 255] : [...PAPER, 255], at * 4);
    }
    expect(findPlinth({ width, height, data })).toBeNull();
  });

  it('keeps the tree and takes the turf, the soil, the paper and the shadow away', () => {
    const { image, trunk } = diorama();
    const lifted = liftOffPlinth(image, findPlinth(image)!, backgroundOf(image)).image;
    // The crown, and the trunk: which is inside the plinth and a colour nothing above it shows, and is
    // kept because it hangs straight down from the crown.
    expect(shareOpaque(lifted, 230, 200, 290, 260)).toBeGreaterThan(0.95);
    expect(
      shareOpaque(lifted, trunk.left + 2, trunk.top + 10, trunk.right - 2, trunk.bottom - 4),
    ).toBeGreaterThan(0.95);
    // The turf in front of it, in the sun and in the tree's shadow, and both side faces.
    expect(shareOpaque(lifted, 300, 400, 380, 420)).toBe(0);
    expect(shareOpaque(lifted, 160, 350, 230, 380)).toBe(0);
    expect(shareOpaque(lifted, 130, 380, 250, 440)).toBe(0);
    expect(shareOpaque(lifted, 270, 400, 400, 460)).toBe(0);
    // The shadow on the paper, and the paper.
    expect(shareOpaque(lifted, 20, 380, 100, 420)).toBe(0);
    expect(shareOpaque(lifted, 0, 0, 520, 60)).toBe(0);
  });

  it('takes the paper seen through a gap in the crown, which the fill from the border never reaches', () => {
    const { image } = diorama();
    const lifted = liftOffPlinth(image, findPlinth(image)!, backgroundOf(image)).image;
    expect(shareOpaque(lifted, 256, 208, 264, 214)).toBe(0);
  });

  it('leaves the litter strewn beside the trunk, which touches it only along the ground', () => {
    const { image } = diorama();
    const lifted = liftOffPlinth(image, findPlinth(image)!, backgroundOf(image)).image;
    expect(shareOpaque(lifted, 239, 390, 248, 398)).toBe(0);
    expect(shareOpaque(lifted, 272, 388, 281, 396)).toBe(0);
  });

  it('keeps a pale trunk standing against the paper, the colour of birch bark', () => {
    const { image, trunk } = diorama({ paleTrunk: true });
    const lifted = liftOffPlinth(image, findPlinth(image)!, backgroundOf(image)).image;
    // Above the plinth, where the paper is beside it, and inside it, down to its foot.
    expect(shareOpaque(lifted, trunk.left + 2, 210, trunk.right - 2, 255)).toBeGreaterThan(0.95);
    expect(shareOpaque(lifted, trunk.left + 2, 280, trunk.right - 2, trunk.bottom - 4)).toBeGreaterThan(0.95);
  });
});
