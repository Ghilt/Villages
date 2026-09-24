import { describeDay } from '@villages/protocol';
import type { HouseView } from '@villages/protocol';
import { insideFence, toRasterPixel } from '@villages/world';
import type { MasterGrid, TerrainClass } from '@villages/world';

import type { Area } from '../areas/areas';
import { blazon, whereabouts } from '../house/describe';
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
  facts: readonly Fact[];
  links: readonly Link[];
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
export function describeHouse(
  house: HouseView,
  yours: boolean,
  areas: readonly Area[],
  grid: MasterGrid | null,
): Description {
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
        .filter((area) => seatIsInside(area, house, grid))
        .map((area): Link => ({
          what: `the ground it stands in, ${area.pixels.toLocaleString()} px`,
          to: 'subject',
          subject: { kind: 'area', id: area.id },
        })),
    ],
  };
}

/** An area: what it encloses, and who is standing in it. */
export function describeArea(
  area: Area,
  houses: readonly HouseView[],
  legend: Legend | null,
  grid: MasterGrid | null,
): Description {
  const inside = houses.filter((house) => seatIsInside(area, house, grid));

  const facts: Fact[] = [
    { what: 'Encloses', said: `${area.pixels.toLocaleString()} master px` },
    { what: 'Houses', said: inside.length === 0 ? 'none in view' : `${inside.length}` },
  ];

  if (area.counting) {
    facts.push({ what: 'Ground', said: 'counting…', ticking: true });
  } else if (area.problem !== null) {
    facts.push({ what: 'Ground', said: area.problem });
  } else if (area.census !== null && area.census.pixels > 0) {
    const { byClass, pixels } = area.census;
    for (const [id, count] of [...byClass].sort((one, other) => other[1] - one[1]).slice(0, MOST_TERRAINS)) {
      const share = (100 * count) / pixels;
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

/**
 * Whether a house's seat falls inside a fence.
 *
 * Through `toRasterPixel` and not by dividing the longitude, because world space is the Mercator square and
 * a master row is not a degree of latitude (decision record 0030). It is the same conversion the area
 * overlay uses to decide what a click hit, so what the window says is in an area is what the map says is.
 *
 * Without the grid there is no answer, and no answer means no link rather than a wrong one.
 */
function seatIsInside(area: Area, house: HouseView, grid: MasterGrid | null): boolean {
  if (grid === null) {
    return false;
  }
  const at = toRasterPixel({ lng: house.seat.lon, lat: house.seat.lat }, grid);
  return insideFence(area.fence, Math.floor(at.x), Math.floor(at.y));
}
