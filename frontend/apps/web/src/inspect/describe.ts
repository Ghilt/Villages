import { ageOn } from '@villages/client-core';
import { describeDay } from '@villages/protocol';
import type { HolderView, HouseView, Point, Sex, StructureView } from '@villages/protocol';
import { insideFenceAt } from '@villages/world';
import type { StructureTypeSpec, TerrainClass } from '@villages/world';

import type { Area } from '../areas/areas';
import { blazon, whereabouts } from '../house/describe';
import type { WaterSeen } from './waters';
import type { Subject } from './subjects';

/**
 * Turning a subject into the words an inspect window shows.
 *
 * Pure, and one function per kind of thing. **No component knows what a house is**, the way no component
 * knows what a choice is: the window renders a description and the description is made here, so a new kind
 * of subject costs one function and no interface at all. That is the property the whole mechanic rests on -
 * see `MECHANICS.md`.
 *
 * What it can say is thin because the wire is thin: a house is a name, a banner, a seat, a founding day and
 * one resource, and that is everything the gateway sends. `MECHANICS.md` records what it is waiting on.
 */

/** One line of a window: what it is, and what the world says it is. */
export interface Fact {
  what: string;
  said: string;
  /** Whether it changes while you look at it, so the window can mark it as living rather than stale. */
  ticking?: boolean;
}

/**
 * A way on from a window.
 *
 * Two kinds, because there are two things a player means by "and that". **Another subject** opens a window
 * on it. **A pane** brings that pane up on this subject - showing it on the map is the first and so far the
 * only one. Both are drawn with the arrows in the bays, so the player says which bay as well as what.
 */
export type Link =
  | { what: string; to: 'subject'; subject: Subject }
  | { what: string; to: 'map'; at: { lat: number; lon: number } };

export interface Description {
  /** What kind of thing it is, in a word or two above the name. */
  kind: string;
  name: string;
  /** A line under the name, when the thing has one worth reading. */
  under?: string;
  /** A line or two about the thing, to read before its facts: what is said of a river, a lake or a sea. */
  about?: string;
  /**
   * A face, for a thing that has one: a person. Present with no portrait for somebody who has none, so
   * the window draws the bust rather than nothing; absent for a house or an area, which have no face.
   */
  likeness?: { portrait: string | undefined };
  facts: readonly Fact[];
  links: readonly Link[];
}

/**
 * What a window needs to know of a character, which both ways of hearing of one carry: standing on the
 * map in a held cell, or as one of your own key figures wherever they are.
 */
export interface CharacterSeen {
  id: string;
  givenName: string;
  familyName: string;
  sex: Sex;
  bornOn: number;
  agedYears: number;
  portrait?: string | undefined;
  keyFigureOf: readonly HolderView[];
  place?: Point | undefined;
}

/** What terrain a class id means, for a census that would otherwise be a list of numbers. */
export interface Legend {
  byId: ReadonlyMap<number, TerrainClass>;
}

/** How many terrains an area's window names before it stops. The rest are a tail nobody reads. */
const MOST_TERRAINS = 3;

/**
 * A house.
 *
 * `yours` rather than reading the gateway here, because whose a house is belongs to the caller: this file
 * knows what a house is and not who is looking at it.
 */
export function describeHouse(house: HouseView, yours: boolean, areas: readonly Area[]): Description {
  return {
    kind: yours ? 'Your house' : 'House',
    name: house.name,
    under: `under ${blazon(house)}`,
    facts: [
      { what: 'Seat', said: whereabouts(house) },
      { what: 'Founded', said: describeDay(house.since) },
      { what: 'Cell', said: house.cell },
    ],
    links: [
      { what: 'show it on the map', to: 'map', at: house.seat },
      // Every fenced area the seat falls inside. The only subject-to-subject link there is until the world
      // grows something else that overlaps: a house is in the ground somebody has drawn a line around.
      ...areas
        .filter((area) => seatIsInside(area, house))
        .map((area): Link => ({
          what: `the ground it stands in, ${area.diamonds.toLocaleString()} diamonds`,
          to: 'subject',
          subject: { kind: 'area', id: area.id },
        })),
    ],
  };
}

/**
 * A character: their face, their name, their age, and whose key figure they are, with a way to each of
 * those houses and to where they stand. Their stats are not here, because a stranger cannot see them and
 * this window is anybody's. `today` is the world's day, null before the world has said it.
 */
