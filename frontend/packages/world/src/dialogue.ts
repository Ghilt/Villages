/**
 * A dialogue file, `world/catalogues/dialogues/<name>.json`, as the inspect page reads it: its speakers - the house's
 * key figure, or somebody named - and its lines, each said by a speaker, with its words, what it grants and spends,
 * what it reveals, what it shows, and where it leads: to a line, to a choice of lines, or, leading nowhere, the end.
 * Strict as the server's reader is. Held to it by `contracts/fixtures/dialogue.json`. See decision record 0097.
 */

export type DialogueResources = Readonly<Record<string, number>>;

export interface DialogueSpeaker {
  readonly id: string;
  readonly party: number;
  /** Who they are: the house's key figure, whoever that is when it is offered, or somebody by name. */
  readonly who: { readonly keyFigure: true } | { readonly name: string; readonly portrait: string | null };
}

export interface DialogueLine {
  readonly id: string;
  readonly by: string;
  readonly says: string;
  readonly grants: DialogueResources;
  readonly spends: DialogueResources;
  /** What an option shows of what it does: `hidden`, or each resource it gives and takes. */
  readonly reveals: 'hidden' | readonly DialogueResources[] | null;
  readonly shows: 'seat' | 'house' | 'keyFigure' | null;
  /** The line it leads to, the lines of a choice, or the end. */
  readonly then: string | readonly string[] | null;
}

export interface Dialogue {
  readonly title: string;
  readonly scene: string | null;
  readonly speakers: readonly DialogueSpeaker[];
  readonly lines: readonly DialogueLine[];
  readonly said: string;
}

type Node = Record<string, unknown>;

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const SHOWN = ['seat', 'house', 'keyFigure'] as const;

/** The dialogue in `text`, or an error naming the first field that cannot be read. */
export function parseDialogue(text: string): Dialogue {
  const refuse = (at: string): never => {
    throw new Error(`world/catalogues/dialogues: no ${at} the page can read`);
  };
  const file: unknown = JSON.parse(text);
  if (!isObject(file)) return refuse('dialogue');
  const fields = (node: unknown, at: string) =>
    isObject(node) ? Object.entries(node).filter(([key]) => !key.startsWith('$')) : refuse(at);
  const amounts = (node: unknown, at: string): DialogueResources => {
    if (node === undefined) return {};
    if (!isObject(node) || !Object.values(node).every((one) => Number.isInteger(one))) refuse(at);
    return node as DialogueResources;
  };
  const string = (node: Node, field: string, at: string) =>
    typeof node[field] === 'string' ? (node[field] as string) : refuse(`${at}.${field}`);

  const speakers = fields(file.speakers, 'speakers').map(([id, node]): DialogueSpeaker => {
    const at = `speakers.${id}`;
    if (!isObject(node) || !Number.isInteger(node.party)) refuse(`${at}.party`);
    const one = node as Node;
    const who: DialogueSpeaker['who'] =
      one.is === 'keyFigure'
        ? { keyFigure: true }
        : {
            name: string(one, 'name', at),
            portrait: typeof one.portrait === 'string' ? one.portrait : null,
          };
    return { id, party: one.party as number, who };
  });
  const lines = fields(file.lines, 'lines').map(([id, node]): DialogueLine => {
    const at = `lines.${id}`;
    if (!isObject(node)) return refuse(at);
    const { then, reveals, shows } = node;
    if (
      then !== undefined &&
      typeof then !== 'string' &&
      !(Array.isArray(then) && then.every((one) => typeof one === 'string'))
    ) {
      refuse(`${at}.then`);
    }
    if (reveals !== undefined && reveals !== 'hidden' && !Array.isArray(reveals)) refuse(`${at}.reveals`);
    if (shows !== undefined && !SHOWN.includes(shows as (typeof SHOWN)[number])) refuse(`${at}.shows`);
    return {
      id,
      by: string(node, 'by', at),
      says: string(node, 'says', at),
      grants: amounts(node.grants, `${at}.grants`),
      spends: amounts(node.spends, `${at}.spends`),
      reveals:
        reveals === undefined
          ? null
          : reveals === 'hidden'
            ? 'hidden'
            : (reveals as DialogueResources[]).map((one, n) => amounts(one, `${at}.reveals.${n}`)),
      shows: (shows as DialogueLine['shows'] | undefined) ?? null,
      then: (then as DialogueLine['then'] | undefined) ?? null,
    };
  });
  return {
    title: string(file, 'title', 'the file'),
    scene: typeof file.scene === 'string' ? file.scene : null,
    speakers,
    lines,
    said: typeof file.$comment === 'string' ? file.$comment : '',
  };
}
