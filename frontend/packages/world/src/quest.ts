/**
 * A quest file, `world/catalogues/quests/<name>.json`, as the inspect page reads it: its nodes, the first the one it
 * starts at, each offering a dialogue of `dialogues/` by its name, holding objectives, or giving a reward; each hidden
 * or shown ahead; each leading on to nodes, after a dialogue by the endings that lead there. Strict as the server's
 * reader is. Held to it by `contracts/fixtures/quest.json`. See decision record 0097.
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

/** Where a node leads: to a node, and after a dialogue by which of its endings. */
export interface QuestLead {
  readonly to: string;
  readonly endings: readonly string[];
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
    | { readonly kind: 'reward'; readonly gives: Readonly<Record<string, number>> };
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

  const nodes = Object.entries(file.nodes)
    .filter(([key]) => !key.startsWith('$'))
    .map(([id, node]): QuestNodeFile => {
      const at = `nodes.${id}`;
      if (!isObject(node)) return refuse(at);
      const { then } = node;
      const leads: QuestLead[] =
        then === undefined
          ? []
          : typeof then === 'string'
            ? [{ to: then, endings: [] }]
            : isObject(then)
              ? Object.entries(then).map(([to, endings]) => {
                  if (!Array.isArray(endings) || !endings.every((one) => typeof one === 'string'))
                    refuse(`${at}.then.${to}`);
                  return { to, endings: endings as string[] };
                })
              : refuse(`${at}.then`);
      const has = ['dialogue', 'objectives', 'gives'].filter((field) => node[field] !== undefined);
      if (has.length !== 1) refuse(`${at}.dialogue, objectives or gives, and only one,`);
      const is: QuestNodeFile['is'] =
        has[0] === 'dialogue'
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
