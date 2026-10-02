import { describe, expect, it } from 'vitest';

import { stepTo } from './tabs';

const all = [true, true, true, true];

describe('the keyboard along a tab bar', () => {
  it('goes to the next and the previous tab with the arrows', () => {
    expect(stepTo(1, 'ArrowRight', all)).toBe(2);
    expect(stepTo(1, 'ArrowLeft', all)).toBe(0);
  });

  it('comes round at the ends', () => {
    expect(stepTo(3, 'ArrowRight', all)).toBe(0);
    expect(stepTo(0, 'ArrowLeft', all)).toBe(3);
  });

  it('goes to the first and the last with Home and End', () => {
    expect(stepTo(2, 'Home', all)).toBe(0);
    expect(stepTo(1, 'End', all)).toBe(3);
  });

  it('passes over a tab that cannot be chosen', () => {
    const second = [true, false, true, false];
    expect(stepTo(0, 'ArrowRight', second)).toBe(2);
    expect(stepTo(2, 'ArrowRight', second)).toBe(0);
    expect(stepTo(0, 'ArrowLeft', second)).toBe(2);
    expect(stepTo(2, 'End', second)).toBe(2);
    expect(stepTo(2, 'Home', [false, false, true, true])).toBe(2);
  });

  it('leaves every other key to whatever else wants it', () => {
    expect(stepTo(1, 'ArrowDown', all)).toBeNull();
    expect(stepTo(1, 'a', all)).toBeNull();
  });
});
