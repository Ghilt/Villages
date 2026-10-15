import { describe, expect, it } from 'vitest';

import { type Asking, bayLayout, RIGHT_WANTS, STRIP, TAB_BAR } from './bayBox';

const SPREAD = { w: 1568, h: 1080 };
const BIG: Asking = 'big';
const spread = (right: 'strip' | 'tabbedStrip') =>
  bayLayout(SPREAD, [BIG, BIG], { left: true, bottomLeft: 200, bottomMiddle: 'strip', right }, 'spread');

/**
 * The column down the right, put away when the dialogues and the quests take turns in it: a strip at its bottom with
 * room over it for their tab bar, at its normal width. See decision record 0096.
 */
describe('the right column put away with tabs', () => {
  it('keeps room for the tab bar over its strip', () => {
    expect(spread('tabbedStrip').bays.right).toEqual({
      x: SPREAD.w - RIGHT_WANTS,
      y: SPREAD.h - STRIP - TAB_BAR,
      w: RIGHT_WANTS,
      h: STRIP + TAB_BAR,
    });
    expect(spread('strip').bays.right?.h).toBe(STRIP);
  });
});
