import { PLACES, REGIONS, SOURCES } from './nameSources.ts';
import { ETOPO_WORLD } from './worldSources.ts';

/**
 * The world steps: each tool's part of the world for one master, what it is made from and what it makes, in the
 * order they are made. The one list the world cache, `world:ready`, the quick start and the debug panel all read,
 * so that every way of making the world makes the same one. See decision record 0095 and
 * `docs/plans/world-cache.md`.
 *
 * Every path is from the repository's root, with `<m>` for the master's name.
 */

export type StepName =
  | 'import'
  | 'tile'
  | 'styles'
  | 'flow'
  | 'sprites'
  | 'ground'
  | 'origin'
  | 'names'
  | 'culture'
  | 'ruins'
  | 'height'
  | 'settlements';

/** A file a step is made from. */
export interface MadeFrom {
  path: string;
  /** What the architecture page calls it, so that the page and this list can be held to each other. */
  is: string;
  /** Only this part of a JSON file counts: the sprite map reads `painterly.json` for its views alone. */
  part?: string;
  /**
   * The step is made without it, differently: its absence is part of the fingerprint. A file that is not
   * optional and is missing means the step cannot be made at all, and says so.
   */
  optional?: true;
}

/** Something a step makes: a folder, borrowed by hard link a file at a time, or a loose file, copied. */
export interface Makes {
  path: string;
  is: string;
  folder?: true;
  /** Made only when an optional input is there: `regions.bin`, without the regions' sources. */
  optional?: true;
}

export interface WorldStep {
  name: StepName;
  /** The tool, from the repository's root, and what it is told besides the master and `--into`. */
  tool: string;
  options: readonly string[];
  /** Megabytes for `--max-old-space-size`, as the package's own scripts give it. */
  memory: number;
  /** Whether it decodes the whole master, two gigabytes: one of those runs at a time on the machine. */
  heavy: boolean;
  /** Whether it is made a master at a time. The styles are the same for every master. */
  perMaster: boolean;
  from: readonly MadeFrom[];
  /** The steps whose output it reads, whose fingerprints are part of its own. */
  after: readonly StepName[];
  /** What it makes, data before manifest: a reader that reloads on a manifest's date finds the data under it. */
  makes: readonly Makes[];
  /** What it is doing, and what is true once it has, for a line each. */
  doing: string;
  done: string;
}

const M = 'frontend/apps/web/public/world/masters/<m>';
const BIN = 'frontend/packages/world/bin';
const MASTER: MadeFrom = { path: 'world/master/<m>.png', is: 'master' };
const PALETTE: MadeFrom = { path: 'world/palette.json', is: 'palette' };
const RENDER: MadeFrom = { path: 'world/render.json', is: 'render' };
const source = (file: string, optional?: true): MadeFrom => ({
  path: `world/source/${file}.geojson`,
  is: 'natural-earth',
  ...(optional === undefined ? {} : { optional }),
});

