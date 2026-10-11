/**
 * The catalogue of structures, `world/structures.json`, as the page and the tools read it: every type, what each
 * culture calls it, and what it is at each of its levels. The server reads the same file for its rules, and the two
 * readers are held to one shape by `contracts/fixtures/structures.json`. This side keeps what the server passes over
 * - the words, the size on the map, the influence zone - as well as everything the debug panel lists. A file this
 * cannot read is refused whole, naming the type and the field. See decision record 0093.
 */

/** The building traditions a structure can be drawn in. Ground of any other culture borrows the nearest. */
export const CULTURES = ['european', 'islamic', 'eastAsian', 'african'] as const;
export type Culture = (typeof CULTURES)[number];

/** The resources by their names on the wire, which the catalogue uses too. */
export const STRUCTURE_RESOURCES = ['wealth', 'naturalDomain', 'influence', 'reason', 'piety'] as const;
export type StructureResource = (typeof STRUCTURE_RESOURCES)[number];

const STATS = ['piety', 'reason', 'kindness', 'physical'] as const;
const TAKES = ['character', 'item', 'either'] as const;
const SEEN_BY = ['all', 'holder'] as const;

export interface StructureSlot {
  name: string;
  /** What the slot is for; the levers follow it, and a story may put anything there. */
  takes: (typeof TAKES)[number];
  /** How many places it has at each level, never fewer a level higher. */
  places: number[];
  /** Whether another house in sight sees into it, or only the holder. */
  seenBy: (typeof SEEN_BY)[number];
  needed: boolean;
  adds: Partial<Record<StructureResource, number>>;
  scales: (typeof STATS)[number] | null;
  bringsItsOwn: boolean;
}

export interface StructureTypeSpec {
  /** Its name in the catalogue: `mill`, `printingHouse`. */
  type: string;
  /** What each culture calls it; one with no word of its own borrows the European. */
  words: Record<Culture, string>;
  /** How many levels it has; every list below is this long. */
  levels: number;
  significance: number[];
  sightKm: number[];
  groundHeight: number[];
  /** What it yields its holder a world month, a real day, at each level. */
  yields: Partial<Record<StructureResource, number[]>>;
  /** The ground it reaches, drawn while it is selected, or none. */
  zone: { reach: number } | null;
  slots: StructureSlot[];
}

export interface StructureCatalogue {
  /** Every type, in the order the file lists them. */
  types: StructureTypeSpec[];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function refuse(type: string, field: string): never {
  throw new Error(`world/structures.json: ${type} has no ${field} the page can read`);
}

function numbers(node: Json, field: string, type: string, length?: number): number[] {
  const list = node[field];
  if (
    !Array.isArray(list) ||
    list.length === 0 ||
    !list.every((n) => typeof n === 'number' && Number.isFinite(n))
  ) {
    refuse(type, field);
  }
  if (length !== undefined && list.length !== length) {
    refuse(type, field);
  }
  return list as number[];
}

function oneOf<T extends string>(choices: readonly T[], value: unknown, type: string, field: string): T {
  return choices.includes(value as T) ? (value as T) : refuse(type, field);
}

function flag(node: Json, field: string, type: string, at: string): boolean {
  const value = node[field];
  if (value === undefined) {
    return false;
  }
  return typeof value === 'boolean' ? value : refuse(type, at);
}

function slotOf(node: unknown, type: string, levels: number): StructureSlot {
  if (!isObject(node) || typeof node.name !== 'string' || node.name === '') {
    refuse(type, 'slots.name');
  }
  const at = `slots.${node.name}`;
  const places = numbers(node, 'places', type, levels);
  if (places.some((n, i) => !Number.isInteger(n) || n < 0 || (i > 0 && n < places[i - 1]!))) {
    refuse(type, `${at}.places`);
  }
  const adds: Partial<Record<StructureResource, number>> = {};
  if (node.adds !== undefined) {
    if (!isObject(node.adds)) {
      refuse(type, `${at}.adds`);
    }
    for (const [resource, amount] of Object.entries(node.adds)) {
      if (typeof amount !== 'number' || amount < 0) {
        refuse(type, `${at}.adds.${resource}`);
      }
      adds[oneOf(STRUCTURE_RESOURCES, resource, type, `${at}.adds.${resource}`)] = amount;
    }
  }
  return {
    name: node.name,
    takes: oneOf(TAKES, node.takes, type, `${at}.takes`),
    places,
    seenBy: oneOf(SEEN_BY, node.seenBy, type, `${at}.seenBy`),
    needed: flag(node, 'needed', type, `${at}.needed`),
    adds,
    scales: node.scales === undefined ? null : oneOf(STATS, node.scales, type, `${at}.scales`),
    bringsItsOwn: flag(node, 'bringsItsOwn', type, `${at}.bringsItsOwn`),
  };
}

function typeOf(type: string, node: unknown): StructureTypeSpec {
  if (!/^[a-z][a-zA-Z]{0,39}$/.test(type) || !isObject(node)) {
    refuse(type, 'name in lower camel case');
  }
  const significance = numbers(node, 'significance', type);
  const levels = significance.length;
  if (significance.some((n) => n < 0 || n > 100)) {
    refuse(type, 'significance');
  }
  const sightKm = numbers(node, 'sightKm', type, levels);
  if (sightKm.some((km) => km <= 0)) {
    refuse(type, 'sightKm');
  }
  const words = node.words;
  if (!isObject(words) || typeof words.european !== 'string') {
    refuse(type, 'words.european');
  }
  const yields: Partial<Record<StructureResource, number[]>> = {};
  if (!isObject(node.yields)) {
    refuse(type, 'yields');
  }
  for (const resource of Object.keys(node.yields)) {
    yields[oneOf(STRUCTURE_RESOURCES, resource, type, `yields.${resource}`)] = numbers(
      node.yields,
      resource,
      type,
      levels,
    );
  }
  const zone = node.zone;
  if (zone !== undefined && !(isObject(zone) && typeof zone.reach === 'number' && zone.reach > 0)) {
    refuse(type, 'zone');
  }
  if (!Array.isArray(node.slots)) {
    refuse(type, 'slots');
  }
  const slots = node.slots.map((slot) => slotOf(slot, type, levels));
  if (new Set(slots.map((slot) => slot.name)).size !== slots.length) {
    refuse(type, 'slots with a name apiece');
  }
  return {
    type,
    words: Object.fromEntries(
      CULTURES.map((culture) => [
        culture,
        typeof words[culture] === 'string' ? words[culture] : words.european,
      ]),
    ) as Record<Culture, string>,
    levels,
    significance,
    sightKm,
    groundHeight: numbers(node, 'groundHeight', type, levels),
    yields,
    zone: zone === undefined ? null : { reach: zone.reach as number },
    slots,
  };
}

/** The catalogue in `text`, or an error naming the first type and field that cannot be read. */
export function parseStructureCatalogue(text: string): StructureCatalogue {
  const file: unknown = JSON.parse(text);
  if (!isObject(file) || !isObject(file.types) || Object.keys(file.types).length === 0) {
    refuse('the file', 'types');
  }
  return { types: Object.entries(file.types).map(([type, node]) => typeOf(type, node)) };
}
