import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ARTIFACTS, LEGACY, READERS, TOOLS, downstreamOf, upstreamOf } from './world';

/** A path from the repository's root. */
const fromRoot = (path: string) => new URL(`../../../../../../${path}`, import.meta.url);

const ids = new Set(ARTIFACTS.map((a) => a.id));

/**
 * The architecture page is only worth reading while it is true, so it is held to the repository: a world tool
 * added without a place on it fails here, and so does a reader that has moved or a file nothing makes.
 */
describe('the architecture page', () => {
  it('has a place for every world script, or calls it legacy', () => {
    const pkg = JSON.parse(readFileSync(fromRoot('frontend/package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const known = new Set([...TOOLS.map((t) => t.script), ...LEGACY.map((l) => l.script)]);
    const missing = Object.keys(pkg.scripts).filter((s) => s.startsWith('world:') && !known.has(s));
    expect(missing).toEqual([]);
  });

  it("names every tool's entry file as it is", () => {
    const gone = TOOLS.filter((t) => {
      const at = t.entry.startsWith('scripts/') ? t.entry : `frontend/packages/world/bin/${t.entry}`;
      return !existsSync(fromRoot(at));
    }).map((t) => t.entry);
    expect(gone).toEqual([]);
  });

  it('reads and writes only files it lists', () => {
    const unknown = [
      ...TOOLS.flatMap((t) => [...t.reads, ...t.writes]),
      ...READERS.flatMap((r) => r.reads),
    ].filter((id) => !ids.has(id));
    expect(unknown).toEqual([]);
  });

  it('has a tool for every baked file', () => {
    const orphans = ARTIFACTS.filter(
      (a) => a.origin === 'baked' && !TOOLS.some((t) => t.writes.includes(a.id)),
    ).map((a) => a.id);
    expect(orphans).toEqual([]);
  });

  it('names every reader of the running game where it is', () => {
    const gone = READERS.flatMap((r) =>
      r.where.split(', ').map((file, i, all) => {
        // "map/relief.ts, reliefTiles.ts": a second file is in the first one's folder.
        const folder = i === 0 ? '' : all[0]!.slice(0, all[0]!.lastIndexOf('/') + 1);
        return r.program === 'page'
          ? `frontend/apps/web/src/${folder}${file}`
          : `backend/app/src/main/kotlin/villages/app/${file}`;
      }),
    ).filter((path) => !existsSync(fromRoot(path)));
    expect(gone).toEqual([]);
  });

  it('traces the terrain tiles back to the master, and the master on to both programs', () => {
    expect([...upstreamOf('tiles').files].sort()).toEqual(['master', 'palette', 'render']);
    const down = downstreamOf('master');
    expect(down.readers.has('world-style')).toBe(true);
    expect(down.readers.has('folder-ground')).toBe(true);
    expect(down.files.has('height')).toBe(true);
  });
});
