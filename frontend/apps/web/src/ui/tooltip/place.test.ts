import { describe, expect, it } from 'vitest';

import { inWindow, placeTooltip } from './place';

const window = { width: 800, height: 600 };
const box = { width: 120, height: 30 };

describe('a tooltip placed', () => {
  it('stands centred above what it is about', () => {
    expect(placeTooltip({ left: 340, top: 300, width: 40, height: 40 }, box, window)).toEqual({
      left: 300,
      top: 262,
      side: 'above',
    });
  });

  it('goes below when there is no room above', () => {
    expect(placeTooltip({ left: 340, top: 20, width: 40, height: 40 }, box, window)).toEqual({
      left: 300,
      top: 68,
      side: 'below',
    });
  });

  it('stays above when there is no room either way, rather than jumping about', () => {
    expect(
      placeTooltip({ left: 340, top: 20, width: 40, height: 40 }, box, { width: 800, height: 90 }).side,
    ).toBe('above');
  });

  it('goes below first when it is asked to, and above when there is no room below', () => {
    expect(placeTooltip({ left: 340, top: 300, width: 40, height: 40 }, box, window, 'below').side).toBe(
      'below',
    );
    expect(placeTooltip({ left: 340, top: 550, width: 40, height: 40 }, box, window, 'below').side).toBe(
      'above',
    );
  });

  it('is not drawn at all for something scrolled out of the window', () => {
    expect(inWindow({ left: 340, top: -60, width: 40, height: 40 }, window)).toBe(false);
    expect(inWindow({ left: 340, top: 640, width: 40, height: 40 }, window)).toBe(false);
    expect(inWindow({ left: 340, top: -20, width: 40, height: 40 }, window)).toBe(true);
  });

  it('never runs past the window’s edge', () => {
    expect(placeTooltip({ left: 0, top: 300, width: 20, height: 20 }, box, window).left).toBe(8);
    expect(placeTooltip({ left: 790, top: 300, width: 10, height: 20 }, box, window).left).toBe(672);
  });
});
