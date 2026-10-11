import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { groupCard, related, runCard, runningGraph } from './graph';
import { GROUPS, PIECES, TALKS } from './world';

/** A path from the repository's root. */
const fromRoot = (path: string) => new URL(`../../../../../../${path}`, import.meta.url);

/** The running side of the architecture page: what the game is made of once it runs, and what passes between. */
describe('the running game, as the architecture page draws it', () => {
  it('joins only pieces it has, and puts each in a group it has', () => {
    const pieces = new Set(PIECES.map((p) => p.id));
    const groups = new Set(GROUPS.map((g) => g.id));
    expect(TALKS.flatMap((t) => [t.from, t.to]).filter((id) => !pieces.has(id))).toEqual([]);
    expect(PIECES.filter((p) => p.group !== undefined && !groups.has(p.group)).map((p) => p.id)).toEqual([]);
    expect(PIECES.filter((p) => p.instead !== undefined && !pieces.has(p.instead)).map((p) => p.id)).toEqual(
      [],
    );
  });

  it('names the folders of the pieces that are folders of the repository as they are', () => {
    const folders = PIECES.flatMap((p) => p.where.split(/, | · /)).filter((w) =>
      /^(backend|frontend)\//.test(w),
    );
    expect(folders.filter((folder) => !existsSync(fromRoot(folder)))).toEqual([]);
  });

  it('lights the pieces a piece talks to, and only those, when it is chosen', () => {
    const { cards, arrows } = runningGraph();
    const lit = related(runCard('mongodb'), arrows, cards);
    expect([...lit].sort()).toEqual([runCard('mongodb'), runCard('occurrent'), runCard('rabbitmq')].sort());
  });

  it('lights every piece inside a group when the group is chosen', () => {
    const { cards, arrows } = runningGraph();
    const lit = related(groupCard('events'), arrows, cards);
    for (const id of ['occurrent', 'mongodb', 'memory', 'rabbitmq']) expect(lit.has(runCard(id))).toBe(true);
    expect(lit.has(runCard('gateway'))).toBe(false);
  });

  it('brings the baked files the game server reads to its group, and the ones the page reads to the page', () => {
    const { arrows } = runningGraph();
    const into = new Set(arrows.filter((a) => a.flow).map((a) => a.to));
    expect([...into].sort()).toEqual([groupCard('server'), runCard('page')].sort());
  });
});
