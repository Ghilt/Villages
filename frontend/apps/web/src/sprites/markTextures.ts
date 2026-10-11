import { Graphics } from 'pixi.js';
import type { Texture } from 'pixi.js';

import { buildStructurePictures, drawPennant } from './structurePictures';
import type { StructurePictures } from './structurePictures';

/*
 * The pictures every mark is drawn with: the castle and its sign, the pennant, the figure and its sign, and the
 * selection ring, each drawn once in white so that a tint colours it, and rasterised once. The marks layer's. A
 * structure's pictures are drawn in their own colours, in `structurePictures.ts`, and its holder's pennant in white.
 */

/**
 * What each shape is laid out in. Every one is drawn far larger than it is ever shown and scaled
 * down, so that coming close finds detail rather than a smear.
 *
 * These are not the sizes the textures come out at: `generateTexture` crops to the ink. What a sprite
 * is scaled against is its own texture's height, in `show`.
 */
export const TEXTURE = {
  castleHeight: 160,
  castleWidth: 150,
  markHeight: 64,
  markWidth: 48,
  candidateHeight: 64,
  candidateWidth: 44,
  figureHeight: 160,
  figureWidth: 80,
  bustHeight: 64,
  bustWidth: 60,
  ringDiameter: 128,
} as const;

export interface Textures {
  castle: Texture;
  mark: Texture;
  candidate: Texture;
  figure: Texture;
  bust: Texture;
  ring: Texture;
  /** Every type of structure's picture, and a plain house for a type with none. */
  structures: StructurePictures;
  /** The pennant a held structure flies, tinted its holder's field. */
  pennant: Texture;
}

/**
 * One shape, rasterised once, with the smaller copies of itself that a downscale needs.
 *
 * Every shape here is drawn far larger than it is shown, and without mipmaps that samples about one
 * texel in twenty. The outline then sparkles whenever the sprite lands on a different fraction of a
 * pixel, which is every frame the map moves, and on a display at 125 or 150 per cent it never lands
 * on a whole one at all. The levels are built once, here.
 */
export type Rasterise = (shape: Graphics) => Texture;

