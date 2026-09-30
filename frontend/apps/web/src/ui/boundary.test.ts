import { describe, expect, it } from 'vitest';

/**
 * The library imports nothing from the game.
 *
 * It knows no house, no event and no gateway: a pane hands it words, numbers and callbacks. That is what
 * lets /admin/inspect-ui-components show every component with nothing running, and what lets a pane take
 * a component up without taking the rest of the game with it. So every import in `src/ui/` either stays
 * inside `src/ui/` or names one of the few packages below. See docs/UI-COMPONENTS.md.
 */
const PACKAGES_ALLOWED = [/^react$/, /^react\/jsx-runtime$/, /^react-dom$/, /^@fontsource-variable\/[a-z-]+/];

/** A test may also import its runner. */
const PACKAGES_ALLOWED_IN_TESTS = [/^vitest$/];

const SOURCES = import.meta.glob<string>('./**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Every module a source names: `import`, `export … from`, `import()`, and a stylesheet's `@import`. */
function importsOf(source: string): string[] {
  const patterns = [
    /\b(?:import|export)\s[^'";]*?\sfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g,
  ];
  // A stylesheet's `@import '…'` is also an `import '…'`, and is one import rather than two.
  return [...new Set(patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]!)))];
}

/** Whether `named`, imported from the file at `from` (a path under `./`), lands inside the library. */
function staysInside(from: string, named: string): boolean {
  const resolved = new URL(named, new URL(from, 'file:///ui/'));
  return resolved.pathname.startsWith('/ui/');
}

describe('the library', () => {
  it('has sources to hold to the rule', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(0);
  });

  it('imports nothing from the game', () => {
    const strays: string[] = [];
    for (const [file, source] of Object.entries(SOURCES)) {
      // This file's own examples below are text about imports, not imports.
      if (file === './boundary.test.ts') {
        continue;
      }
      const allowed = file.endsWith('.test.ts')
        ? [...PACKAGES_ALLOWED, ...PACKAGES_ALLOWED_IN_TESTS]
        : PACKAGES_ALLOWED;
      for (const named of importsOf(source)) {
        const relative = named.startsWith('.');
        const fine = relative
          ? staysInside(file, named)
          : allowed.some((pattern) => pattern.test(named.split('?')[0]!));
        if (!fine) {
          strays.push(`${file} imports ${named}`);
        }
      }
    }
    expect(strays).toEqual([]);
  });

  it('sees every kind of import the rule is about', () => {
    const source = [
      `import { a } from './a';`,
      `import type { B } from '../stage/panes';`,
      `export { c } from './c';`,
      `import './d.css';`,
      `const e = await import('./e');`,
      `@import '@fontsource-variable/eb-garamond';`,
    ].join('\n');
    expect(importsOf(source)).toEqual(
      expect.arrayContaining([
        './a',
        '../stage/panes',
        './c',
        './d.css',
        './e',
        '@fontsource-variable/eb-garamond',
      ]),
    );
  });

  it('tells a path that leaves the library from one that does not', () => {
    expect(staysInside('./borders/Border.tsx', '../tokens')).toBe(true);
    expect(staysInside('./borders/Border.tsx', '../../stage/panes')).toBe(false);
    expect(staysInside('./tokens.ts', '../stage/panes')).toBe(false);
  });
});
