import type { CharacterOnMapView, ChoiceView, HouseView, StructureView } from '@villages/protocol';
import type { Culture, StructureCatalogue } from '@villages/world';

import type { MapSprite } from './sprites/SpriteRenderer';
import { pictureKey } from './sprites/cultureStyles';
import { RUIN_PICTURE } from './sprites/structureShapes';
import { tinctureColour } from './sprites/tinctures';

// What the session holds, as the marks the sprite renderer draws: houses, the people standing on the map, the
// structures standing on it, and the seats a choice is offering. The renderer knows nothing of the game, so this is where the game is turned into marks.

/**
 * A house as the renderer draws it: a mark at its seat, in its field's tincture.
 *
 * `always` is the eye: a house drawn however far back the camera goes. Only ever the player's own, and
 * only while the eye is open. See decision record 0038.
 */
export function toSprite(house: HouseView, always: boolean): MapSprite {
  return {
    id: house.id,
    at: { lng: house.seat.lon, lat: house.seat.lat },
    tint: tinctureColour(house.banner.field),
    kind: 'house',
    always,
  };
}

/** The soft ink of the interface, for somebody standing on the map whom no house holds. */
const NOBODYS = 0x8a7a64;

/**
 * A character as the renderer draws them: a figure at their place, in the colours of the house they serve,
 * which is the first that took them in. Their own id space, so a person and a house can never be one mark.
 */
export function toCharacterSprite(character: CharacterOnMapView): MapSprite {
  const serves = character.keyFigureOf[0];
  return {
    id: `character:${character.id}`,
    at: { lng: character.place.lon, lat: character.place.lat },
    tint: serves === undefined ? NOBODYS : tinctureColour(serves.banner.field),
    kind: 'character',
  };
}

/** No tint at all: a structure is drawn in its own colours, and who holds it is said by its pennant. */
const UNTINTED = 0xffffff;

/**
 * A structure as the renderer draws it: its type's picture, as tall on the ground as the catalogue says for its
 * level, and its holder's pennant over it, or none for one nobody holds. Its own id space, so a structure and a house
 * can never be one mark. Without the catalogue, before it is read, the renderer stands it at a height of its own.
 */
export function toStructureSprite(
  structure: StructureView,
  catalogue: StructureCatalogue | null,
  culture: Culture | null = null,
): MapSprite {
  const heights = catalogue?.types.find((one) => one.type === structure.structureType)?.groundHeight ?? [];
  const groundHeight = heights[Math.min(Math.max(structure.level, 1), heights.length) - 1];
  return {
    id: `structure:${structure.id}`,
    at: { lng: structure.place.lon, lat: structure.place.lat },
    tint: UNTINTED,
    kind: 'structure',
    // A ruin is drawn as a ruin, as tall as what it was; either in the culture of the ground it stands on.
    structure: {
      picture: pictureKey(structure.ruin === true ? RUIN_PICTURE : structure.structureType, culture),
      ...(groundHeight === undefined ? {} : { groundHeight }),
    },
    ...(structure.holder === undefined ? {} : { pennant: tinctureColour(structure.holder.banner.field) }),
  };
}

/**
 * The houses to draw as houses: every one but a house whose seat is among the structures drawn, which stands for it
 * there, so a seat is not drawn twice. A house whose seat is not in view - too far out to be sent, or under the fog -
 * is still drawn as itself, which is also what the eye keeps in sight. See decision record 0092.
 */
export function housesBesideTheirSeats<H extends { id: string }>(
  houses: readonly H[],
  structures: readonly StructureView[],
): H[] {
  const seated = new Set(structures.flatMap((one) => (one.seatOf === undefined ? [] : [one.seatOf.id])));
  return houses.filter((house) => !seated.has(house.id));
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