export const WORLD_STEPS: readonly WorldStep[] = [
  {
    name: 'import',
    tool: `${BIN}/importMaster.ts`,
    options: [],
    memory: 8192,
    heavy: true,
    perMaster: true,
    from: [MASTER, PALETTE],
    after: [],
    makes: [
      { path: `${M}/terrain.geojson`, is: 'outlines' },
      { path: 'world/master/<m>-preview.png', is: 'preview' },
    ],
    doing: 'tracing the coast and the lakes',
    done: 'the coast and the lakes are traced',
  },
  {
    name: 'tile',
    tool: `${BIN}/tileWorld.ts`,
    options: [],
    memory: 8192,
    heavy: true,
    perMaster: true,
    from: [MASTER, PALETTE, RENDER],
    after: [],
    makes: [{ path: `${M}/tiles`, is: 'tiles', folder: true }],
    doing: 'cutting the world into tiles',
    done: 'the world is cut',
  },
  {
    name: 'styles',
    tool: `${BIN}/renderPainterly.ts`,
    options: ['--config-only'],
    memory: 2048,
    heavy: false,
    perMaster: false,
    from: [PALETTE, RENDER, { path: 'world/painterly.json', is: 'painterly' }],
    after: [],
    makes: [{ path: 'frontend/apps/web/public/world/paint.json', is: 'paint' }],
    doing: 'writing the styles',
    done: 'the styles are written',
  },
  {
    name: 'flow',
    tool: `${BIN}/flowWorld.ts`,
    options: ['--no-stills'],
    memory: 8192,
    heavy: true,
    perMaster: true,
    from: [MASTER, PALETTE],
    after: [],
    makes: [{ path: `${M}/flow`, is: 'flow', folder: true }],
    doing: 'working out which way the rivers run',
    done: 'the rivers run',
  },
  {
    name: 'sprites',
    tool: `${BIN}/generateSpriteMap.ts`,
    options: [],
    memory: 8192,
    heavy: true,
    perMaster: true,
    from: [
      MASTER,
      PALETTE,
      { path: 'world/biomes.json', is: 'biomes' },
      // For the screenful its report measures the scenery's budget on, and for nothing it makes.
      { path: 'world/painterly.json', is: 'painterly', part: 'views' },
    ],
    after: [],
    makes: [
      { path: `${M}/sprites/biome`, is: 'sprite-map', folder: true },
      { path: 'world/stands/<m>/biome', is: 'stands', folder: true },
    ],
    doing: 'working out the biomes and the stands',
    done: 'the world is furnished',
  },
  {
    name: 'ground',
    tool: `${BIN}/groundWorld.ts`,
    options: [],
    memory: 8192,
    heavy: true,
    perMaster: true,
    from: [MASTER, PALETTE],
    after: [],
    makes: [
      { path: 'world/ground/<m>/ground.bin', is: 'ground' },
      { path: 'world/ground/<m>/ground.json', is: 'ground' },
    ],
    doing: 'reading the ground for the game server',
    done: 'the ground is read',
  },
  {
    name: 'origin',
    tool: `${BIN}/originWorld.ts`,
    options: ['--no-names'],
    memory: 8192,
    heavy: true,
    perMaster: true,
    from: [MASTER, { path: 'world/master/terrain-base.png', is: 'base' }, PALETTE],
    after: [],
    makes: [{ path: `${M}/origin`, is: 'origin', folder: true }],
    doing: 'working out where on Earth the land came from',
    done: 'the origin map is worked out',
  },
  {
    name: 'names',
    tool: `${BIN}/namesWorld.ts`,
    options: [],
    memory: 4096,
    heavy: false,
    perMaster: true,
    from: [
      ...SOURCES.map(({ file }) => source(file)),
      ...REGIONS.map(({ file }) => source(file, true)),
      source(PLACES, true),
      { path: 'world/names/1790.json', is: 'names-review', optional: true },
      { path: 'world/names/about.json', is: 'names-review', optional: true },
    ],
    after: ['origin'],
    makes: [
      { path: `${M}/regions.bin`, is: 'names', optional: true },
      { path: `${M}/names.json`, is: 'names' },
      { path: 'world/ground/<m>/regions.bin', is: 'names-server', optional: true },
      { path: 'world/ground/<m>/names.json', is: 'names-server' },
    ],
    doing: 'carrying the real names through the origin map',
    done: 'the names are carried',
  },
  {
    name: 'culture',
    tool: `${BIN}/cultureWorld.ts`,
    options: [],
    memory: 4096,
    heavy: false,
    perMaster: true,
    from: [{ path: 'world/cultures.json', is: 'cultures' }],
    after: ['origin'],
    makes: [{ path: `${M}/culture`, is: 'culture', folder: true }],
    doing: 'working out the culture of every part of the world',
    done: 'the cultures are worked out',
  },
  {
    name: 'ruins',
    tool: `${BIN}/ruinsWorld.ts`,
    options: [],
    memory: 2048,
    heavy: false,
    perMaster: true,
    from: [
      { path: 'world/ruins.json', is: 'ruins' },
      { path: 'world/cultures.json', is: 'cultures' },
      PALETTE,
    ],
    after: ['names', 'culture'],
    makes: [
      { path: `${M}/sprites/ruins`, is: 'ruins-map', folder: true },
      { path: 'world/stands/<m>/ruins', is: 'ruins-stands', folder: true },
    ],
    doing: 'laying the towns of 1790 in ruins',
    done: 'the towns are ruins',
  },
  {
    name: 'height',
    tool: `${BIN}/heightWorld.ts`,
    options: [],
    memory: 8192,
    heavy: true,
    perMaster: true,
    from: [{ path: `world/source/${ETOPO_WORLD}`, is: 'etopo' }, MASTER, PALETTE],
    after: ['origin'],
    makes: [{ path: `${M}/height`, is: 'height', folder: true }],
    doing: 'fitting the height of the world',
    done: 'the relief has its height',
  },
  {
    name: 'settlements',
    tool: `${BIN}/settlementsWorld.ts`,
    options: [],
    memory: 4096,
    heavy: false,
    perMaster: true,
    from: [
      { path: 'world/settlements.json', is: 'settlements' },
      { path: 'world/catalogues/structures.json', is: 'catalogues' },
      { path: 'world/ruins.json', is: 'ruins' },
      { path: 'world/cultures.json', is: 'cultures' },
      PALETTE,
      RENDER,
    ],
    after: ['tile', 'flow', 'names', 'culture', 'height'],
    makes: [{ path: 'world/ground/<m>/settlements.json', is: 'settlements-server' }],
    doing: 'choosing where the settlements stand',
    done: 'the settlements have their sites',
  },
];

/** The step of that name. */
export function stepNamed(name: StepName): WorldStep {
  const step = WORLD_STEPS.find((one) => one.name === name);
  if (step === undefined) {
    throw new Error(`no world step is called ${name}`);
  }
  return step;
}

/** A path of the table for one master. */
export const forMaster = (path: string, master: string): string => path.replaceAll('<m>', master);
