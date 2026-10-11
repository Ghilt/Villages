import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { databaseFor, goneWorlds, readWorktrees } from '../lib/worlds.ts';

const porcelain = [
  'worktree E:/Code/Villages\nHEAD 0a0166c\nbranch refs/heads/main',
  'worktree E:/Code/Villages/.claude/worktrees/docker-roadmap-impl-03b5ca\nHEAD 0a0166c\nbranch refs/heads/claude/docker-roadmap-impl-03b5ca',
  'worktree E:/Code/Villages/.claude/worktrees/long-gone-1a2b3c\nHEAD 1234567\nbranch refs/heads/claude/long-gone-1a2b3c\nprunable gitdir file points to non-existent location',
  '',
].join('\n\n');

describe('the worlds of checkouts that are gone', () => {
  // The same cases as StoreConfigTest in backend/app, which names a world as the game server does.
  it("names a checkout's world as the game server names it", () => {
    assert.equal(databaseFor(null), 'villages');
    assert.equal(databaseFor('docker-roadmap-impl-03b5ca'), 'villages-docker-roadmap-impl-03b5ca');
    const odd = databaseFor(`Odd Name.With$Things-${'x'.repeat(80)}`);
    assert.equal(odd.length, 63);
    assert.equal(odd.slice(0, 34), 'villages-odd-name-with-things-xxxx');
  });

  it('reads the checkouts git lists, the main one first, and the ones whose folder is gone', () => {
    assert.deepEqual(readWorktrees(porcelain), [
      { folder: null, gone: false },
      { folder: 'docker-roadmap-impl-03b5ca', gone: false },
      { folder: 'long-gone-1a2b3c', gone: true },
    ]);
  });

  it("finds only the game's worlds whose checkout is gone, and never one that is still here", () => {
    const databases = [
      'admin',
      'config',
      'local',
      'villages',
      'villages-docker-roadmap-impl-03b5ca',
      'villages-long-gone-1a2b3c',
      'villages-deleted-without-a-trace',
      'somebody-elses',
    ];
    assert.deepEqual(goneWorlds(databases, readWorktrees(porcelain)), [
      'villages-deleted-without-a-trace',
      'villages-long-gone-1a2b3c',
    ]);
  });
});
