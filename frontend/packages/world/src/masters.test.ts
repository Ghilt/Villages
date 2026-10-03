import { describe, expect, it } from 'vitest';

import { DEFAULT_MASTER, isSafeMasterName, masterNameOf, worldDirOf } from './masters.ts';

describe('deciding which files in world/master are masters', () => {
  it('takes a PNG as the master it is named after', () => {
    expect(masterNameOf('terrain.png')).toBe('terrain');
    expect(masterNameOf('terrain2.png')).toBe('terrain2');
    expect(masterNameOf('terrain_test_filled.png')).toBe('terrain_test_filled');
  });

  it('takes the generated base, which is a world you can look at', () => {
    expect(masterNameOf('terrain-base.png')).toBe('terrain-base');
  });

  it('refuses the previews the importer writes, or they would be offered as worlds', () => {
    expect(masterNameOf('terrain-preview.png')).toBeNull();
    expect(masterNameOf('terrain2-preview.png')).toBeNull();
  });

  it('takes a master with its rivers mended, and refuses the audit of what was painted', () => {
    expect(masterNameOf('terrain3_mended_2026-10-03.png')).toBe('terrain3_mended_2026-10-03');
    expect(masterNameOf('terrain3_mended_audit_2026-10-03.png')).toBeNull();
  });

  it('refuses the palette strip, which is a picture of the palette', () => {
    expect(masterNameOf('palette-strip.png')).toBeNull();
  });

  it('refuses anything that is not a PNG', () => {
    expect(masterNameOf('terrain.psd')).toBeNull();
    expect(masterNameOf('notes.md')).toBeNull();
    expect(masterNameOf('.png')).toBeNull();
  });

  it('reads the extension whatever case it is written in', () => {
    expect(masterNameOf('Terrain.PNG')).toBe('Terrain');
  });
});

describe('a master name becoming a path', () => {
  it('gives every master its own directory, the default one included', () => {
    expect(worldDirOf(DEFAULT_MASTER)).toBe('masters/terrain3_mended_2026-10-03');
    expect(worldDirOf('terrain')).toBe('masters/terrain');
    expect(worldDirOf('terrain2')).toBe('masters/terrain2');
  });

  it('accepts the names a painter actually uses', () => {
    for (const name of ['terrain', 'terrain2', 'terrain-base', 'terrain_test_filled', 'v1.2']) {
      expect(isSafeMasterName(name)).toBe(true);
    }
  });

  it('refuses anything that could leave the folder, because the name arrives from a browser', () => {
    for (const name of ['..', '../terrain', 'a/../b', 'a..b', 'sub/dir', 'C:\\windows', '', '.hidden']) {
      expect(isSafeMasterName(name)).toBe(false);
    }
  });
});
