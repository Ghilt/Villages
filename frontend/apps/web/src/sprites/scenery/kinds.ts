/**
 * **This is experiment 0006, not a finished part of the game.** It was built to answer one question -
 * how much scenery the browser will draw before it lags - and it answers it. What it is *not* is a
 * world worth looking at: three kinds of the ten Adam named, drawn as a triangle, an ellipse and three
 * blades, scattered by one weight table nobody has tuned. Do not build on the look of it, and do not
 * take the numbers in it for settled. What replaces it is the **world-generator**, in
 * `docs/plans/world-generator.md`.
 */

/**
 * What grows where, and how big it stands.
 *
 * Scenery has a **ground form** and no **icon**: it is a thing standing in the world, and the far-out
 * drawing of a forest is the painted terrain itself. So a kind is a height in world units and a list of
 * the ground it belongs on. See decision record 0051.
 *
 * A height here is a map convention, not a measurement, and at this world's resolution it cannot be
 * anything else: one world unit is about 1.2 kilometres, so a pine of one and a half units is a symbol
 * for a stand of them rather than a tree. It is chosen to read at the zoom the camera can reach.
 *
 * Three kinds to begin with, of the ten Adam named. The shape takes the other seven without changing.
 */

/** The terrain classes, by the id they carry in `world/palette.json`. Only the ones anything grows on. */
export const TERRAIN = {
  taiga: 7,
  taigaOpen: 8,
  coniferForest: 9,
  broadleafForest: 10,
  mixedForest: 11,
  dryForest: 13,
  steppe: 16,
  meadow: 17,
  savanna: 18,
  scrub: 19,
  heath: 20,
  farmlandWithWoods: 22,
  alpineMeadow: 30,
} as const;

export interface Kind {
  name: string;
  /** How tall it stands, in world units, before its own size jitter. */
  groundHeight: number;
  /** How much of the jitter it takes: 0.2 means from four fifths to one and a fifth of its height. */
  vary: number;
  /**
   * How much of this kind grows on each ground, as a weight against the other kinds there. A class
   * missing from every kind's list grows nothing, which is how ocean, ice and rock stay bare.
   */
  on: Partial<Record<number, number>>;
}

export const KINDS: readonly Kind[] = [
  {
    name: 'pine',
    groundHeight: 1.5,
    vary: 0.25,
    on: {
      [TERRAIN.taiga]: 10,
      [TERRAIN.coniferForest]: 10,
      [TERRAIN.taigaOpen]: 5,
      [TERRAIN.mixedForest]: 4,
    },
  },
  {
    name: 'oak',
    groundHeight: 1.9,
    vary: 0.2,
    on: {
      [TERRAIN.broadleafForest]: 10,
      [TERRAIN.mixedForest]: 6,
      [TERRAIN.dryForest]: 5,
      [TERRAIN.farmlandWithWoods]: 4,
      [TERRAIN.meadow]: 1,
    },
  },
  {
    name: 'grass tuft',
    groundHeight: 0.7,
    vary: 0.3,
    on: {
      [TERRAIN.meadow]: 10,
      [TERRAIN.steppe]: 10,
      [TERRAIN.savanna]: 8,
      [TERRAIN.heath]: 8,
      [TERRAIN.scrub]: 6,
      [TERRAIN.alpineMeadow]: 6,
      [TERRAIN.taigaOpen]: 2,
    },
  },
];

/** The weights of every kind on one ground, and their total. Worked out once rather than per point. */
export interface Growing {
  /** Running totals, so a roll in [0, total) picks a kind by where it falls. */
  upTo: readonly number[];
  total: number;
}

const nothing: Growing = { upTo: [], total: 0 };

/** What grows on each terrain class, by class id. Built once; the tables never change at runtime. */
export function whatGrows(): readonly Growing[] {
  const byClass: Growing[] = [];
  for (let id = 0; id < 256; id += 1) {
    let running = 0;
    const upTo: number[] = [];
    for (const kind of KINDS) {
      running += kind.on[id] ?? 0;
      upTo.push(running);
    }
    byClass[id] = running === 0 ? nothing : { upTo, total: running };
  }
  return byClass;
}

/** Which kind a roll in [0, 1) picks on this ground, or -1 where nothing grows. */
export function kindFor(growing: Growing, roll: number): number {
  if (growing.total === 0) {
    return -1;
  }
  const want = roll * growing.total;
  for (let index = 0; index < growing.upTo.length; index += 1) {
    if (want < (growing.upTo[index] ?? 0)) {
      return index;
    }
  }
  return growing.upTo.length - 1;
}
