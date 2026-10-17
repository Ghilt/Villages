import { describe, expect, it } from 'vitest';

import { CULTURES, RUIN_PIECES, ruinFrameKey } from '@villages/world';
import type { RuinsMapFile, SpriteMap } from '@villages/world';

import { ruinTilesAround } from './cellTiles';
import { asScenery, ruinKinds, withRuins } from './ruinsMap';

const file = {
  ring: 0.3,
  look: {
    pieces: RUIN_PIECES.map((name, at) => ({ name, height: 2 + at, width: 2, vary: 0.1 })),
  },
} as unknown as RuinsMapFile;

const trees = { kinds: [{ name: 'oak' }, { name: 'pine' }] } as unknown as SpriteMap;

describe('the ruins as the scenery draws them', () => {
  it('makes every piece in every culture a kind after the scenery’s own, named as its frame, standing still', () => {
    const kinds = ruinKinds(file);
    expect(kinds).toHaveLength(RUIN_PIECES.length * CULTURES.length);
    expect(kinds[0]!.name).toBe(ruinFrameKey('shell', 'european'));
    expect(kinds[CULTURES.length]!.name).toBe(ruinFrameKey('row', 'european'));
    expect(kinds.every((kind) => kind.apart === 0)).toBe(true);
    expect(withRuins(trees, file).kinds.slice(0, 2)).toEqual(trees.kinds);
    expect(withRuins(trees, null)).toBe(trees);
  });

  it('draws a piece as the kind of its piece in its culture', () => {
    const drawn = withRuins(trees, file);
    const point = asScenery(trees, { x: 1, y: 2, piece: 3, culture: 1, rank: 0.5, height: 4 });
    expect(drawn.kinds[point.kind]!.name).toBe(ruinFrameKey('hall', 'islamic'));
    expect(point).toMatchObject({ x: 1, y: 2, rank: 0.5, height: 4 });
  });

  it('reads the ruins of the tiles under a cell and the eight about it, and no more', () => {
    // A cell in the middle of a tile reads that tile alone; one on a tile's corner reads the four about it.
    expect(ruinTilesAround(4 * 8 + 3, 4 * 8 + 3)).toEqual([{ x: 4, y: 4 }]);
    expect(ruinTilesAround(4 * 8, 4 * 8)).toEqual([
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ]);
  });
});
