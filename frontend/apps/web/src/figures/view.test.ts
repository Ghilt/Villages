import { describe, expect, it } from 'vitest';

import type { KeyFigureView } from '@villages/protocol';

import { stillOpen, viewOf } from './view';

function figure(id: string): KeyFigureView {
  return {
    id,
    givenName: id,
    familyName: 'Hollin',
    sex: 'woman',
    species: 'person',
    bornOn: 650_000,
    agedYears: 0,
    stats: { piety: 10, reason: 10, kindness: 10, physical: 10 },
    keyFigureOf: [],
    version: 1,
  };
}

const agnes = figure('agnes');
const bea = figure('bea');
const cis = figure('cis');

describe('what the key figures pane shows', () => {
  it('shows the empty words for a house with nobody', () => {
    expect(viewOf([], null)).toEqual({ kind: 'empty' });
  });

  it('opens a lone figure straight away, with no way back to a grid of one', () => {
    expect(viewOf([agnes], null)).toEqual({ kind: 'details', figure: agnes, back: false });
  });

  it('shows the grid for two or more, until one is pressed, and then them with the way back', () => {
    expect(viewOf([agnes, bea], null)).toEqual({ kind: 'grid', figures: [agnes, bea] });
    expect(viewOf([agnes, bea], 'bea')).toEqual({ kind: 'details', figure: bea, back: true });
  });
});

describe('which figure stays open as the list changes', () => {
  it('keeps a lone figure open when a second arrives, and the way back appears', () => {
    const open = stillOpen([agnes], null);

    expect(open).toBe('agnes');
    expect(viewOf([agnes, bea], open)).toEqual({ kind: 'details', figure: agnes, back: true });
  });

  it('goes back to the grid when the open figure leaves and two are left', () => {
    expect(stillOpen([bea, cis], 'agnes')).toBeNull();
    expect(viewOf([bea, cis], 'agnes')).toEqual({ kind: 'grid', figures: [bea, cis] });
  });

  it('opens the one who is left when the open figure leaves and one is', () => {
    expect(viewOf([bea], 'agnes')).toEqual({ kind: 'details', figure: bea, back: false });
  });

  it('comes to the empty words when the last one leaves', () => {
    expect(stillOpen([], 'agnes')).toBeNull();
    expect(viewOf([], 'agnes')).toEqual({ kind: 'empty' });
  });
});
