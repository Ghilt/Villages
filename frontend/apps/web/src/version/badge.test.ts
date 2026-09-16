import { PROTOCOL_VERSION } from '@villages/protocol';
import { describe, expect, it } from 'vitest';

import { badgeText, readBuild } from './badge';

describe('the corner label', () => {
  it('names the branch, the commit and the wire', () => {
    expect(badgeText({ branch: 'main', commit: '2862d53', dirty: false })).toBe(
      `main · 2862d53 · wire v${PROTOCOL_VERSION}`,
    );
  });

  it('marks a tree with changes in it', () => {
    expect(badgeText({ branch: 'main', commit: '2862d53', dirty: true })).toContain('2862d53+');
  });

  it('cuts a branch name too long for the corner, keeping the half that says which it is', () => {
    const said = badgeText({
      branch: 'claude/gameplay-loop-iteration-one-d71e80',
      commit: '2862d53',
      dirty: false,
    });

    expect(said).toContain('claude/gameplay-loop-it…');
    expect(said).toContain('2862d53');
  });

  it('leaves a name that fits alone', () => {
    expect(badgeText({ branch: 'main', commit: 'abc1234', dirty: false })).toContain('main · abc1234');
  });

  it('still says what it speaks when there is no dev server to ask', () => {
    expect(badgeText(null)).toBe(`wire v${PROTOCOL_VERSION}`);
  });

  it('leaves out what git could not answer', () => {
    expect(badgeText({ branch: '', commit: '', dirty: false })).toBe(`wire v${PROTOCOL_VERSION}`);
  });
});

describe('what came back from the dev server', () => {
  it('is read when it is a build', () => {
    expect(readBuild({ branch: 'main', commit: 'abc1234', dirty: false })).toEqual({
      branch: 'main',
      commit: 'abc1234',
      dirty: false,
    });
  });

  it('is refused when it is anything else', () => {
    expect(readBuild(null)).toBeNull();
    expect(readBuild('main')).toBeNull();
    expect(readBuild({ branch: 'main' })).toBeNull();
    expect(readBuild({ branch: 'main', commit: 1, dirty: false })).toBeNull();
  });
});
