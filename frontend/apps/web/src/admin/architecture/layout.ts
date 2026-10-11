import dagre from '@dagrejs/dagre';

import { bakedGraph, runningGraph } from './graph';
import type { Arrow, Card } from './graph';

/** Where a card stands, its top-left corner, and how big it is. */
export interface Placed {
  readonly card: Card;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The line between what is baked and what runs: where it is, across the whole diagram. */
export interface Line {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

const WIDE = 196;
const GAP = 40;
const RUNNING_WIDE = 270;

/** How big a card is drawn, so the layout and the drawing agree. */
export function sizeOf(card: Card): { width: number; height: number } {
  switch (card.kind) {
    case 'file':
      return { width: WIDE, height: 120 };
    case 'tool':
      return { width: WIDE, height: 124 };
    case 'live':
    case 'program':
      // Running cards grow to fit what they say; this is the room the row keeps for them.
      return { width: RUNNING_WIDE, height: 200 };
  }
}

/**
 * The whole diagram, laid out top to bottom. What is baked is laid out by dagre in ranks, so each tool stands
 * below what it reads and above what it writes. The running cards are not part of that: they stand in one
 * row beneath a line drawn under the lowest baked card, so every arrow into them crosses it.
 */
export function layOut(): { placed: Placed[]; arrows: Arrow[]; line: Line } {
  const baked = bakedGraph();
  const running = runningGraph();

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'TB', nodesep: 14, edgesep: 4, ranksep: 64, ranker: 'tight-tree' });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const card of baked.cards) graph.setNode(card.id, sizeOf(card));
  for (const a of baked.arrows) graph.setEdge(a.from, a.to);
  dagre.layout(graph);

  const placed: Placed[] = baked.cards.map((card) => {
    const at = graph.node(card.id);
    return { card, x: at.x - at.width / 2, y: at.y - at.height / 2, width: at.width, height: at.height };
  });
  const left = Math.min(...placed.map((p) => p.x));
  const right = Math.max(...placed.map((p) => p.x + p.width));
  const bottom = Math.max(...placed.map((p) => p.y + p.height));

  const line: Line = { x: left - GAP, y: bottom + 70, width: right - left + 2 * GAP };

  const sizes = running.cards.map(sizeOf);
  const rowWidth = sizes.reduce((sum, s) => sum + s.width, 0) + GAP * 2 * (sizes.length - 1);
  let x = left + (right - left - rowWidth) / 2;
  running.cards.forEach((card, i) => {
    const size = sizes[i]!;
    placed.push({ card, x, y: line.y + 110, ...size });
    x += size.width + GAP * 2;
  });

  return { placed, arrows: [...baked.arrows, ...running.arrows], line };
}
