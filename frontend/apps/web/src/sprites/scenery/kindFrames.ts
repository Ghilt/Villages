import { Rectangle, Texture } from 'pixi.js';
import type { ImageSource } from 'pixi.js';

import type { ArtAtlasFile, Kind } from '@villages/world';

/** Each kind's picture and shadow, and where its foot stands in each, as the scenery draws them. */
export interface KindFrames {
  frames: Texture[];
  /** Where each kind stands in its own frame, as a fraction of it, and its tint: how it bends in the wind. */
  feet: { x: number; y: number; tint: number }[];
  /** Each kind's shadow, and where the kind's foot falls in it. Empty for an atlas cut without them. */
  shadowFrames: Texture[];
  shadowFeet: { x: number; y: number }[];
  /** The kinds the atlas has no picture for. */
  missing: string[];
}

/**
 * A frame and a foot for each of the sprite map's kinds, in its order, and their shadows when the atlas was cut with
 * them. A kind the atlas has no frame for - one added to world/biomes.json since the art was last cut - is drawn as
 * the first frame and named in `missing`, which is visibly wrong rather than silently missing.
 */
export function kindFrames(
  kinds: readonly Kind[],
  file: ArtAtlasFile,
  source: ImageSource,
  tintOf: (kind: string) => number,
): KindFrames {
  const missing: string[] = [];
  const cut = kinds.map((kind) => {
    const own = file.frames[kind.name];
    if (own === undefined) {
      missing.push(kind.name);
    }
    const frame = own ?? Object.values(file.frames)[0];
    if (frame === undefined) {
      return { texture: Texture.EMPTY, foot: { x: 0.5, y: 1, tint: tintOf(kind.name) } };
    }
    return {
      texture: new Texture({ source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) }),
      foot: { x: frame.footX / frame.width, y: frame.footY / frame.height, tint: tintOf(kind.name) },
    };
  });
  const shadows = file.shadows;
  const shade = shadows === undefined ? [] : kinds.map((kind) => shadows[kind.name]);
  const shaded = shade.length > 0 && shade.every((frame) => frame !== undefined);
  return {
    frames: cut.map((one) => one.texture),
    feet: cut.map((one) => one.foot),
    shadowFrames: shaded
      ? shade.map(
          (frame) =>
            new Texture({ source, frame: new Rectangle(frame!.x, frame!.y, frame!.width, frame!.height) }),
        )
      : [],
    shadowFeet: shaded
      ? shade.map((frame) => ({ x: frame!.footX / frame!.width, y: frame!.footY / frame!.height }))
      : [],
    missing,
  };
}
