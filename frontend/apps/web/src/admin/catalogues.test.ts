import { readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { INSPECT_VIEWS } from './inspectViews';

/** The shelf, `world/catalogues/`, from this file's place in the tree. */
const SHELF = new URL('../../../../../world/catalogues/', import.meta.url);

/** Every catalogue on the shelf by its name: a file without its `.json`, or a folder. */
function catalogues(): string[] {
  return readdirSync(SHELF, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.name.endsWith('.json'))
    .map((entry) => entry.name.replace(/\.json$/, ''))
    .sort();
}

/**
 * Every catalogue has its page. A plan that adds a kind of content adds its catalogue under `world/catalogues/` and an
 * inspect page that reads and edits it, as steps of its own; this is the check that fails until the page is there,
 * and for a page that names a catalogue that is not. See decision record 0097 and `BUILDING-A-MECHANIC.md`.
 */
describe('the catalogues', () => {
  it('are on the shelf', () => {
    expect(catalogues()).toContain('structures');
  });

  it('each have an inspect page, and only one', () => {
    const shown = INSPECT_VIEWS.flatMap((view) => (view.catalogue === undefined ? [] : [view.catalogue]));
    expect(catalogues().filter((name) => !shown.includes(name))).toEqual([]);
    expect(shown.filter((name, at) => shown.indexOf(name) !== at)).toEqual([]);
  });

  it('are each there for the page that names one', () => {
    const named = INSPECT_VIEWS.flatMap((view) => (view.catalogue === undefined ? [] : [view.catalogue]));
    expect(named.filter((name) => !catalogues().includes(name))).toEqual([]);
  });
});
