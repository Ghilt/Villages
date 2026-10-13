import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { WORLD_STEPS } from '../../../../../packages/world/bin/lib/worldSteps.ts';

import { WORLD_CACHE } from './cache';
import { STAGES } from './starting';
import {
  ARTIFACTS,
  LEGACY,
  READERS,
  TOOLS,
  downstreamOf,
  readersOf,
  toolsReading,
  upstreamOf,
} from './world';

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

  it('reads every baked file, or says that only an agent at work does', () => {
    // A file made and then read by nothing is an arrow missing from the page, as the culture map's and the structure
    // atlas's were, or a file only an agent looks at, drawn with the robot; or it is waste, as the lookup grid was,
    // the preview again beside the tiles, and is not made.
    const unread = ARTIFACTS.filter(
      (a) =>
        a.origin === 'baked' &&
        readersOf(a.id).length === 0 &&
        toolsReading(a.id).length === 0 &&
        a.development === undefined,
    ).map((a) => a.id);
    expect(unread).toEqual([]);
  });

  it('marks for development only what the game and its tools never read', () => {
    const read = (id: string) => readersOf(id).length > 0 || toolsReading(id).length > 0;
    const files = ARTIFACTS.filter((a) => a.development !== undefined && read(a.id));
    const tools = TOOLS.filter(
      (t) =>
        t.development !== undefined &&
        t.writes.some((id) => read(id) || !ARTIFACTS.find((a) => a.id === id)!.development),
    );
    expect([...files.map((a) => a.id), ...tools.map((t) => t.script)]).toEqual([]);
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

  it('draws every world step as its tool, reading what the step is made from and writing what it makes', () => {
    // The world cache files a step under a fingerprint of what the step table says it is made from (0095), so a
    // file the page knows a tool reads that the table leaves out would be a world borrowed that is not current.
    const drift = WORLD_STEPS.flatMap((step) => {
      const tool = TOOLS.find((t) => t.entry === step.tool.slice(step.tool.lastIndexOf('/') + 1));
      if (tool === undefined) return [`${step.name}: no tool on the page`];
      return [
        ...[...step.from.map((input) => input.is), ...step.after]
          .filter((is) => !tool.reads.includes(is))
          .map((is) => `${step.name} is made from ${is}, which the page's ${tool.script} does not read`),
        ...step.makes
          .map((made) => made.is)
          .filter((is) => !tool.writes.includes(is))
          .map((is) => `${step.name} makes ${is}, which the page's ${tool.script} does not write`),
      ];
    });
    expect(drift).toEqual([]);
  });

  it("draws in the world cache's box exactly the world steps' tools and what they make, in their order", () => {
    const scripts = WORLD_STEPS.map((step) => {
      const entry = step.tool.slice(step.tool.lastIndexOf('/') + 1);
      return TOOLS.find((t) => t.entry === entry)?.script;
    });
    expect([...WORLD_CACHE.tools]).toEqual(scripts);
    const made = [...new Set(WORLD_STEPS.flatMap((step) => step.makes.map((one) => one.is)))].sort();
    expect([...WORLD_CACHE.files].sort()).toEqual(made);
  });

  it('starts a tree as the quick start does, part by part and in its order', () => {
    const script = readFileSync(fromRoot('debug-quick-start.ps1'), 'utf8');
    const at = STAGES.map((stage) => script.indexOf(stage.says));
    expect(STAGES.filter((_, i) => at[i] === -1).map((stage) => stage.says)).toEqual([]);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('traces the terrain tiles back to the master, and the master on to both programs', () => {
    expect([...upstreamOf('tiles').files].sort()).toEqual(['master', 'palette', 'render']);
    const down = downstreamOf('master');
    expect(down.readers.has('world-style')).toBe(true);
    expect(down.readers.has('folder-ground')).toBe(true);
    expect(down.files.has('height')).toBe(true);
  });
});
