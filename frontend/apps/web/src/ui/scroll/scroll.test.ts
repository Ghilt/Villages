import { describe, expect, it } from 'vitest';

import { edgesOf, moreOf } from './scroll';

describe('a scroll area’s edges', () => {
  it('has more after and nothing before at the start', () => {
    expect(edgesOf(0, 200, 600)).toEqual({ before: false, after: true });
  });

  it('has more both ways part of the way along', () => {
    expect(moreOf(edgesOf(150, 200, 600))).toBe('before after');
  });

  it('has nothing after at the end, though a zoomed screen stops it a fraction short', () => {
    expect(edgesOf(399.4, 200, 600)).toEqual({ before: true, after: false });
  });

  it('has nothing either way when everything is in view', () => {
    expect(moreOf(edgesOf(0, 200, 200))).toBe('');
  });
});
