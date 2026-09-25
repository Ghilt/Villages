import { afterEach, describe, expect, it, vi } from 'vitest';

import { forgetSpriteMap, standsOfTile } from './spriteMap';

describe('the stands of a tile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    forgetSpriteMap();
  });

  it('tells every cell that asked while the chunk was coming, not just the first', async () => {
    // A tile no chunk was generated for, so the answer is no stands: what matters is who is told.
    let answer: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((settle) => (answer = settle))),
    );

    const told: string[] = [];
    expect(standsOfTile('/world/x', 'biome', 67, 43, 128, () => told.push('first'))).toBeNull();
    expect(standsOfTile('/world/x', 'biome', 67, 43, 128, () => told.push('second'))).toBeNull();
    expect(standsOfTile('/world/x', 'biome', 67, 43, 128, () => told.push('third'))).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);

    answer(new Response(null, { status: 404 }));
    await vi.waitFor(() => expect(told).toHaveLength(3));
    expect(told).toEqual(['first', 'second', 'third']);
    // And once it is in, it is simply there.
    expect(standsOfTile('/world/x', 'biome', 67, 43, 128, () => told.push('late'))).not.toBeNull();
  });
});
