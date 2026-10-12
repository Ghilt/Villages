import type { Texture } from 'pixi.js';

import type { Textures } from './markTextures';
import type { MapSprite } from './SpriteRenderer';
import type { TwoForms } from './twoForms';

/*
 * What each mark is drawn as. The marks layer is the same for everything on the map - two forms traded at the
 * crossover, a fade in and out, a side of the fog, a click - and this is the part that differs from one kind to the
 * next: the pictures and the sizes. A new kind of thing on the map is a branch here and nothing in the layer. See
 * docs/adr/0051 and docs/plans/structures.md.
 */

/**
 * What each kind of mark but a structure looks like, in world units on the ground and in screen pixels as a sign.
 *
 * A candidate has no ground form at all. It is a question the world is asking rather than a thing
 * standing in the world, so it is the same size wherever the camera is.
 *
 * A character is a person, smaller than a castle on the ground and as a sign: a figure a unit and a half
 * tall, and a bust of sixteen pixels. They cross over at zoom 9.4, just in from zoom 9 where a key
 * figure's significance first has them drawn, so they arrive as the sign and stand up as the camera comes
 * in; by zoom 10 the figure is 24 pixels beside a castle's 64.
 */
const KINDS: Record<Exclude<MapSprite['kind'], 'structure'>, TwoForms> = {
  candidate: { iconHeight: 26 },
  character: { groundHeight: 1.5, iconHeight: 16 },
};

/**
 * A structure's sign, in screen pixels for each world unit it stands on the ground: one ratio for every one, so that
 * every structure crosses over at zoom 8.46, where a castle of four units is 22 pixels in both forms and by zoom 10
 * stands 64, and one a level higher is larger in both forms. The four units are a map convention and not a
 * measurement: a surveyed castle is about a tenth of a unit here, and would cross over at zoom fourteen, four levels
 * past where the camera stops.
 */
const SIGN_PER_UNIT = 5.5;

/** How tall a structure stands when the catalogue has not said, as it has not before it is read. */
const UNSAID_HEIGHT = 3;

/** What one mark is drawn as: the height of each form, the picture for each, and where a pennant flies from it. */
export interface Look {
  forms: TwoForms;
  /** The thing itself, standing on its ground, or null for a kind that has no ground form. */
  ground: Texture | null;
  /** The sign for it, or null for a kind that is only ever itself. */
  icon: Texture | null;
  /**
   * Where the sign hangs from across its width. The same anchor as the ground form, because the two forms of one
   * thing stand on one point: a crossfade between two shapes hung from different places trades a jump in size for
   * a jump in position, and the eye catches a translation far harder than a scale. A candidate has only the sign,
   * so it keeps its own: the staff's foot is the place, and the pennant flies above it.
   */
  iconAnchor: number;
  /** Where a pennant stands on the picture, as fractions of its width and height, or null for one that flies none. */
  flag: { across: number; down: number } | null;
}

/** The least a pennant is drawn, in pixels: smaller, the holder's colours could not be told at the size of a word. */
const PENNANT_LEAST = 11;

/**
 * Where a mark's pennant flies, drawn this tall on the screen and standing at this point: from where its picture
 * says, half as tall as the mark and never less than `PENNANT_LEAST`. Null for a look that flies none.
 */
export function pennantOn(
  look: Look,
  tall: number,
  at: { x: number; y: number },
): { x: number; y: number; height: number } | null {
  if (look.flag === null || look.ground === null || tall <= 0) {
    return null;
  }
  const wide = (tall * look.ground.width) / look.ground.height;
  return {
    x: at.x + (look.flag.across - 0.5) * wide,
    y: at.y - (1 - look.flag.down) * tall,
    height: Math.max(tall * 0.5, PENNANT_LEAST),
  };
}

export function lookOf(spec: MapSprite, textures: Textures): Look {
  if (spec.kind === 'structure') {
    // Until the type marks are cut (step 13), a structure's sign is its own picture at the size of a word.
    const picture = textures.structures.of(spec.structure?.picture ?? '');
    const groundHeight = spec.structure?.groundHeight ?? UNSAID_HEIGHT;
    return {
      forms: { groundHeight, iconHeight: groundHeight * SIGN_PER_UNIT },
      ground: picture.texture,
      icon: picture.texture,
      iconAnchor: 0.5,
      flag: picture.flag,
    };
  }
  const forms = KINDS[spec.kind];
  const person = spec.kind === 'character';
  return {
    forms,
    ground: forms.groundHeight === undefined ? null : textures.figure,
    icon: forms.iconHeight === undefined ? null : person ? textures.bust : textures.candidate,
    iconAnchor: spec.kind === 'candidate' ? 0 : 0.5,
    flag: null,
  };
}
