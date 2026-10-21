import type { StructureView } from '@villages/protocol';

import { spoken, type Description, type Link } from './describe';

/** What a settlement is called at each of its levels. */
const SETTLEMENT_SIZES = ['a hamlet', 'a village', 'a large village'] as const;

/** The eight ways a building can stand from a settlement's middle, clockwise from north. */
const COMPASS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

/** How near its middle, in degrees of latitude, a building stands by the green rather than to one side of it. */
const BY_THE_GREEN = 0.002;

/**
 * A settlement, as a whole: its name, what it is and how large, held by nobody, and every structure the house has
 * seen inside it, counted by its type, each a way on to its own window. A building raised for the settlement is
 * named after it, so its link says what it is and which way it stands from the middle instead, the most of a kind
 * first; any other keeps its own name. See decision record 0117.
 */
export function describeSettlement(
  settlement: {
    readonly name: string;
    readonly type: 'village' | 'fishingVillage';
    readonly level: number;
    readonly at: { lat: number; lon: number };
  },
  inside: readonly StructureView[],
): Description {
  const counted = new Map<string, number>();
  for (const one of inside) counted.set(one.structureType, (counted.get(one.structureType) ?? 0) + 1);
  const kinds = [...counted].sort((one, other) => other[1] - one[1] || (one[0] < other[0] ? -1 : 1));
  const buildings = kinds
    .map(([type, count]) => (count === 1 ? withArticle(spoken(type)) : `${count} ${spoken(type)}s`))
    .join(', ');
  const order = new Map(kinds.map(([type], index) => [type, index]));
  const ways = inside
    .map((one) => ({ one, way: wayFrom(settlement.at, one.place) }))
    .sort(
      (a, b) =>
        order.get(a.one.structureType)! - order.get(b.one.structureType)! ||
        (a.way === null ? -1 : COMPASS.indexOf(a.way)) - (b.way === null ? -1 : COMPASS.indexOf(b.way)),
    );
  const size = SETTLEMENT_SIZES[Math.max(0, Math.min(2, settlement.level - 1))];
  return {
    kind: 'Settlement',
    name: settlement.name.charAt(0).toUpperCase() + settlement.name.slice(1),
    under: `${size}${settlement.type === 'fishingVillage' ? ' by the water' : ''}, held by nobody`,
    facts: [
      { what: 'Buildings', said: buildings === '' ? 'none in view' : buildings },
      { what: 'Stands', said: `${settlement.at.lat.toFixed(3)}, ${settlement.at.lon.toFixed(3)}` },
    ],
    links: [
      { what: 'show it on the map', to: 'map', at: settlement.at },
      ...ways.map(({ one, way }): Link => ({
        what: !one.name.endsWith(settlement.name)
          ? one.name
          : `${withArticle(spoken(one.structureType))} ${way === null ? 'by the green' : `to the ${way}`}`,
        to: 'subject',
        subject: { kind: 'structure', id: one.id },
      })),
    ],
  };
}

/** Which way a place stands from a settlement's middle, or null for one by the green. */
function wayFrom(
  middle: { lat: number; lon: number },
  place: { lat: number; lon: number },
): (typeof COMPASS)[number] | null {
  const north = place.lat - middle.lat;
  const east = (place.lon - middle.lon) * Math.cos((middle.lat * Math.PI) / 180);
  if (Math.hypot(north, east) < BY_THE_GREEN) return null;
  return COMPASS[(Math.round(Math.atan2(east, north) / (Math.PI / 4)) + 8) % 8]!;
}

function withArticle(word: string): string {
  return `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;
}
