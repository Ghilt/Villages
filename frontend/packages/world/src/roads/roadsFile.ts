import type { NetworkRules } from './network.ts';

/*
 * `world/roads.json`, read and checked: what `world:roads` joins, what a step of a road costs on each ground, how its
 * bridges are built, how it is shaped and graded, and how wide each grade is drawn. Adam's to tune; a file that does not
 * read is refused whole, before anything is made from it. See docs/plans/settlements-and-roads.md.
 */

export interface RoadsFile {
  readonly longestKm: number;
  /** How far a village the graph leaves alone looks for another to be joined to, and how many it tries. */
  readonly lonely: { readonly farKm: number; readonly tries: number };
  readonly ground: Readonly<Record<string, number>>;
  readonly climb: number;
  readonly trunk: number;
  readonly margin: number;
  readonly turn: number;
  readonly diagonal: number;
  readonly corridor: number;
  readonly bridges: {
    readonly perUnit: number;
    readonly building: number;
    readonly longestSpan: number;
    readonly biggestRiver: number;
  };
  readonly shape: {
    readonly turning: number;
    readonly widerTurning: number;
    readonly widerShare: number;
    readonly stray: number;
    readonly strayEvery: number;
    readonly approach: number;
  };
  readonly grades: { readonly road: number; readonly trunk: number };
  readonly widths: {
    readonly track: number;
    readonly road: number;
    readonly trunk: number;
    readonly bridge: number;
  };
}

/** What a step costs on ground the file does not name. */
export const UNNAMED_GROUND = 2;

const positive = (value: unknown): value is number => typeof value === 'number' && value > 0;
const share = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1;

function numbers<K extends string>(
  part: string,
  value: unknown,
  keys: readonly K[],
  check: (value: unknown) => boolean,
  wants: string,
): Record<K, number> {
  const held = (value ?? {}) as Record<string, unknown>;
  for (const key of keys) {
    if (!check(held[key])) throw new Error(`world/roads.json: ${part}.${key} wants ${wants}`);
  }
  return held as Record<K, number>;
}

export function parseRoads(text: string): RoadsFile {
  const file = JSON.parse(text) as Record<string, unknown>;
  for (const key of ['longestKm', 'climb', 'margin', 'corridor'] as const) {
    if (!positive(file[key])) throw new Error(`world/roads.json: ${key} wants a number above nought`);
  }
  if (typeof file['turn'] !== 'number' || file['turn'] < 0) {
    throw new Error('world/roads.json: turn wants a number of steps, nought or more');
  }
  if (typeof file['diagonal'] !== 'number' || file['diagonal'] < Math.SQRT2) {
    throw new Error('world/roads.json: diagonal wants a number no less than a diagonal step is long, 1.414');
  }
  if (!share(file['trunk']) || file['trunk'] === 0) {
    throw new Error('world/roads.json: trunk wants a share above nought and at most one');
  }
  const ground = (file['ground'] ?? null) as Record<string, unknown> | null;
  if (
    ground === null ||
    typeof ground !== 'object' ||
    !Object.values(ground).every((one) => typeof one === 'number' && one >= 1)
  ) {
    throw new Error('world/roads.json: ground wants what a step costs, one or more, for each class it names');
  }
  numbers('lonely', file['lonely'], ['farKm'], positive, 'a number above nought');
  numbers(
    'lonely',
    file['lonely'],
    ['tries'],
    (value) => Number.isInteger(value) && (value as number) >= 1,
    'a whole number, one or more',
  );
  numbers(
    'bridges',
    file['bridges'],
    ['perUnit', 'building', 'longestSpan'],
    positive,
    'a number above nought',
  );
  numbers('bridges', file['bridges'], ['biggestRiver'], share, 'a share from nought to one');
  numbers(
    'shape',
    file['shape'],
    ['turning', 'widerTurning', 'strayEvery', 'approach'],
    positive,
    'a number above nought',
  );
  numbers('shape', file['shape'], ['widerShare'], share, 'a share from nought to one');
  numbers(
    'shape',
    file['shape'],
    ['stray'],
    (value) => typeof value === 'number' && value >= 0,
    'a number of world units, nought or more',
  );
  const grades = numbers(
    'grades',
    file['grades'],
    ['road', 'trunk'],
    (value) => Number.isInteger(value) && (value as number) >= 1,
    'a whole number of roads',
  );
  if (grades.trunk < grades.road)
    throw new Error('world/roads.json: grades wants a trunk to take more roads than a road');
  numbers('widths', file['widths'], ['track', 'road', 'trunk', 'bridge'], positive, 'a number above nought');
  return file as unknown as RoadsFile;
}

/** The rules a network of roads is routed and shaped by, from the file. */
export function networkRules(file: RoadsFile): NetworkRules {
  return {
    climb: file.climb,
    bridge: file.bridges.perUnit,
    bridgeAt: file.bridges.building,
    longestSpan: file.bridges.longestSpan,
    trunk: file.trunk,
    margin: file.margin,
    turn: file.turn,
    diagonal: file.diagonal,
    corridor: file.corridor,
    turning: file.shape.turning,
    widerTurning: file.shape.widerTurning,
    widerShare: file.shape.widerShare,
    stray: file.shape.stray,
    strayEvery: file.shape.strayEvery,
    approach: file.shape.approach,
    grades: [file.grades.road, file.grades.trunk],
  };
}
