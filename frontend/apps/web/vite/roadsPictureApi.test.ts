import { describe, expect, it } from 'vitest';

import { masterAsked } from './roadsPictureApi.ts';

describe("the roads picture's route", () => {
  it('answers a master by its name', () => {
    expect(masterAsked('/terrain3_mended_2026-10-03')).toBe('terrain3_mended_2026-10-03');
    expect(masterAsked('/terrain3_mended_2026-10-03?v=2')).toBe('terrain3_mended_2026-10-03');
  });

  it('answers nothing that could reach out of the folder, nor any other file in it', () => {
    expect(masterAsked('/..')).toBeNull();
    expect(masterAsked('/../secrets')).toBeNull();
    expect(masterAsked('/a/b')).toBeNull();
    expect(masterAsked('/a%2F..')).toBeNull();
    expect(masterAsked('/')).toBeNull();
  });
});
