import type { EarthName, NameKind } from './names.ts';

/**
 * The review of 1790 in `world/names/1790.json` as `world:names` applies it: what a source's named thing is called
 * in the world, whether it was there at all, and the towns the review adds that the source lacks. Every name is in
 * English, Adam's choice of 2026-10-06. See `docs/plans/real-world-names.md`.
 */

/** A thing as the review of 1790 decides it: its name then, or null if it was not there; today's; and why. */
export type Reviewed = readonly [string | null, string, string?];

/** A town of 1790 Natural Earth lacks, as the review adds it: its name then, today's, why, and where it stood. */
export type AddedTown = readonly [string, string, string, readonly [number, number]];

/** How much an added town matters: every one was added for what it was in 1790, a capital or a port. */
const ADDED_RANK = 6;

/**
 * The towns the review adds beside Natural Earth's - Mocha, Moorshedabad, Vila Rica, Seringapatam - each where
 * Wikidata puts it, keyed by its Wikidata id, and none that Natural Earth has after all, which its own entry names.
 */
export function townsAdded(
  added: Readonly<Record<string, AddedTown>>,
  known: ReadonlySet<string>,
  from: number,
): EarthName[] {
  return Object.entries(added)
    .filter(([id]) => !known.has(id))
    .map(([id, [then, today, , at]]) => ({
      id,
      kind: 'town' as const,
      name: then,
      ...(today === then ? {} : { also: today }),
      rank: ADDED_RANK,
      from,
      form: '1790' as const,
      lines: [[at]],
    }));
}

/**
 * What a source's named thing is called in the world, as the review in `world/names/1790.json` decides: the
 * review's name of 1790 where it has one, else the source's English name, else its own; the other name worth
 * showing beside that; and whether it is the name of 1790. A sea or a stretch of land is named the same way. Null
 * where the review says the thing was not there in 1790, and for a canal or a reservoir the review has not dated,
 * `made` saying the source calls it one: Natural Earth files its canals as rivers and its reservoirs as lakes, and
 * most of both - Suez, Panama, the Caledonian, Lake Nasser, the Rybinsk sea - were made after 1790.
 */
export function asIn1790(
  kind: NameKind | 'sea' | 'land',
  english: string | undefined,
  local: string,
  decided: Reviewed | undefined,
  made = false,
): { name: string; also?: string; form?: '1790' } | null {
  const name = decided?.[0] ?? (kind === 'lake' ? lakeInEnglish(english, local) : english) ?? local;
  const dug = made || (kind === 'river' && /\bcanal\b/i.test(`${name} ${local}`));
  if (decided?.[0] === null || (decided === undefined && dug)) return null;
  const other = alsoOf(name, local, decided);
  // Lake Mälaren needs no Mälaren beside it.
  const also = kind === 'lake' && other !== undefined && within(other, name) ? undefined : other;
  return {
    name,
    ...(also === undefined ? {} : { also }),
    ...(decided === undefined ? {} : { form: '1790' as const }),
  };
}

/**
 * A lake as English writes it. Natural Earth gives a lake's English name as its bare stem - Erie, Woods, Constance -
 * so the source's own name is the English one where it says lake itself, Lake Erie, Lake of the Woods, Great Bear
 * Lake, Lough Neagh; and a stem saying nothing of water is a Lake, Lake Constance beside the Bodensee.
 */
function lakeInEnglish(english: string | undefined, local: string): string | undefined {
  if (wordsOf(local).some((word) => ENGLISH_LAKE.has(word))) return local;
  if (english === undefined) return undefined;
  return wordsOf(english).some((word) => WATER.has(word)) ? english : `Lake ${english}`;
}

/** The words that make a name an English lake's. */
const ENGLISH_LAKE = new Set(['lake', 'lakes', 'loch', 'lough']);

/** Words that say a name is already a water's, in English or the language it is named in. */
const WATER = new Set([
  ...ENGLISH_LAKE,
  ...(
    'sea bay channel sound inlet arm basin strait river reservoir pond lagoon lago lac laguna lagoa ozero ' +
    'see meer zee haff zaliv zalew jezioro jezero hu nuur nur co tso kul köl köli göl gölü järvi jarvi ' +
    'vatn vatnet sjön sjøen träsk tó yumco embalse represa presa dam shuiku sagar samudra limni étang ' +
    'salar chott danau buhayrat'
  ).split(' '),
]);

/** A name's words, in small letters, whatever the alphabet. */
function wordsOf(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Whether one name's words stand together in another's: Mälaren in Lake Mälaren. */
function within(one: string, other: string): boolean {
  return ` ${wordsOf(other).join(' ')} `.includes(` ${wordsOf(one).join(' ')} `);
}

/**
 * The other name worth showing beside a thing's: today's from the review where it differs, else the source's own -
 * but never the same name again, nor one the source has mangled, its letters lost (Klarlven) or turned to '?'.
 */
function alsoOf(name: string, local: string, decided: Reviewed | undefined): string | undefined {
  // Letters alone, so that a name with its accented letters lost reads as the one it lost them from.
  const plain = (one: string) => one.toLowerCase().replace(/[^a-z]/g, '');
  const clean = [name, ...(decided ?? [])].filter((one): one is string => typeof one === 'string');
  const garbled = (one: string) =>
    one.includes('?') || clean.some((other) => other !== one && plain(other) === plain(one));
  return [decided?.[1], local].find(
    (one): one is string => one !== undefined && one !== name && !garbled(one),
  );
}
