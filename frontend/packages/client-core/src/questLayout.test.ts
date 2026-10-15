import { describe, expect, it } from 'vitest';
import type { QuestView } from '@villages/protocol';

import { questLayout } from './questLayout';

const quest = (nodes: QuestView['nodes'], edges: QuestView['edges']): QuestView => ({
  id: 'q',
  revision: 1,
  title: 'A quest',
  nodes,
  edges,
  ending: { kind: 'open' },
});

describe("a quest map's layout", () => {
  it('keeps the rows the server worked out, and spreads each row across its places', () => {
    const placed = questLayout(
      quest(
        [
          { id: 'gate', row: 0, state: 'current' },
          { id: 'gift', row: 1, state: 'ahead' },
          { id: 'light', row: 1, state: 'ahead' },
          { id: 'blessing', row: 3, state: 'ahead' },
        ],
        [
          { from: 'gate', to: 'gift', state: 'ahead' },
          { from: 'gate', to: 'light', state: 'ahead' },
        ],
      ),
    );

    expect(placed.get('gate')).toEqual({ row: 0, column: 0, columns: 1 });
    expect(placed.get('gift')).toEqual({ row: 1, column: 0, columns: 2 });
    expect(placed.get('light')).toEqual({ row: 1, column: 1, columns: 2 });
    expect(placed.get('blessing')).toEqual({ row: 3, column: 0, columns: 1 });
  });

  it('orders a row under the nodes above that lead to it, so two roads do not cross', () => {
    // Listed crossed: the left node above leads to the right node below, and the right to the left.
    const placed = questLayout(
      quest(
        [
          { id: 'a', row: 0, state: 'ahead' },
          { id: 'b', row: 0, state: 'ahead' },
          { id: 'under-b', row: 1, state: 'ahead' },
          { id: 'under-a', row: 1, state: 'ahead' },
        ],
        [
          { from: 'a', to: 'under-a', state: 'ahead' },
          { from: 'b', to: 'under-b', state: 'ahead' },
        ],
      ),
    );

    expect(placed.get('under-a')!.column).toBe(0);
    expect(placed.get('under-b')!.column).toBe(1);
  });

  it('keeps the order the quest lists a node in when nothing drawn leads to it', () => {
    const placed = questLayout(
      quest(
        [
          { id: 'one', row: 2, state: 'ahead' },
          { id: 'two', row: 2, state: 'ahead' },
        ],
        [{ to: 'one', state: 'ahead' }],
      ),
    );

    expect([placed.get('one')!.column, placed.get('two')!.column]).toEqual([0, 1]);
  });
});
