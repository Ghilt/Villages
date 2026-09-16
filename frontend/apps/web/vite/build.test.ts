import { describe, expect, it } from 'vitest';

import { describeBuild } from './build.ts';

/** A git that answers from a table, and throws for anything it was not told about, as the real one does. */
function gitSaying(answers: Record<string, string>) {
  return (args: string[]): string => {
    const said = answers[args.join(' ')];
    if (said === undefined) {
      throw new Error(`fatal: not a git repository (asked: git ${args.join(' ')})`);
    }
    return said;
  };
}

describe('the build in the corner', () => {
  it('is the branch, the commit and whether anything is changed', () => {
    const git = gitSaying({
      'rev-parse --abbrev-ref HEAD': 'main\n',
      'rev-parse --short HEAD': '2862d53\n',
      'status --porcelain --untracked-files=no': '',
    });

    expect(describeBuild(git)).toEqual({ branch: 'main', commit: '2862d53', dirty: false });
  });

  it('counts tracked changes as changed', () => {
    const git = gitSaying({
      'rev-parse --abbrev-ref HEAD': 'claude/something\n',
      'rev-parse --short HEAD': 'abc1234\n',
      'status --porcelain --untracked-files=no': ' M CLAUDE.md\n',
    });

    expect(describeBuild(git).dirty).toBe(true);
  });

  it('says nothing rather than failing when git cannot answer', () => {
    expect(describeBuild(gitSaying({}))).toEqual({ branch: '', commit: '', dirty: false });
  });
});
