import { describe, expect, it } from 'vitest';

import { isSource, layOut, makesSources } from './layout';
import { ARTIFACTS, PIECES, TOOLS } from './world';

/**
 * What the world is made from stands on one row along the top of the diagram, so every source can be read off it
 * at once: what Adam writes and what is downloaded, the download above the files it fetches, and nothing else on
 * the row or above it but that.
 */
describe("the diagram's sources", () => {
  const { placed, sources: line } = layOut();
  const sources = placed.filter((p) => isSource(p.card));
  const row = { top: sources[0]!.y, bottom: sources[0]!.y + sources[0]!.height };
  const baked = placed.filter(
    (p) => p.card.kind === 'file' || p.card.kind === 'tool' || p.card.kind === 'shelf',
  );

  it('are every file authored or downloaded, all on one row', () => {
    expect(sources.length).toBe(ARTIFACTS.filter((a) => a.origin !== 'baked').length);
    expect(new Set(sources.map((p) => p.y)).size).toBe(1);
  });

  it('stand side by side, none over another', () => {
    const across = [...sources].sort((one, other) => one.x - other.x);
    for (let i = 1; i < across.length; i++) {
      expect(across[i]!.x).toBeGreaterThanOrEqual(across[i - 1]!.x + across[i - 1]!.width);
    }
  });

  it('stand together, what one download fetches, right under it', () => {
    const across = [...sources].sort((one, other) => one.x - other.x).map((p) => p.card.ref);
    const download = placed.find((p) => p.card.ref === 'world:fetch-all')!;
    const fetched = TOOLS.find((tool) => tool.script === 'world:fetch-all')!.writes;
    const where = fetched.map((id) => across.indexOf(id)).sort((a, b) => a - b);
    expect(where.at(-1)! - where[0]!).toBe(fetched.length - 1);
    const under = sources.filter((p) => fetched.includes(p.card.ref));
    const middle = download.x + download.width / 2;
    expect(middle).toBeGreaterThan(Math.min(...under.map((p) => p.x)));
    expect(middle).toBeLessThan(Math.max(...under.map((p) => p.x + p.width)));
  });

  it('have only the download above them, and everything else the tools make below the line under them', () => {
    const others = baked.filter((p) => !isSource(p.card));
    const over = others.filter((p) => p.y + p.height <= row.top).map((p) => p.card.ref);
    expect(over).toEqual(others.filter((p) => makesSources(p.card)).map((p) => p.card.ref));
    expect(over).toEqual(['world:fetch-all']);
    const rest = others.filter((p) => !makesSources(p.card));
    expect(rest.filter((p) => p.y < line.y).map((p) => p.card.id)).toEqual([]);
    expect(line.y).toBeGreaterThan(row.bottom);
  });
});

/** The shaders stand together in a box of their own, inside the page's, and no other card stands in it. */
describe("the diagram's shaders", () => {
  const { placed } = layOut();
  const box = placed.find((p) => p.card.id === 'cluster:shaders')!;
  const inside = placed.filter((p) => p.parent === 'cluster:shaders');

  it("stand in the shaders' box, which stands in the page's", () => {
    expect(box.parent).toBe('group:page');
    expect(inside.map((p) => p.card.ref).sort()).toEqual(
      PIECES.filter((p) => p.cluster === 'shaders')
        .map((p) => p.id)
        .sort(),
    );
    for (const p of inside) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
      expect(p.x + p.width).toBeLessThan(box.width);
      expect(p.y + p.height).toBeLessThan(box.height);
    }
    const page = placed.find((p) => p.card.id === 'group:page')!;
    expect(box.x).toBeGreaterThan(0);
    expect(box.x + box.width).toBeLessThan(page.width);
    expect(box.y + box.height).toBeLessThan(page.height);
  });

  it('leave no other part of the page in their box, or over it', () => {
    const others = placed.filter((p) => p.parent === 'group:page' && p.card.kind === 'piece');
    const over = others.filter(
      (p) =>
        p.x < box.x + box.width &&
        p.x + p.width > box.x &&
        p.y < box.y + box.height &&
        p.y + p.height > box.y,
    );
    expect(over.map((p) => p.card.ref)).toEqual([]);
  });
});
