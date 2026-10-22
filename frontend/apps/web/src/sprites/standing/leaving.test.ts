import { describe, expect, it } from 'vitest';

import { removeAll } from './leaving';

describe('taking trees out', () => {
  it('takes out every one that goes, keeps the rest in their order, and changes the very list it was handed', () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    const held = list;
    removeAll(list, new Set(['b', 'd', 'x']));
    expect(held).toEqual(['a', 'c', 'e']);
  });

  it('leaves the list alone when nothing goes', () => {
    const list = [1, 2, 3];
    removeAll(list, new Set());
    expect(list).toEqual([1, 2, 3]);
  });
});
