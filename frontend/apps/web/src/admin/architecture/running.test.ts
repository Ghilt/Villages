import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { clusterCard, groupCard, related, runCard, runningGraph } from './graph';
import { CLUSTERS, GROUPS, PIECES, READERS, TALKS } from './world';

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
    // A part of the page names its files from the page's own src/, as its readers do.
    const folders = PIECES.flatMap((p) =>
      p.where
        .split(/, | · /)
        .map((w) =>
          p.group === 'page' && !/^(backend|frontend)\//.test(w) && /^[a-z]+\//.test(w)
            ? `frontend/apps/web/src/${w}`
            : w,
        ),
    ).filter((w) => /^(backend|frontend)\//.test(w));
    expect(folders.filter((folder) => !existsSync(fromRoot(folder)))).toEqual([]);
  });

  it('lights the pieces a piece talks to, and only those, when it is chosen', () => {
    const { cards, arrows } = runningGraph();
    const lit = related(runCard('rabbitmq'), arrows, cards);
    expect([...lit].sort()).toEqual([runCard('rabbitmq'), runCard('bridge'), runCard('projections')].sort());
  });

  it('lights every piece inside a group when the group is chosen', () => {
    const { cards, arrows } = runningGraph();
    const lit = related(groupCard('events'), arrows, cards);
    for (const id of ['occurrent', 'mongodb', 'memory', 'bridge', 'rabbitmq'])
      expect(lit.has(runCard(id))).toBe(true);
    expect(lit.has(runCard('gateway'))).toBe(false);
  });

  it('brings the files the game server reads to its group, and those the page reads to the part reading them', () => {
    const parts = new Set(PIECES.filter((p) => p.group === 'page').map((p) => p.id));
    expect(
      READERS.filter((r) => (r.program === 'page') !== parts.has(r.piece ?? '')).map((r) => r.id),
    ).toEqual([]);
    const { arrows } = runningGraph();
    const into = new Set(arrows.filter((a) => a.flow).map((a) => a.to));
    const reading = new Set(READERS.flatMap((r) => (r.piece === undefined ? [] : [runCard(r.piece)])));
    expect([...into].sort()).toEqual([groupCard('server'), ...reading].sort());
  });

  it('draws a box for the page with a card for each of its shaders', () => {
    const page = PIECES.filter((p) => p.group === 'page').map((p) => p.id);
    expect(page).toEqual(
      expect.arrayContaining(['relief', 'water', 'land', 'trees', 'critters', 'fog', 'clouds', 'pictures']),
    );
  });

  it("gathers the shaders in a box of their own inside the page's, and nothing else in it", () => {
    const shaders = PIECES.filter((p) => p.cluster === 'shaders').map((p) => p.id);
    expect(shaders.sort()).toEqual(['clouds', 'critters', 'fog', 'land', 'relief', 'trees', 'water']);
    for (const c of CLUSTERS)
      expect(PIECES.filter((p) => p.cluster === c.id && p.group !== c.group).map((p) => p.id)).toEqual([]);
    const { cards, arrows } = runningGraph();
    const lit = related(clusterCard('shaders'), arrows, cards);
    for (const id of shaders) expect(lit.has(runCard(id))).toBe(true);
    expect(lit.has(runCard('panes'))).toBe(false);
  });
});
