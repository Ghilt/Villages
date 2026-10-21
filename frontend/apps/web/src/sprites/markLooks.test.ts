import { describe, expect, it } from 'vitest';
import type { Texture } from 'pixi.js';

import { lookOf, pennantOn } from './markLooks';
import type { Textures } from './markTextures';
import type { MapSprite } from './SpriteRenderer';
import { BECOMES_A_MARK_AT, crossoverZoom, iconHeightOf } from './twoForms';

/** A picture as the renderer would have cut it, by its size alone, which is all a look reads of one. */
const picture = (width: number, height: number) => ({ width, height }) as Texture;

const MILL = picture(120, 160);
const PIN = picture(100, 130);
/** The mill's shadow as the cutter lays it, its foot towards its right, where the light comes from. */
const MILL_SHADOW = { texture: picture(190, 90), foot: { x: 0.65, y: 0.7 } };
const TEXTURES = {
  candidate: picture(44, 64),
  figure: picture(80, 160),
  bust: picture(60, 64),
  pennant: picture(49, 64),
  structures: {
    of: (type: string) => ({
      texture: MILL,
      flag: { across: type === 'mill' ? 0.5 : 0.25, down: 0 },
      foot: type === 'mill' ? 0.6 : 0.5,
      shadow: type === 'mill' ? MILL_SHADOW : null,
    }),
    markOf: (type: string) => (type === 'castle' ? PIN : null),
    paint: () => {},
  },
} satisfies Textures;

/** A structure of the player's house, which becomes a mark, unless it is said to be someone else's. */
const structure = (groundHeight?: number, yours = true): MapSprite => ({
  id: 'structure:a',
  at: { lng: 18.07, lat: 59.33 },
  tint: 0xffffff,
  kind: 'structure',
  structure: { picture: 'mill', ...(groundHeight === undefined ? {} : { groundHeight }) },
  ...(yours ? { yours } : {}),
});

describe("a structure's look", () => {
  it('stands as tall as it was told, and becomes its mark where everything does, whatever its height', () => {
    const castle = lookOf(structure(8), TEXTURES);
    const mill = lookOf(structure(4.8), TEXTURES);
    const higher = lookOf(structure(6), TEXTURES);

    expect(mill.forms.groundHeight).toBe(4.8);
    expect(crossoverZoom(castle.forms)).toBe(BECOMES_A_MARK_AT);
    expect(crossoverZoom(mill.forms)).toBe(BECOMES_A_MARK_AT);
    expect(iconHeightOf(higher.forms)!).toBeGreaterThan(iconHeightOf(mill.forms)!);
  });

  it("has no mark when it is someone else's: far out it is not drawn at all", () => {
    const theirs = lookOf(structure(8, false), TEXTURES);

    expect(theirs.icon).toBeNull();
    expect(iconHeightOf(theirs.forms)).toBeNull();
    expect(crossoverZoom(theirs.forms)).toBe(BECOMES_A_MARK_AT);
  });

  it('stands at a height of its own until the catalogue has said one', () => {
    expect(lookOf(structure(), TEXTURES).forms.groundHeight).toBe(6);
  });

  it('is its type picture in both forms, and flies a pennant where the picture says', () => {
    const look = lookOf(structure(2.4), TEXTURES);

    expect(look.ground).toBe(MILL);
    expect(look.icon).toBe(MILL);
    expect(look.flag).toEqual({ across: 0.5, down: 0 });
  });

  it('hangs from its foot, and its pennant flies where the picture says measured from there', () => {
    const look = lookOf(structure(2.4), TEXTURES);

    expect(look.groundAnchor).toBe(0.6);
    // Drawn 160 tall the mill is 120 wide; its staff stands in its middle, a tenth of that left of its foot.
    expect(pennantOn(look, 160, { x: 200, y: 300 })).toEqual({ x: 188, y: 140, height: 80 });
  });

  it("is its type's pin far out once the marks are cut, and its pennant flies from the top of the pin", () => {
    const castle = lookOf({ ...structure(8), structure: { picture: 'castle', groundHeight: 8 } }, TEXTURES);
    expect(castle.ground).toBe(MILL);
    expect(castle.icon).toBe(PIN);
    // A pin drawn 130 tall is 100 wide, and its pennant stands on its head, over the place.
    expect(pennantOn(castle, 130, { x: 200, y: 300 }, 'icon')).toEqual({ x: 200, y: 170, height: 65 });
  });

  it('flies no pennant on anything that is not a structure', () => {
    expect(lookOf({ ...structure(), kind: 'character' }, TEXTURES).flag).toBeNull();
  });

  it('casts the shadow cut for its picture, and nothing casts one that has none cut', () => {
    expect(lookOf(structure(2.4), TEXTURES).shadow).toBe(MILL_SHADOW);
    expect(lookOf({ ...structure(8), structure: { picture: 'castle' } }, TEXTURES).shadow).toBeNull();
    expect(lookOf({ ...structure(), kind: 'character' }, TEXTURES).shadow).toBeNull();
  });
});

describe("a person's look", () => {
  const person = (yours: boolean): MapSprite => ({
    id: 'character:a',
    at: { lng: 18.07, lat: 59.33 },
    tint: 0xffffff,
    kind: 'character',
    ...(yours ? { yours } : {}),
  });

  it("is their bust far out when they are your house's, and becomes it where everything does", () => {
    const ours = lookOf(person(true), TEXTURES);

    expect(ours.icon).toBe(TEXTURES.bust);
    expect(crossoverZoom(ours.forms)).toBe(BECOMES_A_MARK_AT);
  });

  it("has no mark when they are anyone else's: far out they are not drawn at all", () => {
    const theirs = lookOf(person(false), TEXTURES);

    expect(theirs.icon).toBeNull();
    expect(iconHeightOf(theirs.forms)).toBeNull();
  });
});

describe('where a pennant flies', () => {
  const look = lookOf(structure(2.4), TEXTURES);

  it('from the point the picture names, half as tall as the mark', () => {
    // A mill drawn 80 tall is 60 wide; its flag stands at the middle of its top, a tenth of that left of its foot.
    expect(pennantOn(look, 80, { x: 200, y: 300 })).toEqual({ x: 194, y: 220, height: 40 });

    const offCentre = lookOf(
      { ...structure(2.4), structure: { picture: 'castle', groundHeight: 4 } },
      TEXTURES,
    );
    expect(pennantOn(offCentre, 80, { x: 200, y: 300 })?.x).toBe(185);
  });

  it('never smaller than a word, or the holder could not be told at the size of a sign', () => {
    expect(pennantOn(look, 12, { x: 0, y: 0 })?.height).toBe(11);
  });

  it('nowhere for a look that flies none, or a mark not drawn', () => {
    expect(pennantOn(lookOf({ ...structure(), kind: 'character' }, TEXTURES), 80, { x: 0, y: 0 })).toBeNull();
    expect(pennantOn(look, 0, { x: 0, y: 0 })).toBeNull();
  });
});
