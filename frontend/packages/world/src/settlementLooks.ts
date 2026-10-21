import { along, box, gable, hip, round } from './blockOut.ts';
import type { Face, P3 } from './blockOut.ts';
import { CULTURES } from './structures.ts';
import type { Culture } from './structures.ts';

/*
 * The placeholder pictures of a settlement's pieces and of the bridges, drawn in code in the map's own camera - the
 * ground turned 26 degrees onto its lattice, the camera looking north and down at 45, the light from the right - so
 * that each stands on the diamonds of its footprint as a painted one will: the front corner of its base the lowest
 * thing in it. Block-outs of boxes, roofs, round huts, hulls and decks in each culture's colours, for asseterizer to
 * paint over (decision record 0114, docs/plans/settlements-and-roads.md). Data, as the structures' are, so the tool
 * that draws them and the tests that hold them read the same shapes.
 */

/** The pieces a settlement is laid out in, each in every culture; the jetty is one for all, along each axis. */
export const SETTLEMENT_PIECES = [
  'cottage',
  'house',
  'barn',
  'chapel',
  'fishingHut',
  'netRack',
  'boat',
] as const;
export type SettlementPiece = (typeof SETTLEMENT_PIECES)[number];
/**
 * How many diamonds along a side each piece's base covers: what its yard is worn round and what the trees stand in
 * front of or behind; a boat's is the water it lies on.
 */
export const PIECE_SIDES: Readonly<Record<SettlementPiece, number>> = {
  cottage: 2,
  house: 3,
  barn: 3,
  chapel: 3,
  fishingHut: 2,
  netRack: 1,
  boat: 2,
};
export const JETTY = 'jetty';
export const JETTY_AXES = ['u', 'v'] as const;
export type JettyAxis = (typeof JETTY_AXES)[number];

/** The bridges: two kinds, each along one of the lattice's four axes. A bridge reads the same from either end. */
export const BRIDGE_KINDS = ['timber', 'stone'] as const;
export type BridgeKind = (typeof BRIDGE_KINDS)[number];
export const BRIDGE_AXES = ['u', 'v', 'uv', 'vu'] as const;
export type BridgeAxis = (typeof BRIDGE_AXES)[number];

/** Each culture's colours: its walls, its roofs, its wood. */
const COLOURS: Readonly<Record<Culture, { wall: string; roof: string; wood: string; stone: string }>> = {
  european: { wall: '#e9dfc8', roof: '#a4553a', wood: '#7a5636', stone: '#b9b0a0' },
  islamic: { wall: '#ecdcb8', roof: '#d8c49a', wood: '#8c6a48', stone: '#cdb98f' },
  eastAsian: { wall: '#d9cdb4', roof: '#4c5560', wood: '#5a3b2a', stone: '#9a978e' },
  african: { wall: '#b98a5a', roof: '#c9a65a', wood: '#6e4a2c', stone: '#a88c6a' },
};

/** A building of a culture: a box of walls and the culture's roof, or a round hut where it builds round. */
function building(culture: Culture, side: number, walls: number, rise: number, roof?: string): Face[] {
  const { wall, roof: tile } = COLOURS[culture];
  const top = roof ?? tile;
  switch (culture) {
    case 'african':
      return round(side / 2, side / 2, 0, side * 0.45, walls * 0.8, wall, rise * 1.3, top);
    case 'islamic':
      return [
        ...box(0, 0, 0, side, side, walls, wall, top),
        ...box(-0.05, -0.05, walls, side + 0.1, side + 0.1, 0.15, wall, top),
      ];
    case 'eastAsian':
      return [...box(0, 0, 0, side, side, walls, wall), ...hip(0, 0, walls, side, side, rise, top)];
    default:
      return [...box(0, 0, 0, side, side, walls, wall), ...gable(0, 0, walls, side, side, rise, top, wall)];
  }
}

