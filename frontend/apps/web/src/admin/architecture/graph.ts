import { ARTIFACTS, GROUPS, PIECES, READERS, TALKS, TOOLS } from './world';
import type { Talk } from './world';

/** A card on the diagram: a file, a tool, a running piece, or a group of running pieces that fit together. */
export type Card =
  | { readonly id: string; readonly kind: 'file'; readonly ref: string }
  | { readonly id: string; readonly kind: 'tool'; readonly ref: string }
  | { readonly id: string; readonly kind: 'piece'; readonly ref: string; readonly group?: string }
  | { readonly id: string; readonly kind: 'group'; readonly ref: string };

/**
 * An arrow. `flow` is false between running pieces, which talk rather than make one another, and then the arrow
 * says what passes along it, whether it goes both ways, and whether it is only instead of another or not yet built.
 */
export interface Arrow {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly flow: boolean;
  readonly says?: string;
  readonly both?: boolean;
  readonly when?: Talk['when'];
}

export const fileCard = (id: string) => `file:${id}`;
export const toolCard = (script: string) => `tool:${script}`;
export const runCard = (id: string) => `run:${id}`;
export const groupCard = (id: string) => `group:${id}`;

/**
 * The tools drawn: not Adam's own, one of which writes the master it reads and would loop the flow, not
 * the two that draw placeholders by hand, which make nothing the rest of the world is made from, and not the world
 * cache's, which runs the master's tools rather than reading any file of its own.
 */
export const DRAWN_TOOLS = TOOLS.filter(
  (tool) =>
    tool.group !== 'adam' &&
    tool.group !== 'cache' &&
    tool.script !== 'world:portraits' &&
    tool.script !== 'world:scenes',
);

/** Everything baked beforehand, as cards and arrows: files into tools, tools into files. */
export function bakedGraph(): { cards: Card[]; arrows: Arrow[] } {
  const cards: Card[] = [
    ...ARTIFACTS.map((a): Card => ({ id: fileCard(a.id), kind: 'file', ref: a.id })),
    ...DRAWN_TOOLS.map((t): Card => ({ id: toolCard(t.script), kind: 'tool', ref: t.script })),
  ];
  const arrows: Arrow[] = DRAWN_TOOLS.flatMap((tool) => [
    ...tool.reads.map((id) => arrow(fileCard(id), toolCard(tool.script))),
    ...tool.writes.map((id) => arrow(toolCard(tool.script), fileCard(id))),
  ]);
  return { cards, arrows };
}

/**
 * The running cards, groups before the pieces inside them, and the arrows into and between them. The baked files
 * the game server reads arrive at its group, because it is the whole process that reads them.
 */
export function runningGraph(): { cards: Card[]; arrows: Arrow[] } {
  const cards: Card[] = [
    ...GROUPS.map((g): Card => ({ id: groupCard(g.id), kind: 'group', ref: g.id })),
    ...PIECES.map((p): Card => ({
      id: runCard(p.id),
      kind: 'piece',
      ref: p.id,
      ...(p.group === undefined ? {} : { group: groupCard(p.group) }),
    })),
  ];
  const read = new Set<string>();
  const arrows: Arrow[] = [];
  for (const reader of READERS) {
    for (const file of reader.reads) {
      const key = `${file}>${reader.program}`;
      if (read.has(key)) continue;
      read.add(key);
      arrows.push(arrow(fileCard(file), reader.program === 'page' ? runCard('page') : groupCard('server')));
    }
  }
  arrows.push(...TALKS.map(talk));
  return { cards, arrows };
}

function arrow(from: string, to: string): Arrow {
  return { id: `${from}>${to}`, from, to, flow: true };
}

function talk(t: Talk): Arrow {
  const [from, to] = [runCard(t.from), runCard(t.to)];
  return { id: `${from}>${to}`, from, to, flow: false, says: t.says, both: t.both, when: t.when };
}

/**
 * Everything a card depends on and everything that depends on it, following only the arrows that make
 * things: so choosing the master lights the files and the programs made from it, and not the event store. A
 * running piece also lights the pieces it talks to, one step away, and a group the pieces inside it.
 */
export function related(chosen: string, arrows: readonly Arrow[], cards: readonly Card[] = []): Set<string> {
  const flowing = arrows.filter((a) => a.flow);
  const reach = (ends: (a: Arrow) => readonly [string, string]): Set<string> => {
    const seen = new Set([chosen]);
    const queue = [chosen];
    while (queue.length > 0) {
      const at = queue.pop()!;
      for (const a of flowing) {
        const [from, to] = ends(a);
        if (from === at && !seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
    return seen;
  };
  const near = arrows
    .filter((a) => !a.flow && (a.from === chosen || a.to === chosen))
    .flatMap((a) => [a.from, a.to]);
  const inside = cards.filter((c) => c.kind === 'piece' && c.group === chosen).map((c) => c.id);
  return new Set([...reach((a) => [a.from, a.to]), ...reach((a) => [a.to, a.from]), ...near, ...inside]);
}
