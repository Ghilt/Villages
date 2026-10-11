import { ARTIFACTS, LIVE, READERS, TOOLS } from './world';

/** A card on the diagram: a file, a tool, a running program or part of one, or the line between them. */
export type Card =
  | { readonly id: string; readonly kind: 'file'; readonly ref: string }
  | { readonly id: string; readonly kind: 'tool'; readonly ref: string }
  | { readonly id: string; readonly kind: 'program'; readonly ref: 'page' | 'server' }
  | { readonly id: string; readonly kind: 'live'; readonly ref: string };

/** An arrow. `flow` is false between running cards, which talk rather than make one another. */
export interface Arrow {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly flow: boolean;
}

export const fileCard = (id: string) => `file:${id}`;
export const toolCard = (script: string) => `tool:${script}`;
export const runCard = (id: string) => `run:${id}`;

/**
 * The tools drawn: not Adam's own, one of which writes the master it reads and would loop the flow, and not
 * the two that draw placeholders by hand, which make nothing the rest of the world is made from.
 */
export const DRAWN_TOOLS = TOOLS.filter(
  (tool) => tool.group !== 'adam' && tool.script !== 'world:portraits' && tool.script !== 'world:scenes',
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

/** The running cards, in the order they stand beneath the line, and the arrows into and between them. */
export function runningGraph(): { cards: Card[]; arrows: Arrow[] } {
  const cards: Card[] = [
    { id: runCard('page'), kind: 'program', ref: 'page' },
    { id: runCard('gateway'), kind: 'live', ref: 'gateway' },
    { id: runCard('server'), kind: 'program', ref: 'server' },
    ...LIVE.filter((l) => l.id !== 'gateway').map((l): Card => ({
      id: runCard(l.id),
      kind: 'live',
      ref: l.id,
    })),
  ];
  const read = new Set<string>();
  const arrows: Arrow[] = [];
  for (const reader of READERS) {
    for (const file of reader.reads) {
      const key = `${file}>${reader.program}`;
      if (read.has(key)) continue;
      read.add(key);
      arrows.push(arrow(fileCard(file), runCard(reader.program)));
    }
  }
  arrows.push(
    talk(runCard('page'), runCard('gateway')),
    talk(runCard('gateway'), runCard('server')),
    talk(runCard('server'), runCard('event-store')),
    talk(runCard('event-store'), runCard('projections')),
  );
  return { cards, arrows };
}

function arrow(from: string, to: string): Arrow {
  return { id: `${from}>${to}`, from, to, flow: true };
}

function talk(from: string, to: string): Arrow {
  return { id: `${from}>${to}`, from, to, flow: false };
}

/**
 * Everything a card depends on and everything that depends on it, following only the arrows that make
 * things: so choosing the master lights the files and the programs made from it, and not the event store.
 */
export function related(chosen: string, arrows: readonly Arrow[]): Set<string> {
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
  return new Set([...reach((a) => [a.from, a.to]), ...reach((a) => [a.to, a.from])]);
}
