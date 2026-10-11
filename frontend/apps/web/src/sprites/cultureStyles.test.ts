import { describe, expect, it } from 'vitest';

import { pictureKey, styled } from './cultureStyles';
import { pictureFor } from './structureShapes';

describe('a structure drawn in a culture', () => {
  const castle = pictureFor('castle', false);

  it('is the picture as drawn in the European way', () => {
    expect(styled(castle, 'european')).toBe(castle);
  });

  it("takes the culture's colours and a crown on what is tallest, the pennant over the crown", () => {
    for (const culture of ['islamic', 'eastAsian', 'african'] as const) {
      const drawn = styled(castle, culture);

      expect(drawn.parts.length).toBeGreaterThan(castle.parts.length);
      expect(drawn.flag[1]).toBeLessThan(castle.flag[1]);
      expect(drawn.flag[0]).toBe(castle.flag[0]);
    }
    // Stone becomes the sandstone of the Islamic look, and the mud of the African.
    expect(styled(castle, 'islamic').parts[0]).not.toEqual(castle.parts[0]);
    expect(styled(castle, 'islamic').parts[0]).not.toEqual(styled(castle, 'african').parts[0]);
  });

  it('is asked for by what it is and the culture it is drawn in, European with none', () => {
    expect(pictureKey('mill', 'african')).toBe('mill@african');
    expect(pictureKey('a ruin', null)).toBe('a ruin@european');
  });
});
