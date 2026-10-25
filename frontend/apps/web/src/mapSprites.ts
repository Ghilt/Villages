import type { CharacterOnMapView, ChoiceView, StructureView } from '@villages/protocol';
import { RUIN_PICTURE, pictureKey } from '@villages/world';
import type { Culture, StructureCatalogue } from '@villages/world';

import { onACorner } from './geometry/footing';
import type { MapSprite } from './sprites/SpriteRenderer';
import { tinctureColour } from './sprites/tinctures';

// What the session holds, as the marks the sprite renderer draws: the people standing on the map, the structures
// standing on it, and the seats a choice is offering. No house: a house is not drawn, its structures are, its seat
// among them. The renderer knows nothing of the game, so this is where the game is turned into marks.

/** The soft ink of the interface, for somebody standing on the map whom no house holds. */
const NOBODYS = 0x8a7a64;

/**
 * A character as the renderer draws them: a figure at their place, in the colours of the house they serve,
 * which is the first that took them in. Their own id space, so a person and a structure can never be one mark.
 */
export function toCharacterSprite(
  character: Pick<CharacterOnMapView, 'id' | 'givenName' | 'place' | 'keyFigureOf'>,
  yours = false,
): MapSprite {
  const serves = character.keyFigureOf[0];
  return {
    id: `character:${character.id}`,
    at: { lng: character.place.lon, lat: character.place.lat },
    tint: serves === undefined ? NOBODYS : tinctureColour(serves.banner.field),
    kind: 'character',
    ...(yours ? { yours } : {}),
    significance: KEY_FIGURE_SIGNIFICANCE,
    name: character.givenName,
  };
}

/**
 * What every key figure on the map matters, `KeyFigureService.ON_THE_MAP` on the server: not on the wire, because it
 * never differs.
 */
const KEY_FIGURE_SIGNIFICANCE = 10;

/** No tint at all: a structure is drawn in its own colours, and who holds it is said by its pennant. */
const UNTINTED = 0xffffff;

/**
 * A structure as the renderer draws it: its type's picture, as tall on the ground as the catalogue says for its
 * level, and its holder's pennant over it, or none for one nobody holds. Its own id space, so a structure and a person
 * can never be one mark. Without the catalogue, before it is read, the renderer stands it at a height of its own.
 * `yours` is one of the player's own holdings, which far out is its pin, drawn at every zoom (0096). It stands on the
 * corner of the ground's diamonds nearest its place, its foot where its yard's diamonds meet.
 */
export function toStructureSprite(
  structure: StructureView,
  catalogue: StructureCatalogue | null,
  culture: Culture | null = null,
  yours = false,
): MapSprite {
  const spec = catalogue?.types.find((one) => one.type === structure.structureType);
  const heights = spec?.groundHeight ?? [];
  const groundHeight = heights[Math.min(Math.max(structure.level, 1), heights.length) - 1];
  const sides = spec?.footprint ?? [];
  const footprint = sides[Math.min(Math.max(structure.level, 1), sides.length) - 1];
  return {
    id: `structure:${structure.id}`,
    at: onACorner({ lng: structure.place.lon, lat: structure.place.lat }),
    tint: UNTINTED,
    kind: 'structure',
    ...(yours ? { yours } : {}),
    significance: structure.significance,
    name: structure.name,
    // A ruin is drawn as a ruin, as tall as what it was; either in the culture of the ground it stands on.
    structure: {
      picture: pictureKey(structure.ruin === true ? RUIN_PICTURE : structure.structureType, culture),
      ...(groundHeight === undefined ? {} : { groundHeight }),
      ...(footprint === undefined ? {} : { footprint }),
      ...(structure.ruin === true ? { ruin: true } : {}),
    },
    ...(structure.holder === undefined ? {} : { pennant: tinctureColour(structure.holder.banner.field) }),
  };
}

/** The gold of the interface, so a place being offered reads as the world asking rather than as a house. */
const OFFERED = 0x9d7c2a;

/**
 * The seats a pending choice is offering, as marks on the map.
 *
 * They are there so that the three places can be looked at before one is taken: set the parchment aside,
 * pull back, and see where the world is proposing to put you.
 */
export function candidatesOf(choice: ChoiceView | null): MapSprite[] {
  if (choice === null) {
    return [];
  }
  return choice.options.flatMap((option) =>
    option.effect.kind === 'foundAt'
      ? [
          {
            id: `offered:${option.id}`,
            at: { lng: option.effect.seat.lon, lat: option.effect.seat.lat },
            tint: OFFERED,
            kind: 'candidate' as const,
          },
        ]
      : [],
  );
}

/**
 * The map's sprites made from what the session holds, each structure's and each person's the very object it was last
 * time while nothing about it changed - a structure by its stamp, which the server moves with every change to it - and
 * the very list while every one of them is. Every snapshot of a cell hands over every structure in view again, and a
 * new object for each made everything after it work them all out again: where each stands in a settlement, its yard,
 * its mark (decision record 0119).
 */
export function rememberingMapSprites(): (
  structures: readonly StructureView[],
  people: readonly (Pick<CharacterOnMapView, 'id' | 'givenName' | 'place' | 'keyFigureOf'> & {
    readonly yours: boolean;
  })[],
  catalogue: StructureCatalogue | null,
  cultureOf: (structure: StructureView) => Culture | null,
  yoursId: string | null,
  offered: readonly MapSprite[],
) => readonly MapSprite[] {
  let built = new Map<string, { key: string; sprite: MapSprite }>();
  let lastCatalogue: StructureCatalogue | null = null;
  let last: readonly MapSprite[] = [];
  return (structures, people, catalogue, cultureOf, yoursId, offered) => {
    if (catalogue !== lastCatalogue) built = new Map();
    lastCatalogue = catalogue;
    const next = new Map<string, { key: string; sprite: MapSprite }>();
    const kept = (id: string, key: string, make: () => MapSprite): MapSprite => {
      const was = built.get(id);
      const one = was?.key === key ? was : { key, sprite: make() };
      next.set(id, one);
      return one.sprite;
    };
    const sprites = [
      ...structures.map((structure) => {
        const culture = cultureOf(structure);
        const yours = structure.holder !== undefined && structure.holder.id === yoursId;
        return kept(
          `s${structure.id}`,
          `${structure.stamp}|${culture}|${yours}|${structure.holder?.banner.field}`,
          () => toStructureSprite(structure, catalogue, culture, yours),
        );
      }),
      ...people.map((one) =>
        kept(
          `c${one.id}`,
          `${one.place.lat}|${one.place.lon}|${one.givenName}|${one.keyFigureOf[0]?.banner.field}|${one.yours}`,
          () => toCharacterSprite(one, one.yours),
        ),
      ),
      ...offered,
    ];
    built = next;
    if (sprites.length === last.length && sprites.every((one, at) => one === last[at])) return last;
    last = sprites;
    return sprites;
  };
}
