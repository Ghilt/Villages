import { PROTOCOL_VERSION } from '@villages/protocol';
import { describe, expect, it } from 'vitest';

import { badgeText, readBuild } from './badge';

describe('the corner label', () => {
  it('says the commit and the wire, the branch being shown apart', () => {
    expect(badgeText({ branch: 'main', commit: '2862d53', dirty: false })).toBe(
      `2862d53 · wire v${PROTOCOL_VERSION}`,
    );
  });

  it('marks a tree with changes in it', () => {
    expect(badgeText({ branch: 'main', commit: '2862d53', dirty: true })).toContain('2862d53+');
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
