/**
 * The points `npm run perf:shaders` keeps, one line of `docs/experiments/performance/shaders.jsonl` each, as the
 * performance page reads them and the tool writes them: what a point is, how the lines are read, which points
 * compare, and what family each thing that drew belongs to. It imports nothing, so the tool, which runs on Node from
 * `frontend/perf/`, reads the same lines by the same rules. See decision record 0106.
 */

export type Why = 'to-main' | 'history' | 'by-hand';

export interface KeptPlace {
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly zoom: number;
  /** The fast frames' milliseconds of the graphics card, and how the frames spread. */
  readonly frame: number;
  readonly p50: number;
  readonly p80: number;
  /** The middle frame's milliseconds of the CPU. */
  readonly cpu: number;
  /** Milliseconds by what drew - the map's style layer, `map:water`, or Pixi's program, `sprites:land` - adding up to the frame. */
  readonly keys: Readonly<Record<string, number>>;
  /** How many draws a frame each thing made, clears among them: the sprites' cost is as much in how many as in each. */
  readonly draws: Readonly<Record<string, number>>;
  readonly settled: boolean;
  /** The founded house's seat, for the fog. */
  readonly seat?: string;
}

export interface Point {
  readonly method: number;
  readonly why: Why;
  readonly measuredAt: string;
  readonly code: {
    readonly commit: string;
    readonly subject: string;
    /** When main came to hold the commit, from main's reflog; null for a commit main has never held. */
    readonly landedAt: string | null;
    readonly dirty: boolean;
  };
  readonly machine: {
    readonly gpu: string;
    readonly driver: string;
    readonly chrome: string;
    readonly viewport: string;
    readonly dpr: number;
  };
  readonly master: string | null;
  readonly levels: { readonly applied: Record<string, string>; readonly defaults: Record<string, string> };
  readonly places: readonly KeptPlace[];
  readonly fogMissed: string | null;
}

/** The points of a file, in the order they were kept, and how many lines were not points. */
export function readShaderPoints(text: string): { points: Point[]; unreadable: number } {
  return readLines<Point>(text, (value) => {
    const point = value as Partial<Point> | null;
    return typeof point?.method === 'number' && Array.isArray(point.places);
  });
}

/**
 * Whether two points were measured alike - by one method, on one card, at one size, on one CPU, as far as each says
 * which - and so compare. A point of the shaders names no CPU, and one of the tests no card.
 */
export function alike(
  one: Pick<Measured, 'method' | 'machine'>,
  other: Pick<Measured, 'method' | 'machine'>,
): boolean {
  return (
    one.method === other.method &&
    one.machine.gpu === other.machine.gpu &&
    one.machine.viewport === other.machine.viewport &&
    one.machine.cpu === other.machine.cpu
  );
}

/** What every point kept has, whatever it measured: the shaders, the start, the zoom, the tests. */
export interface Measured {
  readonly method: number;
  readonly measuredAt: string;
  readonly code: {
    readonly commit: string;
    readonly subject: string;
    readonly landedAt: string | null;
    readonly dirty: boolean;
  };
  /** What it was measured on, as far as it matters to what it measured: the card and the size, the CPU. */
  readonly machine: { readonly gpu?: string; readonly viewport?: string; readonly cpu?: string };
}

/** When a point's code was the game's: when main came to hold it, or when it was measured when main never did. */
export function whenOf(point: Measured): string {
  return point.code.landedAt ?? point.measuredAt;
}

/** A point's name on an axis: its commit and the day. */
export function pointName(point: Measured): string {
  return `${point.code.commit.slice(0, 7)}${point.code.dirty ? '*' : ''} ${whenOf(point).slice(5, 10)}`;
}

/** The points measured alike the latest kept, in the order their code was the game's: what one line charts. */
export function lineOf<P extends Measured>(points: readonly P[]): P[] {
  const latest = points.at(-1);
  if (latest === undefined) return [];
  return points.filter((point) => alike(point, latest)).sort((a, b) => whenOf(a).localeCompare(whenOf(b)));
}

/** The lines of a history that are what `is` says a point is, in the order they were kept, and how many were not. */
export function readLines<P>(
  text: string,
  is: (value: unknown) => boolean,
): { points: P[]; unreadable: number } {
  const points: P[] = [];
  let unreadable = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    try {
      const value: unknown = JSON.parse(line);
      if (is(value)) points.push(value as P);
      else unreadable += 1;
    } catch {
      unreadable += 1;
    }
  }
  return { points, unreadable };
}

/**
 * What a thing that drew is, gathered for reading: the families the page charts. Kept as the raw names in the points
 * and gathered only here, so a family drawn differently later regroups old points without measuring them again; the
 * grass part of before 2026-10-17 is the land's.
 */
export const FAMILIES = [
  {
    name: 'land',
    colour: '#1baf7a',
    what: 'the land layer: grass, crops, heath, wet land, ice, salt and sand',
  },
  { name: 'water', colour: '#2a78d6', what: "the water's shader, sea, lakes and rivers" },
  { name: 'clouds', colour: '#8a8fa3', what: 'the clouds and their shadows' },
  { name: 'fog', colour: '#555555', what: 'the fog of war and its taking the colour out' },
  { name: 'scenery', colour: '#8a7a1f', what: 'the trees, bushes and stones, and their shadows' },
  {
    name: 'sprites',
    colour: '#eb6834',
    what: "Pixi's batch: the marks, the critters and the rest of the sprites",
  },
  { name: 'relief', colour: '#b04ac0', what: 'the hills shaded from the height' },
  { name: 'map', colour: '#c4373b', what: "the painted map and the rest of the map's own layers" },
  { name: 'clears', colour: '#d17fb0', what: 'clearing the canvases' },
] as const;

export type Family = (typeof FAMILIES)[number]['name'];

export function familyOf(key: string): Family {
  if (key.endsWith(':clear')) return 'clears';
  if (/^sprites:(land|grass)$/.test(key)) return 'land';
  if (key.startsWith('map:water')) return 'water';
  if (key.startsWith('sprites:clouds')) return 'clouds';
  if (key.includes('fog-of-war')) return 'fog';
  if (key.startsWith('sprites:scenery')) return 'scenery';
  if (key.startsWith('map:relief')) return 'relief';
  if (key.startsWith('map:')) return 'map';
  return 'sprites';
}

/** A place's milliseconds, or its draws a frame, gathered by family. */
export function byFamily(of: Readonly<Record<string, number>>): Record<Family, number> {
  const gathered = Object.fromEntries(FAMILIES.map((family) => [family.name, 0])) as Record<Family, number>;
  for (const [key, value] of Object.entries(of)) gathered[familyOf(key)] += value;
  return gathered;
}
