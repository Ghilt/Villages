import { describe, expect, it } from 'vitest';

import { splashOf } from './splash';

const TREE = { x: 0, y: 0, kind: 'broadleaf', height: 3 };
const RUIN = { x: 0, y: 0, kind: 'ruin:hall-european', height: 8 };

describe('what a die throws up where it strikes', () => {
  it('is a splash on water, whatever stands by it', () => {
    expect(splashOf('lake', [TREE])).toBe('water');
    expect(splashOf('ocean', [])).toBe('water');
  });

  it('is leaves in a wood, or under a tree standing anywhere, but not by a ruin', () => {
    expect(splashOf('mixed-forest', [])).toBe('leaves');
    expect(splashOf('meadow', [TREE])).toBe('leaves');
    expect(splashOf('meadow', [RUIN])).toBe('dust');
  });

  it('is sand on sand, grit on rock, snow on ice, and dust anywhere else or where the ground is not known', () => {
    expect(splashOf('desert-sand', [])).toBe('sand');
    expect(splashOf('bare-rock', [])).toBe('grit');
    expect(splashOf('ice', [])).toBe('snow');
    expect(splashOf('farmland', [])).toBe('dust');
    expect(splashOf(null, [])).toBe('dust');
  });
});
