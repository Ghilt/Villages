import dagre from '@dagrejs/dagre';

import type { QuestFile } from '@villages/world';

/** How big a node is drawn, so the layout and the drawing agree. */
export const NODE = { width: 230, height: 76 } as const;

/** A node where the layout put it, its top-left corner. */
export interface PlacedNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/** Where one node leads to another, and after which endings of its dialogue, when it is one. */
export interface Road {
  readonly from: string;
  readonly to: string;
  readonly endings: readonly string[];
  /** Out of a challenge node, whether it is the road when it is won or when it is lost. */
  readonly verdict?: 'won' | 'lost';
}

/**
 * A quest as its road, top to bottom: each node placed by dagre in ranks, so a node stands above the nodes it leads
 * to and a fork's two roads side by side. A road to a node the quest does not have is left out here, and the server
 * refuses it.
 */
export function layOutQuest(quest: QuestFile): { placed: PlacedNode[]; roads: Road[] } {
  const ids = new Set(quest.nodes.map((node) => node.id));
  const roads = quest.nodes.flatMap((node) =>
    node.then
      .filter((lead) => ids.has(lead.to))
      .map((lead) => ({
        from: node.id,
        to: lead.to,
        endings: lead.endings,
        ...(lead.verdict === undefined ? {} : { verdict: lead.verdict }),
      })),
  );

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 54 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of quest.nodes) graph.setNode(node.id, { width: NODE.width, height: NODE.height });
  for (const road of roads) graph.setEdge(road.from, road.to);
  dagre.layout(graph);

  const placed = quest.nodes.map((node) => {
    const at = graph.node(node.id);
    return { id: node.id, x: at.x - NODE.width / 2, y: at.y - NODE.height / 2 };
  });
  return { placed, roads };
}
