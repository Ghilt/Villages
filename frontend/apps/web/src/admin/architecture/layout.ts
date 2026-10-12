import dagre from '@dagrejs/dagre';

import { SHELF_CARD, bakedGraph, inShelf, runningGraph } from './graph';
import type { Arrow, Card } from './graph';

/** Where a card stands, its top-left corner, and how big it is: inside its group's box when it has one. */
export interface Placed {
  readonly card: Card;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly parent?: string;
  /** Where in its box a box's words stand, from its top left corner: the world cache's leaves them room. */
  readonly words?: { readonly x: number; readonly y: number; readonly width: number };
}

export type Side = 'top' | 'bottom' | 'left' | 'right';

/** An arrow and the sides of its two cards it leaves and arrives at. */
export type Drawn = Arrow & { readonly fromSide?: Side; readonly toSide?: Side };

/** The line between what is baked and what runs: where it is, across the whole diagram. */
export interface Line {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

const WIDE = 196;
const GAP = 40;
/** The world cache's box: room round the cards inside it, and a place inside it for what it says. */
const SHELF = { pad: 12, words: { width: 600, height: 130 } };
const SHELF_WORDS = `${SHELF_CARD}:words`;

/** A running piece, and the room around it: columns and rows inside a group's box, and the boxes apart. */
const PIECE = { width: 270, height: 226 };
const COLUMN = PIECE.width + 120;
const ROW = PIECE.height + 100;
const PAD = 30;
const HEADER = 100;
const BETWEEN = 120;
const GROUP = { width: 2 * PAD + 2 * COLUMN + PIECE.width, height: HEADER + ROW + PIECE.height + PAD };

/**
 * Where each running piece stands: a column of three and a row of two in its group's box, the page alone above
 * them. The gateway is above what feeds it, Occurrent above what keeps its events, the bridge beside it and above
 * the broker it publishes to, and the feed runs up.
 */
const SPOTS: Record<string, { readonly col: number; readonly row: number }> = {
  page: { col: 1, row: 0 },
  gateway: { col: 1, row: 0 },
  rules: { col: 0, row: 1 },
  reactions: { col: 1, row: 1 },
  projections: { col: 2, row: 1 },
  occurrent: { col: 1, row: 0 },
  bridge: { col: 2, row: 0 },
  memory: { col: 0, row: 1 },
  mongodb: { col: 1, row: 1 },
  rabbitmq: { col: 2, row: 1 },
};

/** The groups' boxes, top to bottom beneath the page. */
const GROUP_ORDER = ['group:server', 'group:events'];

/** An arrow that would cut through the cards between its ends goes round the outside instead. */
const ROUND: Record<string, readonly [Side, Side]> = {
  'run:rabbitmq>run:projections': ['right', 'right'],
  'run:occurrent>run:memory': ['left', 'top'],
};

/** How big a card is drawn, so the layout and the drawing agree. */
export function sizeOf(card: Card): { width: number; height: number } {
  switch (card.kind) {
    case 'file':
      return { width: WIDE, height: 120 };
    case 'tool':
      return { width: WIDE, height: 124 };
    case 'piece':
      return PIECE;
    case 'group':
      return GROUP;
    case 'shelf':
      return { width: 0, height: 0 };
  }
}

/**
 * The whole diagram, laid out top to bottom. What is baked is laid out by dagre in ranks, so each tool stands
 * below what it reads and above what it writes. The running cards are not part of that: they stand beneath a
 * line drawn under the lowest baked card, so every arrow into them crosses it, the page alone and then each
 * group's box with its pieces in it. The master's tools and what they make stand in the world cache's box, which
 * dagre lays out as a cluster: as big as they need, and the rest of the baked cards round it.
 */
export function layOut(): { placed: Placed[]; arrows: Drawn[]; line: Line } {
  const baked = bakedGraph();
  const running = runningGraph();

  const graph = new dagre.graphlib.Graph({ compound: true });
  // Cards a rank apart by more than the box's padding twice over, so a card beside the box stays clear of it.
  graph.setGraph({
    rankdir: 'TB',
    nodesep: 2 * SHELF.pad + 6,
    edgesep: 4,
    ranksep: 64,
    ranker: 'tight-tree',
  });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const card of baked.cards) graph.setNode(card.id, card.kind === 'shelf' ? {} : sizeOf(card));
  for (const card of baked.cards) if (inShelf(card)) graph.setParent(card.id, SHELF_CARD);
  // What the box says is a card of its own inside it that nothing points at, so dagre leaves it room among the
  // box's own cards and never puts another card under the words.
  graph.setNode(SHELF_WORDS, SHELF.words);
  graph.setParent(SHELF_WORDS, SHELF_CARD);
  for (const a of baked.arrows) graph.setEdge(a.from, a.to);
  dagre.layout(graph);