/** A piece's faces, in its culture, in world units. */
export function settlementPieceFaces(piece: SettlementPiece, culture: Culture): Face[] {
  const c = COLOURS[culture];
  switch (piece) {
    case 'cottage':
      return building(culture, 2, 1.3, 1.1);
    case 'house':
      return building(culture, 3, 1.9, 1.4);
    case 'barn':
      return building(culture, 3, 1.6, 1.6, c.wood);
    case 'fishingHut':
      return building(culture, 2, 1.1, 1.0, c.wood);
    case 'chapel': {
      const nave = building(culture, 3, 2.1, 1.4);
      const tower =
        culture === 'islamic'
          ? [
              ...round(1.5, 1.5, 2.25, 1.0, 0.25, c.wall, 1.0, c.roof),
              ...box(2.35, 2.35, 0, 0.5, 0.5, 4.4, c.wall),
              ...round(2.6, 2.6, 4.4, 0.3, 0.2, c.wall, 0.5, c.roof),
            ]
          : culture === 'african'
            ? round(0.8, 0.8, 2.4, 0.5, 0.6, c.wall, 1.4, c.roof)
            : culture === 'eastAsian'
              ? hip(0.4, 0.4, 3.2, 2.2, 2.2, 0.8, c.roof)
              : [
                  ...box(2.0, 1.05, 0, 0.9, 0.9, 3.6, c.stone),
                  ...round(2.45, 1.5, 3.6, 0.35, 0.1, c.stone, 1.6, c.roof),
                ];
      return [...nave, ...tower];
    }
    case 'netRack':
      return [
        ...box(0, 0, 0, 0.12, 0.12, 1.4, c.wood),
        ...box(0, 0.88, 0, 0.12, 0.12, 1.4, c.wood),
        {
          at: [
            [0.06, 0.12, 0.3],
            [0.06, 0.88, 0.3],
            [0.06, 0.88, 1.3],
            [0.06, 0.12, 1.3],
          ],
          fill: '#8e9a7c',
          normal: along(-1, 0),
        },
      ];
    case 'boat': {
      const hull = culture === 'african' ? c.wood : culture === 'eastAsian' ? '#6b4a33' : '#5d6f7d';
      const faces: Face[] = [
        {
          at: [
            [0, 0.5, 0.35],
            [0.6, 0, 0.35],
            [1.9, 0, 0.35],
            [2.4, 0.5, 0.35],
            [1.9, 1, 0.35],
            [0.6, 1, 0.35],
          ],
          fill: c.wood,
          normal: [0, 0, 1],
        },
        {
          at: [
            [0, 0.5, 0.35],
            [0.6, 0, 0.35],
            [1.9, 0, 0.35],
            [2.4, 0.5, 0.35],
            [1.9, 0.5, 0],
            [0.6, 0.5, 0],
          ],
          fill: hull,
          normal: along(0, -1),
        },
      ];
      if (culture === 'african') return faces;
      if (culture === 'eastAsian')
        return [...faces, ...gable(0.7, 0.15, 0.35, 1, 0.7, 0.5, '#9a8a6a', '#9a8a6a')];
      const sail: Face =
        culture === 'islamic'
          ? {
              at: [
                [0.4, 0.5, 0.6],
                [2.2, 0.5, 2.6],
                [1.6, 0.5, 0.6],
              ],
              fill: '#efe6d2',
              normal: along(0, -1),
            }
          : {
              at: [
                [1.0, 0.5, 0.6],
                [1.0, 0.5, 2.6],
                [2.1, 0.5, 0.7],
              ],
              fill: '#c9a87a',
              normal: along(0, -1),
            };
      return [...faces, ...box(1.0, 0.45, 0.35, 0.08, 0.08, 2.3, c.wood), sail];
    }
  }
}

/** A jetty of planks on posts, three and a half units long and one wide, along one of the lattice's two axes. */
export function jettyFaces(axis: JettyAxis): Face[] {
  const along = (s: number, w: number): [number, number] => (axis === 'u' ? [s, w] : [w, s]);
  const post = (s: number, w: number): Face[] => {
    const [a, b] = along(s, w);
    return box(a, b, -0.4, 0.15, 0.15, 0.7, '#5a4230');
  };
  const [la, lb] = along(3.4, 1);
  return [
    ...[0.2, 1.6, 3.0].flatMap((s) => [...post(s, 0), ...post(s, 0.85)]),
    ...box(0, 0, 0.3, la, lb, 0.12, '#8a6a48', '#a3825c'),
  ];
}

