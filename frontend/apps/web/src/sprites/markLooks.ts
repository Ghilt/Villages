import type { Texture } from 'pixi.js';

import type { Textures } from './markTextures';
import type { MapSprite } from './SpriteRenderer';
import type { Form, TwoForms } from './twoForms';

/*
 * What each mark is drawn as. The marks layer is the same for everything on the map - two forms traded at the
 * crossover, a fade in and out, a side of the fog, a click - and this is the part that differs from one kind to the
 * next: the pictures and the sizes. A new kind of thing on the map is a branch here and nothing in the layer. See
 * docs/adr/0051 and docs/plans/structures.md.
 */

/**
 * What each kind of mark but a structure looks like. Every one that becomes a mark does so at `BECOMES_A_MARK_AT`,
 * as tall as it stood there; see `twoForms.ts`.
 *
 * A candidate has no ground form at all. It is a question the world is asking rather than a thing
 * standing in the world, so it is the same size wherever the camera is.
 *
 * A character is a person: a figure three units tall, which is a bust of sixteen pixels where it becomes its mark and
 * 48 pixels at zoom 10 beside a castle's 128. Every person becomes a mark, whoever they serve.
 */
const KINDS: Record<Exclude<MapSprite['kind'], 'structure'>, TwoForms> = {
  candidate: { marked: true, iconHeight: 26 },
  character: { groundHeight: 3, marked: true },
};

/** Where a pennant stands on a structure's pin: the top of its head, so the holder's colours fly over the sign. */
const PIN_TOP = { across: 0.5, down: 0 };

/** How tall a structure stands when the catalogue has not said, as it has not before it is read. */
const UNSAID_HEIGHT = 6;

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
  /** Where it stands on the sign, which is another picture: the top of a structure's pin. */
  iconFlag: { across: number; down: number } | null;
}

/** The least a pennant is drawn, in pixels: smaller, the holder's colours could not be told at the size of a word. */
const PENNANT_LEAST = 11;

/**
 * Where a mark's pennant flies, drawn this tall on the screen and standing at this point, over the form that is
 * showing: from where its picture says, half as tall as the mark and never less than `PENNANT_LEAST`. Null for a look
 * that flies none.
 */
export function pennantOn(
  look: Look,
  tall: number,
  at: { x: number; y: number },
  form: Form = 'ground',
): { x: number; y: number; height: number } | null {
  const picture = form === 'ground' ? look.ground : look.icon;
  const flag = form === 'ground' ? look.flag : look.iconFlag;
  if (flag === null || picture === null || tall <= 0) {
    return null;
  }
  const wide = (tall * picture.width) / picture.height;
  return {
    x: at.x + (flag.across - 0.5) * wide,
    y: at.y - (1 - flag.down) * tall,
    height: Math.max(tall * 0.5, PENNANT_LEAST),
  };
}

export function lookOf(spec: MapSprite, textures: Textures): Look {
  if (spec.kind === 'structure') {
    // Far out a structure your house controls is its type's pin, once the atlas has been read, and until then its own
    // picture at that size. Anyone else's has no mark: it shrinks with the map until it fades.
    const key = spec.structure?.picture ?? '';
    const picture = textures.structures.of(key);
    const mark = textures.structures.markOf(key);
    const groundHeight = spec.structure?.groundHeight ?? UNSAID_HEIGHT;
    const marked = spec.yours === true;
    return {
      forms: { groundHeight, marked },
      ground: picture.texture,
      icon: marked ? (mark ?? picture.texture) : null,
      iconAnchor: 0.5,
      flag: picture.flag,
      iconFlag: mark === null ? picture.flag : PIN_TOP,
    };
  }
  const forms = KINDS[spec.kind];
  const person = spec.kind === 'character';
  return {
    forms,
    ground: forms.groundHeight === undefined ? null : textures.figure,
    icon: !forms.marked ? null : person ? textures.bust : textures.candidate,
    iconAnchor: spec.kind === 'candidate' ? 0 : 0.5,
    flag: null,
    iconFlag: null,
  };
}