export function describeCharacter(
  character: CharacterSeen,
  today: number | null,
  yours: boolean,
): Description {
  const age = today === null ? null : ageOn(character.bornOn, character.agedYears, today);
  const holders = character.keyFigureOf.map((holder) => holder.name).join(', ');
  const links: Link[] = [];
  if (character.place !== undefined) {
    links.push({ what: 'show them on the map', to: 'map', at: character.place });
  }
  for (const holder of character.keyFigureOf) {
    links.push({ what: holder.name, to: 'subject', subject: { kind: 'house', id: holder.id } });
  }

  return {
    kind: yours ? 'Your key figure' : 'Key figure',
    name: `${character.givenName} ${character.familyName}`,
    under: age === null ? `a ${character.sex}` : `a ${character.sex} of ${age}`,
    likeness: { portrait: character.portrait },
    facts: [
      { what: 'Age', said: age === null ? '—' : String(age) },
      { what: 'Serves', said: holders === '' ? 'nobody' : holders },
      {
        what: 'Stands',
        said:
          character.place === undefined
            ? 'on no map'
            : `${character.place.lat.toFixed(3)}, ${character.place.lon.toFixed(3)}`,
      },
    ],
    links,
  };
}

/**
 * A structure: its name; what it is, in the European word until the culture under it says another (step 12 of
 * docs/plans/structures.md), and whose seat it is, when it is one; who holds it, with a way to that house; its level; and where it stands. `spec` is the
 * catalogue's entry for its type, absent before the catalogue is read or for a type it lacks; `yours` whether the
 * player's house holds it, which makes it one of their holdings.
 */
export function describeStructure(
  structure: StructureView,
  spec: StructureTypeSpec | undefined,
  yours: boolean,
): Description {
  const word = spec?.words.european ?? spoken(structure.structureType);
  const { holder, level, place } = structure;
  const links: Link[] = [{ what: 'show it on the map', to: 'map', at: place }];
  if (holder !== undefined) {
    links.push({ what: holder.name, to: 'subject', subject: { kind: 'house', id: holder.id } });
  }
  return {
    kind: yours ? 'Your holding' : 'Structure',
    name: structure.name,
    under: `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}${structure.seatOf === undefined ? '' : `, the seat of ${structure.seatOf.name}`}`,
    facts: [
      { what: 'Held by', said: holder?.name ?? 'nobody' },
      { what: 'Level', said: spec === undefined ? String(level) : `${level} of ${spec.levels}` },
      { what: 'Stands', said: `${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}` },
    ],
    links,
  };
}

/** A name in the catalogue, said: `printingHouse` is a printing house. */
function spoken(type: string): string {
  return type.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
}

/** An area: what it encloses, and who is standing in it. */
export function describeArea(area: Area, houses: readonly HouseView[], legend: Legend | null): Description {
  const inside = houses.filter((house) => seatIsInside(area, house));

  const facts: Fact[] = [
    { what: 'Encloses', said: `${area.diamonds.toLocaleString()} diamonds` },
    { what: 'Houses', said: inside.length === 0 ? 'none in view' : `${inside.length}` },
  ];

  if (area.counting) {
    facts.push({ what: 'Ground', said: 'counting…', ticking: true });
  } else if (area.problem !== null) {
    facts.push({ what: 'Ground', said: area.problem });
  } else if (area.census !== null && area.census.diamonds > 0) {
    const { byClass, diamonds } = area.census;
    for (const [id, count] of [...byClass].sort((one, other) => other[1] - one[1]).slice(0, MOST_TERRAINS)) {
      const share = (100 * count) / diamonds;
      facts.push({
        what: legend?.byId.get(id)?.name ?? `class ${id}`,
        said: `${share < 0.1 ? '<0.1' : share.toFixed(1)}%`,
      });
    }
  }

  return {
    kind: 'Area',
    name: area.id,
    under: area.shaded ? 'fenced and shaded' : 'fenced',
    facts,
    links: inside.map((house): Link => ({
      what: house.name,
      to: 'subject',
      subject: { kind: 'house', id: house.id },
    })),
  };
}

/** What each kind of water is called in its window, and what one nobody has named is. */
const WATER_WORDS = {
  river: ['River', 'A river'],
  lake: ['Lake', 'A lake'],
  sea: ['Sea', 'A sea'],
} as const;

/**
 * Water - a river, a lake, the sea - as the server named it for a click: its name in English, the one of 1790 where
 * the review chose it with today's under it, a line or two about it where the server has one, and a way back to
 * where it was clicked.
 */
export function describeWater(seen: WaterSeen): Description {
  const { kind, name, also, of1790, about } = seen.water;
  const under =
    name === undefined
      ? 'no name has reached you'
      : also === undefined
        ? undefined
        : of1790
          ? `${also} today`
          : also;
  return {
    kind: WATER_WORDS[kind][0],
    name: name ?? WATER_WORDS[kind][1],
    ...(under === undefined ? {} : { under }),
    ...(about === undefined ? {} : { about }),
    facts: [],
    links: [{ what: 'show it on the map', to: 'map', at: seen.at }],
  };
}

/**
 * Whether a house's seat falls inside a fence: whether the diamond it stands in does.
 *
 * `insideFenceAt`, the same question the area overlay asks of a click, so what the window says is in an
 * area is what the map says is. The fence carries the grid it was drawn on, so nothing has to be handed one.
 */
function seatIsInside(area: Area, house: HouseView): boolean {
  return insideFenceAt(area.fence, { lng: house.seat.lon, lat: house.seat.lat });
}
