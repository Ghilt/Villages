/**
 * The balance, `world/catalogues/balance.json`, as the page and its inspect page read it: the numbers that belong to
 * no one entry of a catalogue - what a roll costs and deals, when an omen is read, how small an island is, how old a
 * newcomer can be, a challenge's rules - each group with the words that say what its numbers do. Strict as the server's reader is: one it
 * cannot read refuses the file, naming where. Held to the server's reader by `contracts/fixtures/balance.json`. See
 * decision record 0097.
 */

/** The four rarities, as the file names them, most common first. */
export const RARITIES = ['common', 'uncommon', 'rare', 'legendary'] as const;
export type BalanceRarity = (typeof RARITIES)[number];

export interface Balance {
  readonly roll: {
    readonly price: number;
    readonly hand: number;
    readonly odds: Readonly<Record<BalanceRarity, number>>;
    readonly grants: Readonly<Record<BalanceRarity, number>>;
  };
  readonly omens: {
    readonly weakForDays: number;
    readonly piousAt: number;
    readonly groundPresent: number;
    readonly riversWithinKm: number;
    readonly housesWithinKm: number;
    readonly mostHouses: number;
    readonly townsWithinKm: number;
    readonly mostTowns: number;
  };
  readonly islands: { readonly smallerThanKm2: number };
  readonly newcomers: { readonly youngest: number; readonly oldest: number };
  readonly challenge: {
    readonly boost: number;
    readonly tugEnds: number;
    readonly buildingArrives: number;
    readonly pullShare: number;
    readonly integrityShare: number;
    readonly effectivenessLost: number;
    readonly slice: { readonly power: number; readonly integrity: number; readonly summonCount: number };
  };
  /** What each group's numbers do, in its own words, by the group's name; and the file's own, under `''`. */
  readonly said: Readonly<Record<string, string>>;
}

type Node = Record<string, unknown>;

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function refuse(at: string): never {
  throw new Error(`world/catalogues/balance.json: no ${at} the page can read`);
}

function group(file: Node, name: string): Node {
  const found = file[name];
  return isObject(found) ? found : refuse(name);
}

/** The last word of a place, `roll.hand` to `hand`: what it is called in its group. */
const last = (at: string) => at.slice(at.lastIndexOf('.') + 1);

function number(node: Node, at: string, whole = false): number {
  const value = node[last(at)];
  return typeof value === 'number' && (!whole || Number.isInteger(value)) ? value : refuse(at);
}

function byRarity(node: Node, at: string): Record<BalanceRarity, number> {
  const found = node[last(at)];
  const each = isObject(found) ? found : refuse(at);
  const read = RARITIES.map((rarity) => [rarity, number(each, `${at}.${rarity}`, true)] as const);
  return Object.fromEntries(read) as Record<BalanceRarity, number>;
}

/** The balance in `text`, or an error naming the first number that cannot be read. */
export function parseBalance(text: string): Balance {
  const file: unknown = JSON.parse(text);
  if (!isObject(file)) refuse('the file');
  const roll = group(file, 'roll');
  const omens = group(file, 'omens');
  const islands = group(file, 'islands');
  const newcomers = group(file, 'newcomers');
  const challenge = group(file, 'challenge');
  const slice = group(challenge, 'slice');
  const comment = (node: Node) => (typeof node.$comment === 'string' ? node.$comment : '');
  return {
    roll: {
      price: number(roll, 'roll.price', true),
      hand: number(roll, 'roll.hand', true),
      odds: byRarity(roll, 'roll.odds'),
      grants: byRarity(roll, 'roll.grants'),
    },
    omens: {
      weakForDays: number(omens, 'omens.weakForDays', true),
      piousAt: number(omens, 'omens.piousAt', true),
      groundPresent: number(omens, 'omens.groundPresent'),
      riversWithinKm: number(omens, 'omens.riversWithinKm'),
      housesWithinKm: number(omens, 'omens.housesWithinKm'),
      mostHouses: number(omens, 'omens.mostHouses', true),
      townsWithinKm: number(omens, 'omens.townsWithinKm'),
      mostTowns: number(omens, 'omens.mostTowns', true),
    },
    islands: { smallerThanKm2: number(islands, 'islands.smallerThanKm2') },
    newcomers: {
      youngest: number(newcomers, 'newcomers.youngest', true),
      oldest: number(newcomers, 'newcomers.oldest', true),
    },
    challenge: {
      boost: number(challenge, 'challenge.boost'),
      tugEnds: number(challenge, 'challenge.tugEnds'),
      buildingArrives: number(challenge, 'challenge.buildingArrives'),
      pullShare: number(challenge, 'challenge.pullShare'),
      integrityShare: number(challenge, 'challenge.integrityShare'),
      effectivenessLost: number(challenge, 'challenge.effectivenessLost'),
      slice: {
        power: number(slice, 'challenge.slice.power'),
        integrity: number(slice, 'challenge.slice.integrity'),
        summonCount: number(slice, 'challenge.slice.summonCount', true),
      },
    },
    said: {
      '': comment(file),
      roll: comment(roll),
      omens: comment(omens),
      islands: comment(islands),
      newcomers: comment(newcomers),
      challenge: comment(challenge),
    },
  };
}
