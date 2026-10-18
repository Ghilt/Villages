import { hash2 } from './painterly.ts';
import type { CultureStreets, RuinPieceName, RuinsLook } from './ruins.ts';
import { RUIN_PIECES } from './ruins.ts';
import type { ClassAt } from './scatter.ts';
import type { StandChunk } from './stands.ts';
import { CULTURES } from './structures.ts';

/*
 * A ruined city laid out from its record, the same in every browser and in every still. See decision record 0104.
 *
 * A town of 1790 is one stand of the `ruins` layer: a middle, a reach, the culture it was built in, how built-up its
 * core was, a seed. Everything else is worked out here, from that and the terrain classes alone. The town's own grid
 * of lots - turned by its seed, unless its culture lays its towns to the four quarters - is cut into blocks by streets
 * a lot wide, and each lot holds at most one piece: a hall alone in its block in the core - always in the block at
 * its middle - a tower, a row of houses or a shell through the middle, rubble and lone shells at the edge, a wall
 * and its gates on a ring where the culture walls its towns, an arch standing in a street. Lots are kept by a roll against a share that falls from the core to
 * the edge, so a thinner drawing is a subset of a fuller one.
 *
 * Pure, and with no trigonometry: the turn is a table of numbers, distances are compared squared, and `Math.sqrt` is
 * exact in every engine, so a city is laid out to the last bit alike everywhere.
 */

/** A piece standing in a ruined city: where its foot is, which piece, in which culture, how early, how tall. */
export interface RuinPiece {
  readonly x: number;
  readonly y: number;
  /** Its place in `RUIN_PIECES`. */
  readonly piece: number;
  /** Its place in `CULTURES`, which is its record's favourite byte. */
  readonly culture: number;
  /** From nought to one, fixed for ever: a thinner drawing takes the lowest first. */
  readonly rank: number;
  readonly height: number;
}

/** A town turned to sixteenths of a right angle, as cosine and sine: written out, so no engine works them itself. */
const TURNS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0.995185, 0.098017],
  [0.980785, 0.19509],
  [0.95694, 0.290285],
  [0.92388, 0.382683],
  [0.881921, 0.471397],
  [0.83147, 0.55557],
  [0.77301, 0.634393],
  [0.707107, 0.707107],
  [0.634393, 0.77301],
  [0.55557, 0.83147],
  [0.471397, 0.881921],
  [0.382683, 0.92388],
  [0.290285, 0.95694],
  [0.19509, 0.980785],
  [0.098017, 0.995185],
];

/** Different numbers for different questions about the same lot, so they do not agree. */
const SEED = {
  town: 0x4a1f,
  alongU: 0x61b3,
  alongV: 0x0f5d,
  keep: 0x7e29,
  piece: 0x13c1,
  size: 0x5aa7,
  rank: 0x3d0b,
  ragged: 0x6f81,
  landmark: 0x18e5,
} as const;

/** How much of a piece's arrival is decided by how tall it is rather than by its own roll, as the trees' is. */
const BY_SIZE = 0.5;

const PIECE = Object.fromEntries(RUIN_PIECES.map((name, at) => [name, at])) as Record<RuinPieceName, number>;

/** A town as the layout reads it: its frame, how big it is, its seed and how it lays its streets. */
interface Town {
  readonly cx: number;
  readonly cy: number;
  readonly cos: number;
  readonly sin: number;
  readonly built: number;
  readonly seed: number;
  readonly culture: number;
  readonly fullness: number;
  readonly streets: CultureStreets;
}

/**
 * A town's record as the layout reads it. Its seed is hashed from its middle, quantised to the eighth of a unit the
 * record carries and wrapped round the world, so the copy of a record the tile across the world's edge holds is the
 * same town; and from the record's own seed, so two towns are two however near they stand.
 */
