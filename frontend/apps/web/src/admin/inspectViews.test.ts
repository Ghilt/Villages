import { describe, expect, it } from 'vitest';

import { INSPECT_INDEX, INSPECT_VIEWS, inspectViewAt, isInspectIndex } from './inspectViews';

describe('the inspect views', () => {
  it('each stand under the index, at an address of their own and with a name of their own', () => {
    const paths = INSPECT_VIEWS.map((view) => view.path);
    expect(paths.filter((path) => !path.startsWith(`${INSPECT_INDEX}/inspect-`))).toEqual([]);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(INSPECT_VIEWS.map((view) => view.title)).size).toBe(INSPECT_VIEWS.length);
  });

  it('are found at their own address and under it, and never at one that only starts the same', () => {
    for (const view of INSPECT_VIEWS) {
      expect(inspectViewAt(view.path)).toBe(view);
      expect(inspectViewAt(`${view.path}/anything`)).toBe(view);
      expect(inspectViewAt(`${view.path}s`)).toBeUndefined();
    }
  });

  it('leave the index and the game to themselves', () => {
    expect(inspectViewAt(INSPECT_INDEX)).toBeUndefined();
    expect(inspectViewAt('/')).toBeUndefined();
    expect(isInspectIndex(INSPECT_INDEX)).toBe(true);
    expect(isInspectIndex(`${INSPECT_INDEX}/`)).toBe(true);
    expect(isInspectIndex(INSPECT_VIEWS[0]!.path)).toBe(false);
  });
});
