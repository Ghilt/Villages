/**
 * The challenge's content, `world/catalogues/challenges.json`, as the inspect page reads it: the effects a slice
 * carries, three to an aspect, the summons they bring, and the kinds of challenge a progression is drawn from, each
 * with its name, its words and its numbers. Strict as the server's reader is: a field it cannot read refuses the
 * file, naming where. Held to the server's reader by `contracts/fixtures/challenges.json`. See decision record 0107.
 */

/** The ten aspects, in their pairs, each beside its anti-aspect. */
export const ASPECTS = [
  'violence',
  'diplomacy',
  'holy',
  'reason',
  'authority',
  'freedom',
  'greed',
  'generosity',
  'nature',
  'industry',
] as const;
export type Aspect = (typeof ASPECTS)[number];

/** The other pole of an aspect's pair: Violence's is Diplomacy, and Diplomacy's Violence. */
export function antiOf(aspect: Aspect): Aspect {
  const at = ASPECTS.indexOf(aspect);
  return ASPECTS[at % 2 === 0 ? at + 1 : at - 1]!;
}

/** The stats a key figure in a slot can lend. */
export const LENT_STATS = ['piety', 'reason', 'kindness', 'physical'] as const;
export type LentStat = (typeof LENT_STATS)[number];

/** What an effect or a kind of summon needs of the happening to work: a matching aspect, its anti-aspect, or nothing. */
export type Needs = 'match' | 'anti' | null;

export interface ChallengeSlot {
  readonly fits: 'keyFigure' | 'structure';
  readonly lends: LentStat | null;
  readonly onTheLine: boolean;
}

export interface ChallengeEffect {
  /** Its aspect and its own name: `violence.sellswords`. */
  readonly id: string;
  /** Its own name, the key under its aspect: `sellswords`. */
  readonly key: string;
  readonly aspect: Aspect;
  readonly name: string;
  readonly fires: 'trigger' | 'passive';
  /** Its words, naming its numbers in braces: `{chance}% ...`. */
  readonly words: string;
  readonly numbers: Readonly<Record<string, number>>;
  readonly summons: string | null;
  readonly slot: ChallengeSlot | null;
  /** What it needs of the latest happening to work: its slice's aspect, its anti-aspect, or nothing. */
  readonly needs: Needs;
  /** The buff or the debuff it puts on, by its id; none for one that puts nothing on. */
  readonly puts: string | null;
}

export interface ChallengeSummon {
  readonly id: string;
  readonly name: string;
  readonly aspect: Aspect;
  readonly words: string;
  readonly numbers: Readonly<Record<string, number>>;
  /** What it needs of the happening to act: its own aspect, its anti-aspect, or nothing. */
  readonly needs: Needs;
  /** The buff or the debuff its acts put on, by its id; none for one that puts nothing on. */
  readonly puts: string | null;
}

/** A buff, which helps, or a debuff, which hinders: what it goes on, its words and its own numbers. */
export interface ChallengeLasting {
  readonly id: string;
  readonly name: string;
  /** What it goes on: slices, summons, or both. */
  readonly on: readonly ('slice' | 'summon')[];
  readonly words: string;
  readonly numbers: Readonly<Record<string, number>>;
}

export interface ChallengeKind {
  readonly id: string;
  readonly name: string;
  readonly words: string;
  readonly seconds: readonly [number, number];
  readonly happenings: readonly [number, number];
  readonly twoAspects: number;
  /** Every aspect's weight, nothing for one the file does not name. */
  readonly weights: Readonly<Record<Aspect, number>>;
}

export interface Challenges {
  readonly effects: readonly ChallengeEffect[];
  readonly summons: readonly ChallengeSummon[];
  readonly buffs: readonly ChallengeLasting[];
  readonly debuffs: readonly ChallengeLasting[];
  readonly kinds: readonly ChallengeKind[];
  /** What the file and each of its sections say of themselves, by `''`, `effects`, `summons`, `buffs`, `debuffs` and `kinds`. */
  readonly said: Readonly<Record<string, string>>;
}

type Node = Record<string, unknown>;

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function refuse(at: string): never {
  throw new Error(`world/catalogues/challenges.json: no ${at} the page can read`);
}

/** An object's fields, leaving out what begins `$`, which says what the rest are. */
const fieldsOf = (node: Node) => Object.entries(node).filter(([key]) => !key.startsWith('$'));

function word(node: Node, field: string, at: string): string {
  const value = node[field];
  return typeof value === 'string' && value.trim() !== '' ? value : refuse(`${at}.${field}`);
}

function aspectOf(value: unknown, at: string): Aspect {
  return ASPECTS.includes(value as Aspect) ? (value as Aspect) : refuse(at);
}

function numbersOf(value: unknown, at: string): Record<string, number> {
  if (value === undefined) return {};
  if (!isObject(value)) refuse(at);
  return Object.fromEntries(
    fieldsOf(value).map(([name, number]) =>
      typeof number === 'number' ? [name, number] : refuse(`${at}.${name}`),
    ),
  );
}

function rangeOf(value: unknown, at: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || !value.every((one) => Number.isInteger(one))) refuse(at);
  return [value[0] as number, value[1] as number];
}

function slotOf(value: unknown, at: string): ChallengeSlot | null {
  if (value === undefined) return null;
  if (!isObject(value)) refuse(at);
  const { fits, lends, onTheLine } = value;
  if (fits !== 'keyFigure' && fits !== 'structure') refuse(`${at}.fits`);
  if (lends !== undefined && !LENT_STATS.includes(lends as LentStat)) refuse(`${at}.lends`);
  if (onTheLine !== undefined && typeof onTheLine !== 'boolean') refuse(`${at}.onTheLine`);
  return { fits, lends: (lends as LentStat | undefined) ?? null, onTheLine: onTheLine ?? false };
}

