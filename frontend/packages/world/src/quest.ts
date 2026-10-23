/**
 * A quest file, `world/catalogues/quests/<name>.json`, as the inspect page reads it: its nodes, the first the one it
 * starts at, each offering a dialogue of `dialogues/` by its name, holding objectives, giving a reward, or putting a
 * challenge; each hidden or shown ahead; each leading on to nodes, after a dialogue by the endings that lead there and
 * after a challenge by whether it is won or lost. Strict as the server's reader is. Held to it by
 * `contracts/fixtures/quest.json`. See decision records 0097 and 0107, amended.
 */

export type QuestObjective =
  | { readonly id: string; readonly kind: 'delivers'; readonly resource: string; readonly amount: number }
  | {
      readonly id: string;
      readonly kind: 'pledges';
      readonly resource: string;
      readonly amount: number;
      readonly months: number;
    }
  | { readonly id: string; readonly kind: 'holds'; readonly structure: string; readonly onAnIsland: boolean };

/** Where a node leads: to a node, after a dialogue by which of its endings, after a challenge when won or when lost. */
export interface QuestLead {
  readonly to: string;
  readonly endings: readonly string[];
  readonly verdict?: 'won' | 'lost';
}

/** What stands in a slot of a challenge's slice: a key figure lending a stat, or a building of a level. */
export type QuestStandIn =
  | { readonly kind: 'keyFigure'; readonly name: string; readonly stats: Readonly<Record<string, number>> }
  | { readonly kind: 'building'; readonly name: string; readonly level: number };

/** A slice as a catalogue writes it, the challenges page's draft: an opponent's in a quest, the starting slices. */
export interface QuestSlice {
  readonly aspect: string;
  readonly power: number;
  readonly integrity: number;
  readonly summonCount: number;
  readonly effects: readonly string[];
  readonly slotted: Readonly<Record<string, QuestStandIn>>;
}

/** The terms of a challenge a quest puts to the house: its kind, who stands against it, and the slices they bring. */
export interface QuestChallenge {
  readonly kind: string;
  readonly against: { readonly name: string; readonly colour: string };
  readonly slices: readonly QuestSlice[];
}

export interface QuestNodeFile {
  readonly id: string;
  readonly title: string;
  readonly hidden: boolean;
  readonly shownAhead: boolean;
  readonly then: readonly QuestLead[];
  readonly is:
    | { readonly kind: 'dialogue'; readonly dialogue: string }
    | { readonly kind: 'objectives'; readonly objectives: readonly QuestObjective[] }
    | { readonly kind: 'reward'; readonly gives: Readonly<Record<string, number>> }
    | { readonly kind: 'challenge'; readonly challenge: QuestChallenge };
}

export interface QuestFile {
  readonly title: string;
  readonly scene: string | null;
  readonly shownFromTheStart: boolean;
  readonly nodes: readonly QuestNodeFile[];
  readonly said: string;
}

