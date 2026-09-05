import { describe, expect, it } from 'vitest';

import { whatToFollow } from './following';

describe('following the view', () => {
  it('asks for what is newly wanted and lets go of what is not wanted any more', () => {
    expect(whatToFollow(['1200', '1201'], ['1201', '1202'])).toEqual({ ask: ['1202'], letGo: ['1200'] });
  });

  it('asks for everything the first time', () => {
    expect(whatToFollow([], ['12', '13'])).toEqual({ ask: ['12', '13'], letGo: [] });
  });

  it('does nothing when the view has not really moved', () => {
    expect(whatToFollow(['1200', '1201'], ['1201', '1200'])).toEqual({ ask: [], letGo: [] });
  });

  it('lets everything go when nothing is wanted', () => {
    expect(whatToFollow(['1200'], [])).toEqual({ ask: [], letGo: ['1200'] });
  });

  it('asks for a zoomed-out view as new cells and lets the zoomed-in ones go, whatever they contain', () => {
    // Zooming from eight to four: none of the deep cells are wanted, all the shallow ones are.
    expect(whatToFollow(['12003122', '12003123'], ['1200'])).toEqual({
      ask: ['1200'],
      letGo: ['12003122', '12003123'],
    });
  });

  it('asks for a cell only once however many times the view names it', () => {
    expect(whatToFollow([], ['12', '12', '13']).ask).toEqual(['12', '13']);
  });
});
