import { describe, expect, it } from 'vitest';

import { tinctureSchema } from '@villages/protocol';

import { tinctureColour } from './tinctures';

describe('the tinctures as colours', () => {
  it('has a colour for every tincture the protocol can name, so a banner can never be drawn blank', () => {
    for (const tincture of tinctureSchema.options) {
      const colour = tinctureColour(tincture);

      expect(Number.isInteger(colour)).toBe(true);
      expect(colour).toBeGreaterThanOrEqual(0);
      expect(colour).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('keeps the metals light and the colours dark, which is what the rule of tincture is for', () => {
    const luminance = (rgb: number) =>
      (0.299 * ((rgb >> 16) & 0xff) + 0.587 * ((rgb >> 8) & 0xff) + 0.114 * (rgb & 0xff)) / 255;

    for (const metal of ['or', 'argent'] as const) {
      for (const colour of ['gules', 'azure', 'sable', 'vert', 'purpure'] as const) {
        expect(luminance(tinctureColour(metal))).toBeGreaterThan(luminance(tinctureColour(colour)));
      }
    }
  });
});
