import { describe, expect, it } from 'vitest';

import { groupMarks } from './markGroups';
import type { Placed } from './markGroups';

const pin = (id: string, x: number, significance: number, y = 100): Placed => ({
  id,
  x,
  y,
  width: 34,
  height: 44,
  significance,
});

describe('a crowd of marks far out', () => {
  it('is led by the most significant of it, and the rest are its members in rank order', () => {
    const groups = groupMarks([pin('mill', 0, 8), pin('cathedral', 10, 40), pin('castle', 20, 20)]);

    expect([...groups.led.keys()]).toEqual(['cathedral']);
    expect(groups.led.get('cathedral')).toEqual(['cathedral', 'castle', 'mill']);
    expect(groups.leaderOf.get('mill')).toBe('cathedral');
    expect(groups.leaderOf.has('cathedral')).toBe(false);
  });

  it('breaks a tie by id, so the same crowd always shows the same mark', () => {
    const one = groupMarks([pin('b', 0, 20), pin('a', 5, 20)]);
    const other = groupMarks([pin('a', 5, 20), pin('b', 0, 20)]);

    expect([...one.led.keys()]).toEqual(['a']);
    expect(other.led).toEqual(one.led);
  });

  it('leaves marks that do not overlap alone, each a group of one', () => {
    const groups = groupMarks([pin('a', 0, 20), pin('b', 100, 20)]);

    expect(groups.led.get('a')).toEqual(['a']);
    expect(groups.led.get('b')).toEqual(['b']);
    expect(groups.leaderOf.size).toBe(0);
  });

  it('never creeps along a chain: a mark touching only a member leads its own group', () => {
    // a touches b, b touches c, but a does not touch c.
    const groups = groupMarks([pin('a', 0, 30), pin('b', 30, 20), pin('c', 60, 10)]);

    expect(groups.led.get('a')).toEqual(['a', 'b']);
    expect(groups.led.get('c')).toEqual(['c']);
  });

  it('tells marks standing one above the other apart from marks at the same height', () => {
    const groups = groupMarks([pin('a', 0, 20, 100), pin('b', 0, 10, 200)]);

    expect(groups.leaderOf.size).toBe(0);
  });
});
