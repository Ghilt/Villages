import type { Container, Sprite } from 'pixi.js';

import { pennantOn } from './markLooks';
import { formForHit } from './twoForms';
import type { Look } from './markLooks';
import type { DrawnSprite, MapSprite } from './SpriteRenderer';
import type { Form } from './twoForms';

/*
 * One mark of the marks layer: the sprites it is drawn with, where its trade and its fade have got to, and what is
 * done to it alone. The layer walks them; see `MarksLayer.ts`.
 */

export interface Entry {
  spec: MapSprite;
  /** Its pictures and its sizes, from its kind and, for a structure, its type and level. See `markLooks.ts`. */
  look: Look;
  /** The thing itself, standing on its ground. Null for a kind that has no ground form. */
  ground: Sprite | null;
  /** The sign for it. Null for a kind that is only ever itself. */
  icon: Sprite | null;
  /** The pennant its holder flies over it, on the side of the fog its ground form is; null for none. */
  pennant: Sprite | null;
  /** Which form the camera says this should be showing. Changes at the crossover, not gradually. */
  showing: Form;
  /** Where the trade between them has got to: nought the icon, one the ground form. */
  blend: number;
  /**
   * How much of this mark is here at all: nought gone, one arrived.
   *
   * Apart from the blend, because they answer different questions and can run at once: a house may
   * arrive at a zoom that also wants it to change form. Multiplied together at the end.
   */
  presence: number;
  /** No longer among the marks to draw. It fades out and is let go of when it reaches nothing. */
  leaving: boolean;
  /**
   * Whether it stands in vision, which puts its ground form over the fog rather than under it. Worked out
   * when the mark or the house's vision changes, never a frame. See `fogLayering.ts`.
   */
  inVision: boolean;
}

/**
 * Draws one form at the height and the alpha the rule asked for.
 *
 * The scale is taken against the texture's own height rather than against the size the shape was
 * laid out in, because `generateTexture` crops to what was actually drawn: the castle is laid out in
 * 160 pixels and its ink covers about 132 of them. Dividing by the layout made a height of 45 pixels
 * come out as 37, which would have made "four world units" a polite fiction and the crossover land
 * somewhere other than where the arithmetic says.
 */
export function show(sprite: Sprite | null, height: number, alpha: number): void {
  if (sprite === null) {
    return;
  }
  if (alpha <= 0) {
    sprite.visible = false;
    return;
  }
  sprite.visible = true;
  sprite.alpha = alpha;
  sprite.scale.set(height / sprite.texture.height);
}

/** Hides every sprite of a mark, as it is off the screen or faded out. */
export function hide(entry: Entry): void {
  for (const sprite of [entry.ground, entry.icon, entry.pennant]) {
    if (sprite !== null) {
      sprite.visible = false;
    }
  }
}

/** Lets go of every sprite of a mark that has gone. */
export function letGo(entry: Entry): void {
  entry.ground?.destroy();
  entry.icon?.destroy();
  entry.pennant?.destroy();
}

/**
 * Flies a mark's pennant over it as tall as it is drawn, `tall`, standing at `at`, as `pennantOn` says, from the form
 * that is more of the two.
 */
export function flyPennant(entry: Entry, tall: number, at: { x: number; y: number }): void {
  if (entry.pennant === null) {
    return;
  }
  const flies = pennantOn(entry.look, tall, at, formForHit(entry.blend));
  entry.pennant.visible = flies !== null;
  if (flies !== null) {
    entry.pennant.alpha = entry.presence;
    entry.pennant.scale.set(flies.height / entry.pennant.texture.height);
    entry.pennant.position.set(flies.x, flies.y);
  }
}

/** Where a mark actually ended up, for the development probe. */
export function drawnOf(entry: Entry, overIt: Container): DrawnSprite {
  const onGround = entry.ground?.visible === true;
  const asIcon = entry.icon?.visible === true;
  const above = onGround ? entry.ground : entry.icon;
  return {
    x: above?.x ?? 0,
    y: above?.y ?? 0,
    visible: onGround || asIcon,
    form: onGround && asIcon ? 'both' : onGround ? 'ground' : asIcon ? 'icon' : 'none',
    height: above === null || above === undefined ? 0 : above.height,
    presence: entry.presence,
    groundOverTheFog: entry.ground !== null && entry.ground.parent === overIt,
    ...(entry.pennant === null ? {} : { pennant: entry.pennant.visible }),
  };
}