function effectOf(aspect: Aspect, key: string, node: unknown): ChallengeEffect {
  const id = `${aspect}.${key}`;
  const at = `effects.${id}`;
  if (!isObject(node)) refuse(at);
  const { fires, summons } = node;
  if (fires !== 'trigger' && fires !== 'passive') refuse(`${at}.fires`);
  if (summons !== undefined && typeof summons !== 'string') refuse(`${at}.summons`);
  return {
    id,
    key,
    aspect,
    name: word(node, 'name', at),
    fires,
    words: word(node, 'words', at),
    numbers: numbersOf(node.numbers, `${at}.numbers`),
    summons: summons ?? null,
    slot: slotOf(node.slot, `${at}.slot`),
    needs: needsOf(node.needs, `${at}.needs`),
    puts: putsOf(node.puts, `${at}.puts`),
  };
}

function summonOf(id: string, node: unknown): ChallengeSummon {
  const at = `summons.${id}`;
  if (!isObject(node)) refuse(at);
  return {
    id,
    name: word(node, 'name', at),
    aspect: aspectOf(node.aspect, `${at}.aspect`),
    words: word(node, 'words', at),
    numbers: numbersOf(node.numbers, `${at}.numbers`),
    needs: needsOf(node.needs, `${at}.needs`),
    puts: putsOf(node.puts, `${at}.puts`),
  };
}

function lastingOf(section: string, id: string, node: unknown): ChallengeLasting {
  const at = `${section}.${id}`;
  if (!isObject(node)) refuse(at);
  const { on } = node;
  if (
    !Array.isArray(on) ||
    on.length === 0 ||
    !on.every((bearer) => bearer === 'slice' || bearer === 'summon')
  ) {
    refuse(`${at}.on`);
  }
  return {
    id,
    name: word(node, 'name', at),
    on: on as ('slice' | 'summon')[],
    words: word(node, 'words', at),
    numbers: numbersOf(node.numbers, `${at}.numbers`),
  };
}

/** A buff's or a debuff's id, or none when it is not there. */
function putsOf(value: unknown, at: string): string | null {
  if (value !== undefined && typeof value !== 'string') refuse(at);
  return value ?? null;
}

/** What an entry needs of the happening, `match` or `anti`, and nothing when it says nothing. */
function needsOf(value: unknown, at: string): Needs {
  if (value !== undefined && value !== 'match' && value !== 'anti') refuse(at);
  return value ?? null;
}

function kindOf(id: string, node: unknown): ChallengeKind {
  const at = `kinds.${id}`;
  if (!isObject(node)) refuse(at);
  if (typeof node.twoAspects !== 'number') refuse(`${at}.twoAspects`);
  if (!isObject(node.weights)) refuse(`${at}.weights`);
  const named = numbersOf(node.weights, `${at}.weights`);
  Object.keys(named).forEach((name) => aspectOf(name, `${at}.weights.${name}, an aspect,`));
  return {
    id,
    name: word(node, 'name', at),
    words: word(node, 'words', at),
    seconds: rangeOf(node.seconds, `${at}.seconds`),
    happenings: rangeOf(node.happenings, `${at}.happenings`),
    twoAspects: node.twoAspects,
    weights: Object.fromEntries(ASPECTS.map((aspect) => [aspect, named[aspect] ?? 0])) as Record<
      Aspect,
      number
    >,
  };
}

function section(file: Node, name: string): Node {
  return isObject(file[name]) ? file[name] : refuse(name);
}

/** The challenge's content in `text`, or an error naming the first field that cannot be read. */
export function parseChallenges(text: string): Challenges {
  const file: unknown = JSON.parse(text);
  if (!isObject(file)) refuse('the file');
  const effects = section(file, 'effects');
  const summons = section(file, 'summons');
  const buffs = section(file, 'buffs');
  const debuffs = section(file, 'debuffs');
  const kinds = section(file, 'kinds');
  const comment = (node: Node) => (typeof node.$comment === 'string' ? node.$comment : '');
  return {
    effects: fieldsOf(effects).flatMap(([aspect, those]) => {
      const known = aspectOf(aspect, `effects.${aspect}, an aspect,`);
      if (!isObject(those)) refuse(`effects.${aspect}`);
      return fieldsOf(those).map(([key, node]) => effectOf(known, key, node));
    }),
    summons: fieldsOf(summons).map(([id, node]) => summonOf(id, node)),
    buffs: fieldsOf(buffs).map(([id, node]) => lastingOf('buffs', id, node)),
    debuffs: fieldsOf(debuffs).map(([id, node]) => lastingOf('debuffs', id, node)),
    kinds: fieldsOf(kinds).map(([id, node]) => kindOf(id, node)),
    said: {
      '': comment(file),
      effects: comment(effects),
      summons: comment(summons),
      buffs: comment(buffs),
      debuffs: comment(debuffs),
      kinds: comment(kinds),
    },
  };
}

/** Words with their numbers filled in: `{chance}% to kill` with a chance of 25 is `25% to kill`. */
export function filledIn(words: string, numbers: Readonly<Record<string, number>>): string {
  return words.replace(/\{(\w+)\}/g, (hole, name: string) =>
    numbers[name] === undefined ? hole : String(numbers[name]),
  );
}