  const placed: Placed[] = baked.cards.map((card) => {
    const at = graph.node(card.id);
    if (card.kind !== 'shelf') {
      return { card, x: at.x - at.width / 2, y: at.y - at.height / 2, width: at.width, height: at.height };
    }
    const [x, y] = [at.x - at.width / 2 - SHELF.pad, at.y - at.height / 2 - SHELF.pad];
    const words = graph.node(SHELF_WORDS);
    return {
      card,
      x,
      y,
      width: at.width + 2 * SHELF.pad,
      height: at.height + 2 * SHELF.pad,
      words: { x: words.x - words.width / 2 - x, y: words.y - words.height / 2 - y, width: words.width },
    };
  });
  const left = Math.min(...placed.map((p) => p.x));
  const right = Math.max(...placed.map((p) => p.x + p.width));
  const bottom = Math.max(...placed.map((p) => p.y + p.height));

  const line: Line = { x: left - GAP, y: bottom + 70, width: right - left + 2 * GAP };

  const middle = (left + right) / 2;
  const top = line.y + 110;
  const boxes = new Map(
    GROUP_ORDER.map((id, i) => [
      id,
      { x: middle - GROUP.width / 2, y: top + PIECE.height + BETWEEN + i * (GROUP.height + BETWEEN) },
    ]),
  );
  const at = new Map<string, { x: number; y: number }>();
  for (const card of running.cards) {
    if (card.kind === 'group') {
      const box = boxes.get(card.id)!;
      placed.push({ card, ...box, ...GROUP });
      continue;
    }
    if (card.kind !== 'piece') continue;
    const spot = SPOTS[card.ref]!;
    const x = PAD + spot.col * COLUMN;
    const y = HEADER + spot.row * ROW;
    if (card.group === undefined) {
      const alone = { x: middle - PIECE.width / 2, y: top };
      placed.push({ card, ...alone, ...PIECE });
      at.set(card.id, alone);
    } else {
      const box = boxes.get(card.group)!;
      placed.push({ card, x, y, ...PIECE, parent: card.group });
      at.set(card.id, { x: box.x + x, y: box.y + y });
    }
  }

  const sided = running.arrows.map((a): Drawn => {
    const [from, to] = [at.get(a.from), at.get(a.to)];
    if (a.flow || from === undefined || to === undefined) return a;
    const [fromSide, toSide] = ROUND[a.id] ?? facing(from, to);
    return { ...a, fromSide, toSide };
  });

  return { placed, arrows: [...baked.arrows, ...sided], line };
}

/** The sides two pieces face each other by: top and bottom when one is mostly above the other, else left and right. */
function facing(from: { x: number; y: number }, to: { x: number; y: number }): readonly [Side, Side] {
  const [dx, dy] = [to.x - from.x, to.y - from.y];
  if (Math.abs(dy) > Math.abs(dx) * 0.6) return dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
  return dx > 0 ? ['right', 'left'] : ['left', 'right'];
}
