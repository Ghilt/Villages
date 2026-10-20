import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PROJECTS, tsconfigOf } from './projects';

const FRONTEND = fileURLToPath(new URL('../', import.meta.url));

/** The frontend's tsconfigs, tracked or new, from git, so that no other worktree or install is counted. */
function tsconfigs(): string[] {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*tsconfig*.json'],
    {
      cwd: FRONTEND,
      encoding: 'utf8',
    },
  )
    .split(/\r?\n/)
    .filter((file) => file !== '' && file !== 'tsconfig.base.json');
}

describe("the frontend's typecheck", () => {
  it('checks every tsconfig in the frontend, the shared base apart', () => {
    expect(tsconfigs().sort()).toEqual(PROJECTS.map(tsconfigOf).sort());
  });
});
