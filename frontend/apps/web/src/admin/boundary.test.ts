import { describe, expect, it } from 'vitest';

/**
 * The inspect pages are cordoned off from the game.
 *
 * They are instruments for looking into the game, and they may carry what an instrument needs - a diagram
 * library, say - without any of it reaching a player. So three rules hold, each by name, see decision 0091:
 * the game never imports an inspect page, and the page's entry reaches them only by `import()`, so each is
 * its own chunk that the game's bundle does not contain; the libraries only they use are imported nowhere
 * else; and what they take from the game is named here, folder by folder, and nothing more.
 */

/** Libraries for the inspect pages alone. */
const ADMIN_ONLY_PACKAGES = [/^@xyflow\/react/, /^@dagrejs\/dagre/];

/**
 * The game's folders an inspect page may take from: the socket, the component library, the portraits, and the log,
 * whose lines the logs' page reads as the debug panel does.
 */
const GAME_TAKEN = ['net', 'ui', 'figures', 'log'];

/** What the entry may import from the inspect pages without `import()`: the list of them, for routing. */
const ENTRY_STATIC = ['./admin/inspectViews'];

/** Every source of the page, each named from `src/`'s point of view: `../admin/…`, `../net/…`, `../main.tsx`. */
const SOURCES = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../**/*.{ts,tsx,css}', { query: '?raw', import: 'default', eager: true }),
  ).map(([file, source]) => [file.replace(/^\.\//, '../admin/'), source]),
);

/** A source's static imports, and the modules it imports with `import()`. */
function importsOf(source: string): { static: string[]; dynamic: string[] } {
  const staticPatterns = [
    /\b(?:import|export)\s[^'";]*?\sfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g,
  ];
  const all = (patterns: RegExp[]) => [
    ...new Set(patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]!))),
  ];
  return { static: all(staticPatterns), dynamic: all([/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g]) };
}

/** Where an import lands, as a path under `src/`: `admin/…`, `net/…`, `main.tsx`. */
function landsAt(from: string, named: string): string {
  return new URL(named, new URL(from.replace(/^\.\.\//, ''), 'file:///src/')).pathname.replace(
    /^\/src\//,
    '',
  );
}

const inAdmin = (file: string) => file.startsWith('../admin/');
const isTest = (file: string) => /\.test\.tsx?$/.test(file);

describe('the inspect pages', () => {
  it('have sources to hold to the rules', () => {
    expect(Object.keys(SOURCES).filter(inAdmin).length).toBeGreaterThan(10);
  });

  it('are imported by nothing in the game, and by the entry only with import()', () => {
    const strays: string[] = [];
    for (const [file, source] of Object.entries(SOURCES)) {
      if (inAdmin(file) || isTest(file)) continue;
      const { static: statics } = importsOf(source);
      for (const named of statics.filter((n) => n.startsWith('.'))) {
        if (!landsAt(file, named).startsWith('admin/')) continue;
        if (file === '../main.tsx' && ENTRY_STATIC.includes(named)) continue;
        strays.push(`${file} imports ${named}`);
      }
    }
    expect(strays).toEqual([]);
  });

  it('keep their own libraries to themselves', () => {
    const strays = Object.entries(SOURCES)
      .filter(([file]) => !inAdmin(file))
      .flatMap(([file, source]) => {
        const { static: s, dynamic: d } = importsOf(source);
        return [...s, ...d]
          .filter((n) => ADMIN_ONLY_PACKAGES.some((p) => p.test(n)))
          .map((n) => `${file} imports ${n}`);
      });
    expect(strays).toEqual([]);
  });

  it('take from the game only what is named', () => {
    const strays: string[] = [];
    for (const [file, source] of Object.entries(SOURCES)) {
      if (!inAdmin(file) || isTest(file)) continue;
      const { static: s, dynamic: d } = importsOf(source);
      for (const named of [...s, ...d].filter((n) => n.startsWith('.'))) {
        const at = landsAt(file, named);
        if (at.startsWith('admin/')) continue;
        if (!GAME_TAKEN.includes(at.split('/')[0]!)) strays.push(`${file} imports ${named}`);
      }
    }
    expect(strays).toEqual([]);
  });
});
