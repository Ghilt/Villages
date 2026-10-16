import { WORLD_CACHE } from './cache';
import { ARTIFACTS, CLUSTERS, GROUPS, PIECES, READERS, TALKS, TOOLS } from './world';
import type { Talk } from './world';

/**
 * A card on the diagram: a file, a tool, a running piece, a group of running pieces that fit together, a cluster
 * of pieces of one kind inside a group, or the world cache's box round the master's tools and what they make.
 */
export type Card =
  | { readonly id: string; readonly kind: 'file'; readonly ref: string }
  | { readonly id: string; readonly kind: 'tool'; readonly ref: string }
  | {
      readonly id: string;
      readonly kind: 'piece';
      readonly ref: string;
      readonly group?: string;
      readonly cluster?: string;
    }
  | { readonly id: string; readonly kind: 'group'; readonly ref: string }
  | { readonly id: string; readonly kind: 'cluster'; readonly ref: string; readonly group: string }
  | { readonly id: string; readonly kind: 'shelf'; readonly ref: string };

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
export const clusterCard = (id: string) => `cluster:${id}`;
export const SHELF_CARD = `shelf:${WORLD_CACHE.id}`;

/** Whether a card stands inside the world cache's box: a world step's tool or a file one makes. */
export const inShelf = (card: Card): boolean =>
  (card.kind === 'tool' && (WORLD_CACHE.tools as readonly string[]).includes(card.ref)) ||
  (card.kind === 'file' && (WORLD_CACHE.files as readonly string[]).includes(card.ref));

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
    { id: SHELF_CARD, kind: 'shelf', ref: WORLD_CACHE.id },
  ];
  const arrows: Arrow[] = DRAWN_TOOLS.flatMap((tool) => [
    ...tool.reads.map((id) => arrow(fileCard(id), toolCard(tool.script))),
    ...tool.writes.map((id) => arrow(toolCard(tool.script), fileCard(id))),
  ]);
  return { cards, arrows };
}

/**
 * The running cards, each box before the boxes and pieces inside it, and the arrows into and between them. A baked
 * file the page reads arrives at the part of the page that reads it; one the game server reads arrives at its
 * group, because it is the whole process that reads them.
 */
export function runningGraph(): { cards: Card[]; arrows: Arrow[] } {
  const cards: Card[] = [
    ...GROUPS.map((g): Card => ({ id: groupCard(g.id), kind: 'group', ref: g.id })),
    ...CLUSTERS.map((c): Card => ({
      id: clusterCard(c.id),
      kind: 'cluster',
      ref: c.id,
      group: groupCard(c.group),
    })),
    ...PIECES.map((p): Card => ({
      id: runCard(p.id),
      kind: 'piece',
      ref: p.id,
      group: groupCard(p.group),
      ...(p.cluster === undefined ? {} : { cluster: clusterCard(p.cluster) }),
    })),
  ];
  const read = new Set<string>();
  const arrows: Arrow[] = [];
  for (const reader of READERS) {
    const into = reader.piece === undefined ? groupCard('server') : runCard(reader.piece);
    for (const file of reader.reads) {
      const key = `${file}>${into}`;
      if (read.has(key)) continue;
      read.add(key);
      arrows.push(arrow(fileCard(file), into));
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
 * running piece also lights the pieces it talks to, one step away, and a group or a cluster the pieces inside it,
 * as the world cache's box does.
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
  const inside = cards
    .filter(
      (c) =>
        (c.kind === 'piece' && (c.group === chosen || c.cluster === chosen)) ||
        (c.kind === 'cluster' && c.group === chosen) ||
        (chosen === SHELF_CARD && inShelf(c)),
    )
    .map((c) => c.id);
  return new Set([...reach((a) => [a.from, a.to]), ...reach((a) => [a.to, a.from]), ...near, ...inside]);
}
