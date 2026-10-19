import { describe, expect, it } from 'vitest';

/**
 * Which folder of the page may import which.
 *
 * The page's folders had come to import each other in one ring, thirteen of them, so that nothing could be
 * moved, tested or understood without the rest. These rows say what may lean on what: a folder may import the
 * rows above it, and in its own row only what `SIDEWAYS` names. What breaks the rows today is listed in
 * `EXCUSED`, one import at a time, and each is taken off the list by the step that ends it - a listed import
 * that no longer happens fails until it is taken off, so the list can only get shorter. No two files may
 * import each other, however far round. Tests may import what they need. See docs/ARCHITECTURE.md.
 */

const ROWS: readonly (readonly string[])[] = [
  // What everything leans on, and which leans on nothing in the page: the ground's own measures and the
  // camera's arithmetic among them, the one way a component reads a store, and the work in hand the loading
  // screen waits for. The component library is the showcase's and the stage's: the stage dresses each tile in
  // its container, and the panes in them take the library up a surface at a time.
  ['ui', 'version', 'marks', 'log', 'geometry', 'store', 'shaders', 'loading'],
  // The connection to the game server, and the stage the panes are laid out in.
  ['net', 'stage'],
  // The ground, drawn: the map and its paint, the fog over it, the desk under it, and the water moving on it.
  ['map', 'fog', 'desk', 'water'],
  // What stands on the ground, and the room around the desk.
  ['sprites', 'room'],
  // The game's own surfaces: the panes and windows a player reads and presses, and the loading screen over them.
  ['house', 'figures', 'holdings', 'choice', 'dialogues', 'quests', 'areas', 'inspect', 'startup'],
  // What puts it all together, and the instruments beside it.
  ['(root)', 'debug', 'admin'],
];

/** A folder that may import another in its own row. */
const SIDEWAYS: readonly (readonly [string, string])[] = [
  // How much the map's shaders draw is said in the log when it changes.
  ['shaders', 'log'],
  ['desk', 'map'],
  // The water's mask measures distance from the shore with the fog's distance transform.
  ['water', 'fog'],
  ['room', 'sprites'],
  ['dialogues', 'figures'],
  ['dialogues', 'house'],
  // A quest's map is drawn over its scene, as a conversation is.
  ['quests', 'dialogues'],
  // An objective says what it asks in the player's words for a resource, as a dealt option does.
  ['quests', 'house'],
  // A dealt option says what it gives in the player's words for a resource.
  ['choice', 'house'],
  ['inspect', 'figures'],
  ['inspect', 'house'],
  ['inspect', 'areas'],
  // A holding's details say what its window says.
  ['holdings', 'inspect'],
  // Starting up puts the camera on the seat as close as the house's arrival comes.
  ['startup', 'house'],
];

/**
 * Imports that break the rows, each excused by name until the step that ends it. There were thirty-two on the
 * day the rule began, and the plan that ended them is done: the list is empty, and an import the rows refuse
 * is a sign the code is in the wrong folder rather than a line to add here. See decision record 0073.
 */
const EXCUSED: readonly string[] = [];

const SOURCES = import.meta.glob<string>('./**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Every module a source names: `import`, `export … from`, `import()`, and a stylesheet's `@import`. */
export function importsOf(source: string): string[] {
  const patterns = [
    /\b(?:import|export)\s[^'";]*?\sfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g,
  ];
  return [...new Set(patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]!)))];
}

/** The source a relative import lands on, as a key of `files`, or null when it leaves the page's sources. */
export function resolve(from: string, named: string, files: ReadonlySet<string>): string | null {
  if (!named.startsWith('.')) {
    return null;
  }
  const bare = named.split('?')[0]!;
  const landed = `.${new URL(bare, `file:///src${from.slice(1)}`).pathname.slice('/src'.length)}`;
  const tried = [landed, `${landed}.ts`, `${landed}.tsx`, `${landed}/index.ts`, `${landed}/index.tsx`];
  return tried.find((candidate) => files.has(candidate)) ?? null;
}

/** The folder a source belongs to: the first under `src`, or the root for the files beside them. */
export function folderOf(file: string): string {
  const parts = file.slice(2).split('/');
  return parts.length === 1 ? '(root)' : parts[0]!;
}

function rowOf(folder: string): number {
  return ROWS.findIndex((row) => row.includes(folder));
}

/**
 * The game's surfaces that have taken the component library up, one at a time, as `UI-COMPONENTS.md` says they
 * will: until one has, it draws its own controls and may not reach into `ui`. The choice roll was the first,
 * with its rarity cards and Take action (0083); the inspect window the second, with the tag beside a window's name
 * saying how fresh what it shows is (0089); later the quests, and the marks on the map with the card a crowd of them
 * opens into (0096); and the loading screen the game starts up under.
 */
const TAKEN_UP: readonly string[] = ['choice', 'inspect', 'holdings', 'quests', 'sprites', 'startup'];

