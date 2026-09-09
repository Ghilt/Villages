import { describe, expect, it } from 'vitest';

import { MAIN_PORT, WORKTREE_PORTS, parseWorktrees, portFor } from './worktreePort.ts';

describe('the port a worktree serves on', () => {
  it('leaves the main checkout on 5173', () => {
    // Every document says 5173 and so does Adam's muscle memory. Worktrees move; this does not.
    expect(portFor(null)).toBe(5173);
  });

  it('gives the same tree the same port every time, which is the whole point', () => {
    // If this ever stopped holding, a bookmark would open somebody else's world and look like ours.
    expect(portFor('silly-wozniak-923417')).toBe(portFor('silly-wozniak-923417'));
    expect(portFor('map-area-geofence-spike-a71a26')).toBe(portFor('map-area-geofence-spike-a71a26'));
  });

  it('never lands on the main checkout, and never leaves the range', () => {
    for (const name of ['a', '', 'zzz', 'map-natural-resources-da27bf', 'x'.repeat(200), '../..']) {
      const port = portFor(name);

      expect(port).toBeGreaterThan(MAIN_PORT);
      expect(port).toBeLessThanOrEqual(MAIN_PORT + WORKTREE_PORTS);
    }
  });

  it('spreads names across the range rather than bunching them', () => {
    // The names are all alike - a slug and a hex suffix - so a weak hash would put them in a handful of
    // ports and collide constantly. A thousand of them should very nearly all differ.
    const ports = new Set<number>();
    for (let at = 0; at < 1000; at += 1) {
      ports.add(portFor(`claude/map-thing-${at.toString(16)}`));
    }

    // A thousand names into five hundred ports cannot give more than five hundred, and a fair hash gets
    // most of the way there. A poor one lands on a few dozen.
    expect(ports.size).toBeGreaterThan(WORKTREE_PORTS * 0.8);
  });
});

describe('reading the worktrees out of git', () => {
  const commonDir = '/repo/.git';
  const porcelain = [
    'worktree /repo',
    'HEAD 1111111111111111111111111111111111111111',
    'branch refs/heads/main',
    '',
    'worktree /repo/.claude/worktrees/silly-wozniak-923417',
    'HEAD 2222222222222222222222222222222222222222',
    'branch refs/heads/claude/silly-wozniak-923417',
    '',
    'worktree /repo/.claude/worktrees/detached-one',
    'HEAD 3333333333333333333333333333333333333333',
    'detached',
    '',
  ].join('\n');

  it('tells the main checkout apart from the worktrees inside it', () => {
    const found = parseWorktrees(porcelain, commonDir);

    expect(found).toHaveLength(3);
    expect(found[0]!.name).toBeNull();
    expect(found[0]!.port).toBe(MAIN_PORT);
    expect(found[1]!.name).toBe('silly-wozniak-923417');
    expect(found[1]!.port).not.toBe(MAIN_PORT);
  });

  it('keeps the branch, and coshes nothing when there is not one', () => {
    const found = parseWorktrees(porcelain, commonDir);

    expect(found[0]!.branch).toBe('main');
    expect(found[1]!.branch).toBe('claude/silly-wozniak-923417');
    expect(found[2]!.branch).toBeNull();
  });

  it('survives the shapes git actually emits', () => {
    // Trailing blank record, carriage returns from a Windows git, and nothing at all.
    expect(parseWorktrees('', commonDir)).toEqual([]);
    expect(parseWorktrees('\n\n\n', commonDir)).toEqual([]);
    expect(parseWorktrees(porcelain.replace(/\n/g, '\r\n'), commonDir)).toHaveLength(3);
  });
});
