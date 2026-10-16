import dagre from '@dagrejs/dagre';

import type { Dialogue } from '@villages/world';

/** How big a line is drawn, so the layout and the drawing agree. */
export const LINE = { width: 250, height: 70 } as const;

/** A line where the layout put it, its top-left corner. */
export interface PlacedLine {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/** Where one line leads to another: said on, or one option of a dialogue choice. */
export interface Lead {
  readonly from: string;
  readonly to: string;
  readonly option: boolean;
}

/**
 * A dialogue as a tree, top to bottom: each line placed by dagre in ranks, so a line stands above the lines it leads
 * to, and the options of a choice side by side under the line that offers them. A lead to a line the dialogue does
 * not have is left out here, and the server refuses it.
 */
export function layOutDialogue(dialogue: Dialogue): { placed: PlacedLine[]; leads: Lead[] } {
  const ids = new Set(dialogue.lines.map((line) => line.id));
  const leads = dialogue.lines.flatMap((line): Lead[] => {
    if (line.then === null) return [];
    const options = typeof line.then === 'string' ? [line.then] : line.then;
    return options
      .filter((to) => ids.has(to))
      .map((to) => ({ from: line.id, to, option: typeof line.then !== 'string' }));
  });

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'TB', nodesep: 30, ranksep: 46 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const line of dialogue.lines) graph.setNode(line.id, { width: LINE.width, height: LINE.height });
  for (const lead of leads) graph.setEdge(lead.from, lead.to);
  dagre.layout(graph);

  const placed = dialogue.lines.map((line) => {
    const at = graph.node(line.id);
    return { id: line.id, x: at.x - LINE.width / 2, y: at.y - LINE.height / 2 };
  });
  return { placed, leads };
}