/** Whether the rows let one folder import another. */
export function mayImport(from: string, to: string): boolean {
  if (from === to) {
    return true;
  }
  if (to === 'ui') {
    return from === 'admin' || from === 'stage' || TAKEN_UP.includes(from);
  }
  if (rowOf(from) === ROWS.length - 1) {
    return true;
  }
  if (rowOf(to) < rowOf(from)) {
    return true;
  }
  return SIDEWAYS.some(([one, other]) => one === from && other === to);
}

const isTest = (file: string): boolean => /\.test\.tsx?$/.test(file);

/** Every import between two of the page's sources, tests left out, as from-file to to-file. */
function graph(): Map<string, string[]> {
  const files = new Set(Object.keys(SOURCES));
  const edges = new Map<string, string[]>();
  for (const [file, source] of Object.entries(SOURCES)) {
    if (isTest(file)) {
      continue;
    }
    const to = importsOf(source)
      .map((named) => resolve(file, named, files))
      .filter((landed): landed is string => landed !== null && landed !== file && !isTest(landed));
    edges.set(file, [...new Set(to)]);
  }
  return edges;
}

/** Every set of files that import each other round a ring, however long the ring. */
function rings(edges: ReadonlyMap<string, readonly string[]>): string[][] {
  let next = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const found: string[][] = [];
  const visit = (file: string): void => {
    index.set(file, next);
    low.set(file, next);
    next++;
    stack.push(file);
    onStack.add(file);
    for (const to of edges.get(file) ?? []) {
      if (!index.has(to)) {
        visit(to);
        low.set(file, Math.min(low.get(file)!, low.get(to)!));
      } else if (onStack.has(to)) {
        low.set(file, Math.min(low.get(file)!, index.get(to)!));
      }
    }
    if (low.get(file) === index.get(file)) {
      const ring: string[] = [];
      let one: string;
      do {
        one = stack.pop()!;
        onStack.delete(one);
        ring.push(one);
      } while (one !== file);
      if (ring.length > 1) {
        found.push(ring.sort());
      }
    }
  };
  for (const file of edges.keys()) {
    if (!index.has(file)) {
      visit(file);
    }
  }
  return found;
}

const pair = (from: string, to: string): string => `${from.slice(2)} -> ${to.slice(2)}`;

describe('the folders of the page', () => {
  const edges = graph();

  it('each stand in a row', () => {
    const folders = new Set([...edges.keys()].map(folderOf));
    expect([...folders].filter((folder) => rowOf(folder) === -1)).toEqual([]);
  });

  it('import only the rows above them, and what is excused', () => {
    const breaking = [...edges].flatMap(([from, tos]) =>
      tos.filter((to) => !mayImport(folderOf(from), folderOf(to))).map((to) => pair(from, to)),
    );
    expect(breaking.filter((one) => !EXCUSED.includes(one)).sort()).toEqual([]);
    expect(EXCUSED.filter((one) => !breaking.includes(one))).toEqual([]);
  });

  it('never import each other round a ring', () => {
    expect(rings(edges)).toEqual([]);
  });
});

describe('the rows', () => {
  it('see every kind of import', () => {
    const source = [
      `import { a } from './a';`,
      `import type { B } from '../stage/panes';`,
      `export { c } from './c';`,
      `import './d.css';`,
      `const e = await import('./e');`,
      `@import './f.css';`,
    ].join('\n');
    expect(importsOf(source)).toEqual(
      expect.arrayContaining(['./a', '../stage/panes', './c', './d.css', './e', './f.css']),
    );
  });

  it('find the file an import lands on', () => {
    const files = new Set(['./net/gateway.ts', './stage/Stage.tsx', './ui/index.ts', './styles.css']);
    expect(resolve('./stage/Stage.tsx', '../net/gateway', files)).toBe('./net/gateway.ts');
    expect(resolve('./net/gateway.ts', '../stage/Stage', files)).toBe('./stage/Stage.tsx');
    expect(resolve('./App.tsx', './ui', files)).toBe('./ui/index.ts');
    expect(resolve('./main.tsx', './styles.css?raw', files)).toBe('./styles.css');
    expect(resolve('./main.tsx', 'react', files)).toBeNull();
  });

  it('say which folder may lean on which', () => {
    expect(mayImport('stage', 'log')).toBe(true);
    expect(mayImport('log', 'stage')).toBe(false);
    expect(mayImport('net', 'stage')).toBe(false);
    expect(mayImport('dialogues', 'figures')).toBe(true);
    expect(mayImport('figures', 'dialogues')).toBe(false);
    expect(mayImport('(root)', 'debug')).toBe(true);
    expect(mayImport('(root)', 'ui')).toBe(false);
    expect(mayImport('house', 'ui')).toBe(false);
    expect(mayImport('admin', 'ui')).toBe(true);
    expect(mayImport('stage', 'ui')).toBe(true);
  });
});
