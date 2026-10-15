import type { QuestView } from '@villages/protocol';

/** Where a node stands on a quest's map: its row, and which of how many places across that row it takes. */
export interface Placed {
  readonly row: number;
  readonly column: number;
  readonly columns: number;
}

/** How many times the rows are reordered under the ones above them. A quest is a handful of nodes; two is plenty. */
const SWEEPS = 2;

/**
 * Where each drawn node of a quest stands on its map. Its row is the server's, worked out from the whole quest, so a
 * node shown ahead stands as far down as it really is; the order within a row is worked out here, each row sorted
 * under the middle of the nodes above it that lead to it, so the edges cross as little as a few sweeps can make
 * them. A node nothing drawn leads to keeps the order the quest lists it in. See decision record 0096.
 */
export function questLayout(quest: QuestView): ReadonlyMap<string, Placed> {
  const rows = new Map<number, string[]>();
  for (const node of quest.nodes) {
    rows.set(node.row, [...(rows.get(node.row) ?? []), node.id]);
  }
  const depths = [...rows.keys()].sort((a, b) => a - b);
  const across = (id: string): number => {
    const row = rows.get(quest.nodes.find((node) => node.id === id)!.row)!;
    return (row.indexOf(id) + 0.5) / row.length;
  };
  const listed = new Map(quest.nodes.map((node, at) => [node.id, at]));

  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (const depth of depths.slice(1)) {
      const row = rows.get(depth)!;
      const middle = new Map(
        row.map((id) => {
          const above = quest.edges
            .filter((edge) => edge.to === id && edge.from !== undefined)
            .map((edge) => across(edge.from!));
          return [id, above.length === 0 ? null : above.reduce((sum, x) => sum + x, 0) / above.length];
        }),
      );
      row.sort((a, b) => {
        const ma = middle.get(a) ?? null;
        const mb = middle.get(b) ?? null;
        if (ma !== null && mb !== null && ma !== mb) return ma - mb;
        return listed.get(a)! - listed.get(b)!;
      });
    }
  }

  const placed = new Map<string, Placed>();
  for (const [row, ids] of rows) {
    ids.forEach((id, column) => placed.set(id, { row, column, columns: ids.length }));
  }
  return placed;
}
