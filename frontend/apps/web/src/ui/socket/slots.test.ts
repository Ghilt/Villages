import { describe, expect, it } from 'vitest';

import { fullnessSaid, socketSaid, socketsOf } from './slots';
import type { SocketContent } from './slots';

const agnes: SocketContent = { kind: 'portrait', picture: 'agnes.webp', name: 'Agnes Hollin' };
const garrison: SocketContent = { kind: 'item', name: 'a garrison', amount: 40 };

describe("a slot's row of sockets", () => {
  it('draws what fills it first, then an empty place for each left', () => {
    expect(socketsOf([agnes], 3).map((one) => one.kind)).toEqual(['portrait', 'empty', 'empty']);
  });

  it('draws a question in every place of a slot the viewer is not told about, whatever is in it', () => {
    expect(socketsOf([agnes], 4, { secret: true }).map((one) => one.kind)).toEqual([
      'unknown',
      'unknown',
      'unknown',
      'unknown',
    ]);
  });

  it('past the most it has room for, says how many more in its last socket', () => {
    const court = Array.from({ length: 7 }, () => agnes);

    const drawn = socketsOf(court, 7, { most: 4 });

    expect(drawn.map((one) => one.kind)).toEqual(['portrait', 'portrait', 'portrait', 'more']);
    expect(drawn[3]).toEqual({ kind: 'more', count: 4 });
    expect(socketsOf(court, 7, { most: 7 })).toHaveLength(7);
  });

  it('says how full it is, and only how many places when the viewer is not told', () => {
    expect(fullnessSaid(2, 4)).toBe('2 of 4');
    expect(fullnessSaid(2, 4, true)).toBe('? of 4');
  });

  it('says each socket in words', () => {
    const every: SocketContent[] = [
      agnes,
      garrison,
      { kind: 'empty' },
      { kind: 'unknown' },
      { kind: 'more', count: 3 },
    ];

    expect(every.map((one) => socketSaid(one))).toEqual([
      'Agnes Hollin',
      `a garrison, ${(40).toLocaleString()}`,
      'an empty place',
      'not known',
      '3 more',
    ]);
  });
});
