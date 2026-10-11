import { Graphics } from 'pixi.js';
import type { Texture } from 'pixi.js';

import { DRAWN_TYPES, INK, pictureOf } from './structureShapes';
import type { Picture } from './structureShapes';

/** Rasterises a shape on the canvas it will be drawn on, as `markTextures.ts` does every mark. */
type Rasterise = (shape: Graphics) => Texture;

/*
 * The placeholder picture of every type of structure, rasterised for the map from the shapes in `structureShapes.ts`:
 * one a type, in its own colours, until the sprites cut from the moodboard come (step 13 of docs/plans/structures.md).
 */

/** Laid out this many pixels to the box's unit: a hundred-unit box is drawn 160 tall, as the castle is. */
const LAYOUT = 1.6;

/** A picture rasterised, and where on it the pennant stands, as fractions of its width from the left and its height from the top. */
export interface StructurePicture {
  texture: Texture;
  flag: { across: number; down: number };
}

function draw(picture: Picture, rasterise: Rasterise): StructurePicture {
  const shape = new Graphics();
  const ink = { width: 3.2, color: INK, alpha: 0.9 };
  for (const part of picture.parts) {
    if (part[0] === 'rect') {
      const [, x, y, w, h, colour] = part;
      shape
        .rect(x * LAYOUT, y * LAYOUT, w * LAYOUT, h * LAYOUT)
        .fill(colour)
        .stroke(ink);
    } else if (part[0] === 'poly') {
      shape
        .poly(part[1].map((value) => value * LAYOUT))
        .fill(part[2])
        .stroke(ink);
    } else {
      const [, x, y, r, colour] = part;
      shape
        .circle(x * LAYOUT, y * LAYOUT, r * LAYOUT)
        .fill(colour)
        .stroke(ink);
    }
  }
  // The texture is cropped to the ink, so where the pennant stands is said against what was drawn, not the box.
  const box = shape.getLocalBounds();
  const [x, y] = picture.flag;
  const flag = {
    across: (x * LAYOUT - box.minX) / (box.maxX - box.minX),
    down: (y * LAYOUT - box.minY) / (box.maxY - box.minY),
  };
  const texture = rasterise(shape);
  shape.destroy();
  return { texture, flag };
}

/** Every type's picture, by the catalogue's name for it, and the plain house for any other. */
export interface StructurePictures {
  of(type: string): StructurePicture;
}

export function buildStructurePictures(rasterise: Rasterise): StructurePictures {
  const drawn = new Map(DRAWN_TYPES.map((type) => [type, draw(pictureOf(type), rasterise)]));
  const any = draw(pictureOf(''), rasterise);
  return { of: (type) => drawn.get(type) ?? any };
}

/**
 * The pennant over a held structure: a swallow-tailed flag on a staff, drawn in white so that a tint gives it the
 * holder's colours, its staff's foot at the bottom left. Laid out 64 tall.
 */
export function drawPennant(rasterise: Rasterise): Texture {
  const shape = new Graphics()
    .poly([4, 3, 46, 11, 34, 17, 46, 23, 4, 31])
    .fill(0xffffff)
    .stroke({ width: 3, color: INK, alpha: 0.9 })
    .rect(0, 0, 5, 64)
    .fill(INK);
  const texture = rasterise(shape);
  shape.destroy();
  return texture;
}