/** A bridge's deck along its axis, its middle at the frame's origin, and what holds it up: piers, or stone arches. */
export function bridgeFaces(kind: BridgeKind, axis: BridgeAxis, span = 4): Face[] {
  const [da, db] =
    axis === 'u'
      ? [1, 0]
      : axis === 'v'
        ? [0, 1]
        : axis === 'uv'
          ? [Math.SQRT1_2, Math.SQRT1_2]
          : [Math.SQRT1_2, -Math.SQRT1_2];
  const [wa, wb] = [-db, da];
  const deck = kind === 'stone' ? 0.7 : 0.45;
  const at = (s: number, w: number, z: number): P3 => [s * da + w * wa, s * db + w * wb, z];
  const half = span / 2;
  const slab = (
    s0: number,
    s1: number,
    w0: number,
    w1: number,
    z0: number,
    z1: number,
    fill: string,
  ): Face[] => [
    {
      at: [at(s0, w0, z0), at(s1, w0, z0), at(s1, w0, z1), at(s0, w0, z1)],
      fill,
      normal: [-wb * 0.6, wa * 0.6, 0],
    },
    {
      at: [at(s0, w1, z0), at(s1, w1, z0), at(s1, w1, z1), at(s0, w1, z1)],
      fill,
      normal: [wb * 0.6, -wa * 0.6, 0],
    },
    { at: [at(s0, w0, z1), at(s1, w0, z1), at(s1, w1, z1), at(s0, w1, z1)], fill, normal: [0, 0, 1] },
  ];
  const wood = '#8a6a48';
  const stone = '#b7ab96';
  const faces: Face[] = [];
  if (kind === 'stone') {
    faces.push(...slab(-half, half, -0.55, 0.55, 0, deck, stone));
    faces.push(
      ...slab(-half, half, -0.6, -0.5, deck, deck + 0.3, stone),
      ...slab(-half, half, 0.5, 0.6, deck, deck + 0.3, stone),
    );
  } else {
    for (const s of [-half + 0.4, 0, half - 0.4])
      faces.push(...slab(s - 0.08, s + 0.08, -0.45, 0.45, -0.3, deck, '#5a4230'));
    faces.push(...slab(-half, half, -0.5, 0.5, deck - 0.1, deck, wood));
    for (const w of [-0.48, 0.42])
      faces.push(...slab(-half, half, w, w + 0.06, deck + 0.35, deck + 0.42, wood));
  }
  return faces;
}

/** The file a piece's picture is in: `cottage-european.png`. */
export function settlementPieceFile(piece: SettlementPiece, culture: Culture): string {
  return `${piece}-${culture}.png`;
}

/** The file a jetty's picture is in: `jetty-u.png`. */
export function jettyFile(axis: JettyAxis): string {
  return `${JETTY}-${axis}.png`;
}

/** The file a bridge's picture is in: `timber-u.png`. */
export function bridgeFile(kind: BridgeKind, axis: BridgeAxis): string {
  return `${kind}-${axis}.png`;
}

/** How many pixels to the world unit a placeholder is drawn at: the scale a picture painted over one keeps. */
export const DRAWN_PER_UNIT = 200;
/** And how many it is cut at into the atlas: at the closest zoom a world unit is sixteen pixels of the screen. */
export const CUT_PER_UNIT = 24;

/** The name the map asks the settlements' atlas for a picture by: `cottage@european`, `jetty:u`, `bridge:stone-uv`. */
export function settlementPieceKey(piece: SettlementPiece, culture: Culture): string {
  return `${piece}@${culture}`;
}

export function jettyKey(axis: JettyAxis): string {
  return `${JETTY}:${axis}`;
}

export function bridgeKey(kind: BridgeKind, axis: BridgeAxis): string {
  return `bridge:${kind}-${axis}`;
}

/** The key of a picture in `world/sprites/settlements/`, or null for a file that is not one. */
export function keyOfSettlementFile(file: string): string | null {
  const jetty = /^jetty-(u|v)\.png$/.exec(file);
  if (jetty !== null) return jettyKey(jetty[1] as JettyAxis);
  const match = /^([a-zA-Z]+)-([a-zA-Z]+)\.png$/.exec(file);
  if (match === null) return null;
  const [, piece, culture] = match;
  return (SETTLEMENT_PIECES as readonly string[]).includes(piece!) &&
    (CULTURES as readonly string[]).includes(culture!)
    ? settlementPieceKey(piece as SettlementPiece, culture as Culture)
    : null;
}

/** The key of a picture in `world/sprites/bridges/`, or null for a file that is not one. */
export function keyOfBridgeFile(file: string): string | null {
  const match = /^(timber|stone)-(u|v|uv|vu)\.png$/.exec(file);
  return match === null ? null : bridgeKey(match[1] as BridgeKind, match[2] as BridgeAxis);
}