type Node = Record<string, unknown>;

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The quest in `text`, or an error naming the first field that cannot be read. */
export function parseQuest(text: string): QuestFile {
  const refuse = (at: string): never => {
    throw new Error(`world/catalogues/quests: no ${at} the page can read`);
  };
  const file: unknown = JSON.parse(text);
  if (!isObject(file) || !isObject(file.nodes)) return refuse('nodes');
  const string = (node: Node, field: string, at: string) =>
    typeof node[field] === 'string' ? (node[field] as string) : refuse(`${at}.${field}`);
  const flag = (node: Node, field: string, at: string) =>
    node[field] === undefined
      ? false
      : typeof node[field] === 'boolean'
        ? (node[field] as boolean)
        : refuse(`${at}.${field}`);
  const amount = (node: Node, field: string, at: string) =>
    Number.isInteger(node[field]) ? (node[field] as number) : refuse(`${at}.${field}`);

  const objectiveOf = (id: string, node: unknown, at: string): QuestObjective => {
    if (!isObject(node)) return refuse(at);
    if (typeof node.delivers === 'string')
      return { id, kind: 'delivers', resource: node.delivers, amount: amount(node, 'amount', at) };
    if (typeof node.pledges === 'string') {
      return {
        id,
        kind: 'pledges',
        resource: node.pledges,
        amount: amount(node, 'amount', at),
        months: amount(node, 'months', at),
      };
    }
    if (typeof node.holds === 'string') {
      if (node.on !== undefined && node.on !== 'island') refuse(`${at}.on`);
      return { id, kind: 'holds', structure: node.holds, onAnIsland: node.on === 'island' };
    }
    return refuse(`${at}.delivers, pledges or holds`);
  };

  const number = (node: Node, field: string, at: string) =>
    typeof node[field] === 'number' ? (node[field] as number) : refuse(`${at}.${field}`);

  const standInOf = (node: unknown, at: string): QuestStandIn => {
    if (!isObject(node)) return refuse(at);
    const name = string(node, 'name', at);
    if (node.kind === 'keyFigure') {
      const { stats } = node;
      if (!isObject(stats) || !Object.values(stats).every((one) => Number.isInteger(one)))
        refuse(`${at}.stats`);
      return { kind: 'keyFigure', name, stats: stats as Record<string, number> };
    }
    if (node.kind === 'building') return { kind: 'building', name, level: amount(node, 'level', at) };
    return refuse(`${at}.kind`);
  };

  const sliceOf = (node: unknown, at: string): QuestSlice => {
    if (!isObject(node)) return refuse(at);
    const { effects, slotted } = node;
    if (!Array.isArray(effects) || !effects.every((one) => typeof one === 'string')) refuse(`${at}.effects`);
    if (slotted !== undefined && !isObject(slotted)) refuse(`${at}.slotted`);
    return {
      aspect: string(node, 'aspect', at),
      power: number(node, 'power', at),
      integrity: number(node, 'integrity', at),
      summonCount: amount(node, 'summonCount', at),
      effects: effects as string[],
      slotted: Object.fromEntries(
        Object.entries((slotted ?? {}) as Node).map(([effect, one]) => [
          effect,
          standInOf(one, `${at}.slotted.${effect}`),
        ]),
      ),
    };
  };

  const challengeOf = (node: unknown, at: string): QuestChallenge => {
    if (!isObject(node)) return refuse(at);
    const { against, slices } = node;
    if (!isObject(against)) return refuse(`${at}.against`);
    if (!Array.isArray(slices)) return refuse(`${at}.slices`);
    return {
      kind: string(node, 'kind', at),
      against: {
        name: string(against, 'name', `${at}.against`),
        colour: string(against, 'colour', `${at}.against`),
      },
      slices: slices.map((one, index) => sliceOf(one, `${at}.slices[${index}]`)),
    };
  };

  const nodes = Object.entries(file.nodes)
    .filter(([key]) => !key.startsWith('$'))
    .map(([id, node]): QuestNodeFile => {
      const at = `nodes.${id}`;
      if (!isObject(node)) return refuse(at);
      const { then } = node;
      const has = ['dialogue', 'objectives', 'gives', 'challenge'].filter(
        (field) => node[field] !== undefined,
      );
      if (has.length !== 1) refuse(`${at}.dialogue, objectives, gives or challenge, and only one,`);
      const byVerdict = has[0] === 'challenge';
      const leads: QuestLead[] =
        then === undefined
          ? []
          : typeof then === 'string'
            ? [{ to: then, endings: [] }]
            : isObject(then)
              ? Object.entries(then).map(([to, endings]): QuestLead => {
                  if (!Array.isArray(endings) || !endings.every((one) => typeof one === 'string'))
                    refuse(`${at}.then.${to}`);
                  if (!byVerdict) return { to, endings: endings as string[] };
                  const [verdict, ...more] = endings as string[];
                  if ((verdict !== 'won' && verdict !== 'lost') || more.length > 0)
                    refuse(`${at}.then.${to} won or lost`);
                  return { to, endings: [], verdict: verdict as 'won' | 'lost' };
                })
              : refuse(`${at}.then`);
      const is: QuestNodeFile['is'] =
        has[0] === 'challenge'
          ? { kind: 'challenge', challenge: challengeOf(node.challenge, `${at}.challenge`) }
          : has[0] === 'dialogue'
            ? { kind: 'dialogue', dialogue: string(node, 'dialogue', at) }
            : has[0] === 'objectives'
              ? {
                  kind: 'objectives',
                  objectives: isObject(node.objectives)
                    ? Object.entries(node.objectives).map(([key, one]) =>
                        objectiveOf(key, one, `${at}.objectives.${key}`),
                      )
                    : refuse(`${at}.objectives`),
                }
              : {
                  kind: 'reward',
                  gives:
                    isObject(node.gives) && Object.values(node.gives).every((one) => Number.isInteger(one))
                      ? (node.gives as Record<string, number>)
                      : refuse(`${at}.gives`),
                };
      return {
        id,
        title: string(node, 'title', at),
        hidden: flag(node, 'hidden', at),
        shownAhead: flag(node, 'shownAhead', at),
        then: leads,
        is,
      };
    });
  return {
    title: string(file, 'title', 'the file'),
    scene: typeof file.scene === 'string' ? file.scene : null,
    shownFromTheStart: flag(file, 'shownFromTheStart', 'the file'),
    nodes,
    said: typeof file.$comment === 'string' ? file.$comment : '',
  };
}
