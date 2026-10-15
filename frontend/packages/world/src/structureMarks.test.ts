import { describe, expect, it } from 'vitest';

import { RUIN_PICTURE } from './structureLooks.ts';
import { keyOfStructureMarkFile, markKey, structureMarkFile, structureMarkSvg } from './structureMarks.ts';

describe('a structure mark', () => {
  it('is saved as its type and found again by the same key', () => {
    expect(structureMarkFile('printingHouse')).toBe('printingHouse.png');
    expect(keyOfStructureMarkFile('printingHouse.png')).toBe(markKey('printingHouse'));
  });

  it('is saved as ruin for the ruin, which no type is called', () => {
    expect(structureMarkFile(RUIN_PICTURE)).toBe('ruin.png');
    expect(keyOfStructureMarkFile('ruin.png')).toBe(markKey(RUIN_PICTURE));
  });

  it('is not the record of placeholders, nor a picture of a culture', () => {
    expect(keyOfStructureMarkFile('placeholders.json')).toBeNull();
    expect(keyOfStructureMarkFile('castle-european.png')).toBeNull();
  });

  it('is drawn as tall as asked, a pin narrower than it is tall', () => {
    const svg = structureMarkSvg('castle', 130);
    expect(svg).toContain('height="130"');
    expect(svg).toContain('width="100"');
  });
});
