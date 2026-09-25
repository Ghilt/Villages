import { describe, expect, it } from 'vitest';

import { outOfRoom, type Stacked } from './rail';

/**
 * The rail out of room keeps one pane open, which is decision record 0058.
 *
 * Three windows, top first; a strip is 38 tall and an open window whatever it says.
 */
const open = (id: string, tall: number): Stacked => ({ id, asked: 'full', tall });
const away = (id: string): Stacked => ({ id, asked: 'strip', tall: 38 });
const GAP = 10;

describe('the rail out of room', () => {
  it('puts nothing away while everything fits, to the pixel', () => {
    expect(outOfRoom([open('a', 200), open('b', 190)], 400, GAP)).toEqual([]);
  });

  it('keeps the top one open and puts away every other open one, once they no longer fit', () => {
    expect(outOfRoom([open('a', 200), open('b', 190), open('c', 150)], 400, GAP)).toEqual(['b', 'c']);
  });

  // The top one the player put away is not the one to keep: the first they have not is.
  it('keeps the first open one when the top one was already put away', () => {
    expect(outOfRoom([away('a'), open('b', 300), open('c', 300)], 400, GAP)).toEqual(['c']);
  });

  // One pane taller than the whole rail has nothing to give way to it, and nothing is put away.
  it('leaves a lone open pane alone, however tall it is', () => {
    expect(outOfRoom([open('a', 900), away('b'), away('c')], 400, GAP)).toEqual([]);
  });

  // What was put away is not counted twice: once only one is open, putting away again changes nothing,
  // which is what stops the stage from measuring and writing for ever.
  it('asks for nothing more once only one is open', () => {
    const after = [open('a', 380), away('b'), away('c')];

    expect(outOfRoom(after, 400, GAP)).toEqual([]);
  });

  it('counts the air between them', () => {
    expect(outOfRoom([open('a', 200), open('b', 195)], 400, GAP)).toEqual(['b']);
  });
});
