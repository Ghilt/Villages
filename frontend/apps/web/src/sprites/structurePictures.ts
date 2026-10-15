import { Graphics, Rectangle, Texture } from 'pixi.js';
import type { TextureSource } from 'pixi.js';

import {
  DRAWN_CULTURES,
  DRAWN_TYPES,
  INK,
  RUIN_PICTURE,
  pictureFor,
  markKey,
  pictureKey,
  styled,
} from '@villages/world';
import type { Picture, StructureAtlasFile } from '@villages/world';

/** Rasterises a shape on the canvas it will be drawn on, as `markTextures.ts` does every mark. */
type Rasterise = (shape: Graphics) => Texture;

/*
 * The placeholder picture of every type of structure, rasterised for the map from the shapes in `structureShapes.ts`:
 * one a type and a culture, in its own colours, until the pictures painted for each come (step 13 of
 * docs/plans/structures.md).
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

/**
 * Every type's picture in every culture, and the ruin's, by `pictureKey`: `mill@islamic`. A type nobody has drawn
 * is the plain house in its culture; a name with no culture is drawn European.
 */
export interface StructurePictures {
  of(key: string): StructurePicture;
  /**
   * The mark of the picture asked for by `pictureKey`, the same in every culture: what the map draws far out. Null
   * until the atlas is read, and the structure's own picture stands for its mark until then.
   */
  markOf(key: string): Texture | null;
  /** The pictures cut into an atlas by `world:structures`, drawn in place of the ones drawn in code from now on. */
  paint(file: StructureAtlasFile, source: TextureSource): void;
}

export function buildStructurePictures(rasterise: Rasterise): StructurePictures {
  const drawn = new Map<string, StructurePicture>();
  for (const culture of DRAWN_CULTURES) {
    for (const type of DRAWN_TYPES) {
      drawn.set(pictureKey(type, culture), draw(styled(pictureFor(type, false), culture), rasterise));
    }
    drawn.set(pictureKey(RUIN_PICTURE, culture), draw(styled(pictureFor('', true), culture), rasterise));
    drawn.set(pictureKey('', culture), draw(styled(pictureFor('', false), culture), rasterise));
  }
  // What the atlas has, by the same keys: a picture painted, or the placeholder drawn from the same shapes.
  const painted = new Map<string, StructurePicture>();
  return {
    of: (key) => {
      const [picture = '', culture = 'european'] = key.split('@');
      const asked = `${picture}@${culture}`;
      return painted.get(asked) ?? drawn.get(asked) ?? drawn.get(`@${culture}`) ?? drawn.get('@european')!;
    },
    markOf: (key) => painted.get(markKey(key.split('@')[0] ?? ''))?.texture ?? null,
    paint: (file, source) => {
      for (const one of painted.values()) one.texture.destroy();
      painted.clear();
      for (const [key, frame] of Object.entries(file.frames)) {
        painted.set(key, {
          texture: new Texture({ source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) }),
          flag: { across: frame.flagX, down: frame.flagY },
        });
      }
    },
  };
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