/** Draws every shape a mark needs, rasterised by the canvas it will be drawn on. */
export function buildMarkTextures(rasterise: Rasterise): Textures {
  const { castleWidth: w, castleHeight: h } = TEXTURE;

  // The ground form: a castle, two towers with a battlemented wall between them, drawn in white so
  // that a tint can colour it per house. One outline, because a tinted sprite with seams shows them.
  // Everything is a fraction of the texture, so the drawing survives being given a different size.
  const tower = w * 0.267;
  const towerTop = h * 0.3;
  const wallTop = h * 0.56;
  const crenel = h * 0.094;
  const gap = w * 0.089;
  const castle = new Graphics()
    .moveTo(3, h - 3)
    .lineTo(3, towerTop)
    .lineTo(3 + tower / 3, towerTop)
    .lineTo(3 + tower / 3, towerTop - crenel)
    .lineTo(3 + (tower * 2) / 3, towerTop - crenel)
    .lineTo(3 + (tower * 2) / 3, towerTop)
    .lineTo(3 + tower, towerTop)
    .lineTo(3 + tower, wallTop)
    .lineTo(w / 2 - gap, wallTop)
    .lineTo(w / 2 - gap, wallTop - crenel)
    .lineTo(w / 2 + gap, wallTop - crenel)
    .lineTo(w / 2 + gap, wallTop)
    .lineTo(w - 3 - tower, wallTop)
    .lineTo(w - 3 - tower, towerTop)
    .lineTo(w - 3 - (tower * 2) / 3, towerTop)
    .lineTo(w - 3 - (tower * 2) / 3, towerTop - crenel)
    .lineTo(w - 3 - tower / 3, towerTop - crenel)
    .lineTo(w - 3 - tower / 3, towerTop)
    .lineTo(w - 3, towerTop)
    .lineTo(w - 3, h - 3)
    .closePath()
    .fill(0xffffff)
    .stroke({ width: 6, color: 0x4a4034, alpha: 0.85 });

  // The icon: the same castle said in three strokes. The detailed one is unreadable at 22 pixels -
  // its crenellations come to two pixels and its outline eats the fill - so the sign is a keep with
  // three merlons and nothing else. What it has to do is read as a castle at the size of a word.
  const { markWidth: mw, markHeight: mh } = TEXTURE;
  const top = mh * 0.16;
  const shoulder = mh * 0.34;
  const mark = new Graphics()
    .moveTo(4, mh - 3)
    .lineTo(4, top)
    .lineTo(mw * 0.3, top)
    .lineTo(mw * 0.3, shoulder)
    .lineTo(mw * 0.42, shoulder)
    .lineTo(mw * 0.42, top)
    .lineTo(mw * 0.58, top)
    .lineTo(mw * 0.58, shoulder)
    .lineTo(mw * 0.7, shoulder)
    .lineTo(mw * 0.7, top)
    .lineTo(mw - 4, top)
    .lineTo(mw - 4, mh - 3)
    .closePath()
    .fill(0xffffff)
    .stroke({ width: 5, color: 0x4a4034, alpha: 0.9 });

  // A pennant on a staff: a place the world is offering, rather than a house that stands there.
  const { candidateWidth: cw, candidateHeight: ch } = TEXTURE;
  const candidate = new Graphics()
    .moveTo(4, 2)
    .lineTo(cw - 2, 12)
    .lineTo(4, 22)
    .closePath()
    .fill(0xffffff)
    .rect(0, 0, 5, ch)
    .fill(0xffffff)
    .stroke({ width: 3, color: 0x4a4034, alpha: 0.85 });

  // A person standing on their place: a head over a cloak that widens to the hem, drawn in white so
  // a tint gives them the colours of the house they serve. The ground form, so it is what they are.
  const { figureWidth: fw, figureHeight: fh } = TEXTURE;
  const head = fw * 0.2;
  const figure = new Graphics()
    .moveTo(fw / 2 - fw * 0.14, head * 2.55)
    .lineTo(fw * 0.2, head * 3.5)
    .lineTo(4, fh - 3)
    .lineTo(fw - 4, fh - 3)
    .lineTo(fw * 0.8, head * 3.5)
    .lineTo(fw / 2 + fw * 0.14, head * 2.55)
    .closePath()
    .fill(0xffffff)
    .stroke({ width: 5, color: 0x4a4034, alpha: 0.85 })
    .circle(fw / 2, head + 4, head)
    .fill(0xffffff)
    .stroke({ width: 5, color: 0x4a4034, alpha: 0.85 });

  // The sign for a person: a head and shoulders, the key figures' own mark, said at the size of a word.
  const { bustWidth: bw, bustHeight: bh } = TEXTURE;
  const bust = new Graphics()
    .moveTo(3, bh - 3)
    .bezierCurveTo(3, bh * 0.62, bw * 0.24, bh * 0.52, bw / 2, bh * 0.52)
    .bezierCurveTo(bw * 0.76, bh * 0.52, bw - 3, bh * 0.62, bw - 3, bh - 3)
    .closePath()
    .fill(0xffffff)
    .stroke({ width: 5, color: 0x4a4034, alpha: 0.9 })
    .circle(bw / 2, bh * 0.28, bh * 0.2)
    .fill(0xffffff)
    .stroke({ width: 5, color: 0x4a4034, alpha: 0.9 });

  // What marks the selected house: a ring on the ground under it rather than a change to the mark
  // itself, so that what is selected is still drawn as what it is.
  const r = TEXTURE.ringDiameter;
  const ringOf = new Graphics()
    .ellipse(r / 2, r / 2, r / 2 - 4, r / 4 - 4)
    .stroke({ width: 6, color: 0xffffff, alpha: 1 });

  const built = {
    castle: rasterise(castle),
    mark: rasterise(mark),
    candidate: rasterise(candidate),
    figure: rasterise(figure),
    bust: rasterise(bust),
    ring: rasterise(ringOf),
    structures: buildStructurePictures(rasterise),
    pennant: drawPennant(rasterise),
  };
  castle.destroy();
  mark.destroy();
  candidate.destroy();
  figure.destroy();
  bust.destroy();
  ringOf.destroy();
  return built;
}
