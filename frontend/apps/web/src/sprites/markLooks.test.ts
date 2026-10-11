import { describe, expect, it } from 'vitest';
import type { Texture } from 'pixi.js';

import { lookOf, pennantOn } from './markLooks';
import type { Textures } from './markTextures';
import type { MapSprite } from './SpriteRenderer';
import { crossoverZoom } from './twoForms';

/** A picture as the renderer would have cut it, by its size alone, which is all a look reads of one. */
const picture = (width: number, height: number) => ({ width, height }) as Texture;

const MILL = picture(120, 160);
const TEXTURES = {
  castle: picture(150, 132),
  mark: picture(48, 64),
  candidate: picture(44, 64),
  figure: picture(80, 160),
  bust: picture(60, 64),
  ring: picture(128, 64),
  pennant: picture(49, 64),
  structures: {
    of: (type: string) => ({ texture: MILL, flag: { across: type === 'mill' ? 0.5 : 0.25, down: 0 } }),
    paint: () => {},
  },
} satisfies Textures;

const structure = (groundHeight?: number): MapSprite => ({
  id: 'structure:a',
  at: { lng: 18.07, lat: 59.33 },
  tint: 0xffffff,
  kind: 'structure',
  structure: { picture: 'mill', ...(groundHeight === undefined ? {} : { groundHeight }) },
});

describe("a structure's look", () => {
  it('stands as tall as it was told, and crosses over where a house does, whatever its height', () => {
    const house = lookOf({ ...structure(), id: 'h', kind: 'house' }, TEXTURES);
    const mill = lookOf(structure(2.4), TEXTURES);
    const higher = lookOf(structure(3), TEXTURES);

    expect(mill.forms.groundHeight).toBe(2.4);
    expect(crossoverZoom(mill.forms)).toBeCloseTo(crossoverZoom(house.forms)!, 6);
    expect(crossoverZoom(higher.forms)).toBeCloseTo(crossoverZoom(house.forms)!, 6);
    expect(higher.forms.iconHeight).toBeGreaterThan(mill.forms.iconHeight!);
  });

  it('stands at a height of its own until the catalogue has said one', () => {
    expect(lookOf(structure(), TEXTURES).forms.groundHeight).toBe(3);
  });

  it('is its type picture in both forms, and flies a pennant where the picture says', () => {
    const look = lookOf(structure(2.4), TEXTURES);

    expect(look.ground).toBe(MILL);
    expect(look.icon).toBe(MILL);
    expect(look.flag).toEqual({ across: 0.5, down: 0 });
  });

  it('flies no pennant on anything that is not a structure', () => {
    expect(lookOf({ ...structure(), kind: 'house' }, TEXTURES).flag).toBeNull();
  });
});

describe('where a pennant flies', () => {
  const look = lookOf(structure(2.4), TEXTURES);

  it('from the point the picture names, half as tall as the mark', () => {
    // A mill drawn 80 tall is 60 wide; its flag stands at the middle of its top.
    expect(pennantOn(look, 80, { x: 200, y: 300 })).toEqual({ x: 200, y: 220, height: 40 });

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
    expect(pennantOn(lookOf({ ...structure(), kind: 'house' }, TEXTURES), 80, { x: 0, y: 0 })).toBeNull();
    expect(pennantOn(look, 0, { x: 0, y: 0 })).toBeNull();
  });
});
