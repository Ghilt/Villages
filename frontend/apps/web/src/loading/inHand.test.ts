import { describe, expect, it } from 'vitest';

import { begin, inHandStore, whileInHand } from './inHand';

describe('the work in hand', () => {
  it('holds each work from its beginning to its end, the same work begun twice twice', () => {
    const first = begin('the scenery');
    const second = begin('the scenery');
    const other = begin('the critters');

    expect(inHandStore.get().works).toEqual(['the scenery', 'the scenery', 'the critters']);

    first();
    first();
    other();

    expect(inHandStore.get().works).toEqual(['the scenery']);

    second();

    expect(inHandStore.get().works).toEqual([]);
  });

  it('lets a work go once it has settled, failed or not', async () => {
    const failing = whileInHand('the atlas', Promise.reject(new Error('gone')));

    expect(inHandStore.get().works).toEqual(['the atlas']);

    await expect(failing).rejects.toThrow('gone');

    expect(inHandStore.get().works).toEqual([]);
  });
});