function townOf(
  chunk: StandChunk,
  at: number,
  look: RuinsLook & { readonly ring: number },
  side: number,
): Town | null {
  const culture = chunk.dominant[at]!;
  const name = CULTURES[culture];
  if (name === undefined) return null;
  const way = look.streets[name];
  const eighths = side * 8;
  const qx = (((Math.round(chunk.x[at]! * 8) % eighths) + eighths) % eighths) | 0;
  const qy = Math.round(chunk.y[at]! * 8) | 0;
  const seed = Math.floor(hash2(qx, qy, SEED.town ^ chunk.seed[at]!) * 0x40000000);
  const [cos, sin] = way.turn ? TURNS[seed & 15]! : TURNS[0]!;
  return {
    cx: chunk.x[at]!,
    cy: chunk.y[at]!,
    cos,
    sin,
    built: chunk.reach[at]! / (1 + look.ring),
    seed,
    culture,
    fullness: chunk.thickness[at]!,
    streets: way,
  };
}

/** How far out a point is in a town, squared, as a share of its built radius: what decides which town owns a lot. */
function outFrom(town: Town, x: number, y: number): number {
  const dx = x - town.cx;
  const dy = y - town.cy;
  return (dx * dx + dy * dy) / (town.built * town.built);
}

/** What the layout needs besides the records: how to read them, the ground, and the dial. */
export interface RuinsGround {
  readonly look: RuinsLook & { readonly ring: number };
  /** The world's side in units, so a record across its edge is the same town. */
  readonly side: number;
  readonly classAt: ClassAt;
  /** Whether a terrain class is water, which no piece stands in. */
  readonly water: (terrain: number) => boolean;
}

const wrap = (value: number, every: number): number => ((value % every) + every) % every;

/**
 * Every piece whose foot stands in the box from `fromX`, `fromY` up to but not including `toX`, `toY`, of the towns
 * in `towns`, which must hold every record whose reach touches the box. A piece belongs to the one box its foot is in,
 * so the boxes of a grid of cells between them hold every piece once. `dial` thins every town alike, as the scenery's
 * does: below one a subset of what one draws, never a reshuffle.
 */
export function ruinsIn(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  towns: StandChunk,
  ground: RuinsGround,
  dial = 1,
): RuinPiece[] {
  const { look } = ground;
  const { layout, pieces } = look;
  const lot = layout.lot;
  const keepAtDial = Math.min(1, dial);
  const tallest = Math.max(...pieces.map((piece) => piece.height));
  const all: Town[] = [];
  for (let at = 0; at < towns.count; at += 1) {
    const town = townOf(towns, at, look, ground.side);
    if (town !== null) all.push(town);
  }

  const out: RuinPiece[] = [];
  for (const town of all) {
    const { cos, sin, built, seed, streets } = town;
    const period = streets.block + 1;
    // The box's corners in the town's own frame, and the lots that could have a foot inside it.
    const corners = [
      [fromX, fromY],
      [toX, fromY],
      [fromX, toY],
      [toX, toY],
    ].map(([x, y]) => {
      const dx = x! - town.cx;
      const dy = y! - town.cy;
      return [dx * cos + dy * sin, dy * cos - dx * sin] as const;
    });
    const most = built * (1 + layout.ragged);
    const fromU = Math.max(-most, Math.min(...corners.map((c) => c[0])) - lot);
    const toU = Math.min(most, Math.max(...corners.map((c) => c[0])) + lot);
    const fromV = Math.max(-most, Math.min(...corners.map((c) => c[1])) - lot);
    const toV = Math.min(most, Math.max(...corners.map((c) => c[1])) + lot);

    for (let j = Math.floor(fromV / lot); j <= Math.floor(toV / lot); j += 1) {
      for (let i = Math.floor(fromU / lot); i <= Math.floor(toU / lot); i += 1) {
        const u = (i + 0.5 + (hash2(i, j, seed ^ SEED.alongU) - 0.5) * 2 * streets.jitter) * lot;
        const v = (j + 0.5 + (hash2(i, j, seed ^ SEED.alongV) - 0.5) * 2 * streets.jitter) * lot;
        const x = town.cx + u * cos - v * sin;
        const y = town.cy + u * sin + v * cos;
        if (x < fromX || x >= toX || y < fromY || y >= toY) continue;

        // How far out the lot is, by the culture's outline, made ragged a block at a time.
        const blockI = Math.floor(i / period);
        const blockJ = Math.floor(j / period);
        const ragged = 1 + layout.ragged * (hash2(blockI, blockJ, seed ^ SEED.ragged) - 0.5);
        const far = streets.outline === 'square' ? Math.max(u * u, v * v) : u * u + v * v;
        const t = Math.sqrt(far / (built * built * ragged));
        if (t >= 1) continue;
        // Where towns meet, a lot is the town's it lies furthest inside, as a share of each one's size.
        const own = outFrom(town, x, y);
        if (all.some((other) => other !== town && outFrom(other, x, y) < own)) continue;

        const onStreet = wrap(i, period) === streets.block || wrap(j, period) === streets.block;
        const piece = pieceOf(town, i, j, t, onStreet, period, keepAtDial, layout);
        if (piece === null) continue;

        const spec = pieces[piece]!;
        const half = spec.width / 2;
        if (
          ground.water(ground.classAt(x, y)) ||
          ground.water(ground.classAt(x - half, y)) ||
          ground.water(ground.classAt(x + half, y))
        ) {
          continue;
        }
        const height = spec.height * (1 + (hash2(i, j, seed ^ SEED.size) * 2 - 1) * spec.vary);
        out.push({
          x,
          y,
          piece,
          culture: town.culture,
          rank: hash2(i, j, seed ^ SEED.rank) * (1 - BY_SIZE) + (1 - height / tallest) * BY_SIZE,
          height,
        });
      }
    }
  }
  out.sort((one, other) => one.rank - other.rank);
  return out;
}

