import { describe, expect, it } from 'vitest';

import type { Description } from './describe';
import { sayingOrLastSaid } from './remembered';

const KETTLEBY: Description = {
  kind: 'House',
  name: 'Kettleby',
  facts: [
    { what: 'Seat', said: '51.2° N, 0.4° W' },
    { what: 'Wealth', said: '40', ticking: true },
  ],
  links: [],
};

/**
 * A window goes on saying what it last knew of a thing once the camera has left it, rather than asking the player
 * to pan back: Adam's word of 2026-10-07.
 */
describe('what a window last said', () => {
  it('is what it says while it can say something', () => {
    expect(sayingOrLastSaid({ kind: 'house', id: 'kettleby' }, KETTLEBY)).toBe(KETTLEBY);
  });

  it('is what it last said once it can say nothing, with nothing ticking', () => {
    sayingOrLastSaid({ kind: 'house', id: 'kettleby' }, KETTLEBY);
    const last = sayingOrLastSaid({ kind: 'house', id: 'kettleby' }, null);

    expect(last?.name).toBe('Kettleby');
    expect(last?.facts).toEqual([
      { what: 'Seat', said: '51.2° N, 0.4° W' },
      { what: 'Wealth', said: '40' },
    ]);
  });

  it('is nothing for a thing never said anything of, and never another thing of the same id', () => {
    sayingOrLastSaid({ kind: 'house', id: 'same' }, KETTLEBY);

    expect(sayingOrLastSaid({ kind: 'house', id: 'never' }, null)).toBeNull();
    expect(sayingOrLastSaid({ kind: 'character', id: 'same' }, null)).toBeNull();
  });
});