/**
 * The piece a lot holds, or null for none: on the wall's ring a wall, or a gate where a street meets it; in a core
 * block chosen as a landmark, a hall in its middle lot and nothing else; in a street, now and then an arch; in a
 * building lot, kept against the town's fullness falling to the edge's share, a tower, a row, a shell or rubble by
 * how far out it is.
 */
function pieceOf(
  town: Town,
  i: number,
  j: number,
  t: number,
  onStreet: boolean,
  period: number,
  keepAtDial: number,
  layout: RuinsLook['layout'],
): number | null {
  const { seed, streets, fullness } = town;
  const roll = hash2(i, j, seed ^ SEED.keep);
  const choice = hash2(i, j, seed ^ SEED.piece);
  if (streets.walls && t >= layout.wall[0] && t < layout.wall[1]) {
    if (roll >= layout.walls * keepAtDial) return null;
    return onStreet ? PIECE.gate : PIECE.wall;
  }
  if (t < layout.core) {
    const blockI = Math.floor(i / period);
    const blockJ = Math.floor(j / period);
    // The block at the town's middle always is one, so a city has its hall; a hamlet's falls outside its outline.
    if ((blockI === 0 && blockJ === 0) || hash2(blockI, blockJ, seed ^ SEED.landmark) < layout.landmarks) {
      const middle = Math.floor(streets.block / 2);
      const isMiddle = wrap(i, period) === middle && wrap(j, period) === middle;
      return isMiddle && roll < keepAtDial ? PIECE.hall : null;
    }
  }
  if (onStreet) {
    return t < 0.8 && roll < layout.arches * keepAtDial ? PIECE.arch : null;
  }
  // The share of lots kept: the town's fullness through the core, falling to the edge's share of it at the outline.
  const out = t < layout.core ? 0 : (t - layout.core) / (1 - layout.core);
  const share = fullness * (1 - out * (1 - layout.edge));
  if (roll >= share * keepAtDial) return null;
  if (t < layout.core) return choice < layout.towers ? PIECE.tower : choice < 0.6 ? PIECE.row : PIECE.shell;
  if (t < 0.8) return choice < 0.45 ? PIECE.row : choice < 0.9 ? PIECE.shell : PIECE.rubble;
  return choice < 0.55 ? PIECE.rubble : PIECE.shell;
}
