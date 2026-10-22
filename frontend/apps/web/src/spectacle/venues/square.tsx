import { latticeOf } from '../../ui/diorama/lattice';
import { LatticeGround } from '../../ui/diorama/LatticeGround';
import type { ScreenLattice } from '../../ui/diorama/lattice';
import { WATER } from './blocks';
import type { Arrangement, Point, Venue } from './venue';
import { crowdOn, groundOf, mirroredCorner, mirroredOn } from './venue';

/** How many of the scene's units a world unit is, in both of the square's arrangements: a cell of its cobbles. */
const CELL = 24;

/** How tall the map draws each of the square's buildings at its first level, and its trees, in world units. */
const TALL = {
  palace: 10,
  market: 5.6,
  manor: 6,
  mill: 4.8,
  oak: 4.8,
  beech: 3.6,
  pine: 3,
  spruce: 3.4,
  birch: 2.6,
  scrub: 1.8,
} as const;

/** A character's height on the map, in world units. */
const FIGURE = 3;

/**
 * The square's cobbles: the map's own lattice, a cobble to a world unit, worn paler where the crowd stands, so the
 * map's pictures stand square on them.
 */
function Cobbles({
  width,
  height,
  lattice,
  id,
}: {
  width: number;
  height: number;
  lattice: ScreenLattice;
  id: string;
}) {
  return (
    <LatticeGround
      scene={{ width, height }}
      lattice={lattice}
      id={`${id}-cobbles`}
      fill="#c6b997"
      joint="rgba(60,48,30,0.3)"
    >
      <defs>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9ab88" />
          <stop offset="1" stopColor="#d3c6a6" />
        </linearGradient>
        <radialGradient id={`${id}-worn`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(236,226,200,0.55)" />
          <stop offset="1" stopColor="rgba(236,226,200,0)" />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill={`url(#${id}-light)`} />
      <ellipse
        cx={width / 2}
        cy={height * 0.6}
        rx={width * 0.34}
        ry={width * 0.34 * Math.SQRT1_2}
        fill={`url(#${id}-worn)`}
      />
    </LatticeGround>
  );
}

const WIDE_W = 1440;
const WIDE_H = 900;
const WIDE_LATTICE = latticeOf({ x: 706, y: 330 }, CELL);
const wide = groundOf(WIDE_LATTICE);
const WIDE_A_PLATFORM = wide.cell(-11, 16);
const WIDE_B_PLATFORM = mirroredOn(WIDE_LATTICE, [WIDE_A_PLATFORM], WIDE_W)[0]!;
const WIDE_A_SUMMONS = [
  wide.cell(-15, 22),
  wide.cell(-11, 23),
  wide.cell(-17, 25),
  wide.cell(-7, 23),
  wide.cell(-13, 26),
];
const WIDE_A_LINE = [wide.corner(-19, 17), wide.corner(-15, 12)];
const WIDE_FONT = wide.corner(8, 15);
const restsOn = (font: Point): Point => ({ x: font.x, y: font.y - WATER * CELL });
const at = (point: Point, picture: string, height: number) => ({ ...point, picture, height: height * CELL });
const grows = (point: Point, kind: keyof typeof TALL) => ({ ...point, kind, height: TALL[kind] * CELL });

/**
 * The square held wide: the palace at the back, the market and a manor either side of it, a platform at each end, and
 * the crowd between them either side of the happenings' path, which comes out of the palace doors and down the square
 * along the cobbles' joints, turning twice, to the font.
 */
const WIDE: Arrangement = {
  scene: { width: WIDE_W, height: WIDE_H },
  lattice: WIDE_LATTICE,
  cell: CELL,
  figure: FIGURE * CELL,
  ground: <Cobbles width={WIDE_W} height={WIDE_H} lattice={WIDE_LATTICE} id="square-wide" />,
  buildings: [
    at(wide.corner(0, 0), 'palace', TALL.palace),
    at(wide.corner(-10, 5), 'market', TALL.market),
    at(mirroredCorner(WIDE_LATTICE, wide.corner(-10, 5), WIDE_W), 'manor', TALL.manor),
    at(wide.corner(19, -12), 'mill', TALL.mill),
  ],
  trees: [
    grows(wide.cell(-24, 12), 'oak'),
    grows(wide.cell(25, -14), 'beech'),
    grows(wide.cell(-22, 6), 'pine'),
    grows(wide.cell(20, -16), 'birch'),
    grows(wide.cell(-9, -5), 'spruce'),
    grows(wide.cell(3, -11), 'pine'),
    grows(wide.cell(-12, 42), 'scrub'),
  ],
  platforms: { a: WIDE_A_PLATFORM, b: WIDE_B_PLATFORM },
  summons: { a: WIDE_A_SUMMONS, b: mirroredOn(WIDE_LATTICE, WIDE_A_SUMMONS, WIDE_W) },
  onTheLine: { a: WIDE_A_LINE, b: WIDE_A_LINE.map((one) => mirroredCorner(WIDE_LATTICE, one, WIDE_W)) },
  lineHeight: 150,
  townsfolk: {
    a: crowdOn(WIDE_LATTICE, [-6, 5], [9, 15], WIDE_A_PLATFORM, 20),
    b: crowdOn(WIDE_LATTICE, [10, 17], [-1, 11], WIDE_B_PLATFORM, 20),
  },
  mist: wide.corner(1, 1),
  path: [wide.corner(1, 1), wide.corner(1, 8), wide.corner(8, 8), WIDE_FONT, restsOn(WIDE_FONT)],
  receptacle: WIDE_FONT,
  seal: 58,
};

const DEEP_W = 900;
const DEEP_H = 1440;
const DEEP_LATTICE = latticeOf({ x: 438, y: 330 }, CELL);
const deep = groundOf(DEEP_LATTICE);
const DEEP_A_PLATFORM = deep.cell(-2, 18);
const DEEP_B_PLATFORM = mirroredOn(DEEP_LATTICE, [DEEP_A_PLATFORM], DEEP_W)[0]!;
const DEEP_A_SUMMONS = [
  deep.cell(0, 24),
  deep.cell(3, 25),
  deep.cell(1, 28),
  deep.cell(5, 29),
  deep.cell(3, 32),
];
const DEEP_A_LINE = [deep.corner(-5, 15), deep.corner(-2, 11)];
const DEEP_FONT = deep.corner(16, 31);

/**
 * The square held deep: the same two banks made deep, the palace at the far end, each platform near it on its own bank,
 * the summons below it one behind another, the crowd up the middle either side of the happenings' path, which zigzags
 * down the cobbles' joints to the font under them, clear of the trays a deep stage stands its slices in. Everything that
 * matters stands between 130 and 770 across, so a phone, narrower than the scene, crops only the edges.
 */
const DEEP: Arrangement = {
  scene: { width: DEEP_W, height: DEEP_H },
  lattice: DEEP_LATTICE,
  cell: CELL,
  figure: FIGURE * CELL,
  ground: <Cobbles width={DEEP_W} height={DEEP_H} lattice={DEEP_LATTICE} id="square-deep" />,
  buildings: [
    at(deep.corner(0, 0), 'palace', TALL.palace),
    at(deep.corner(-7, 9), 'market', TALL.market),
    at(mirroredCorner(DEEP_LATTICE, deep.corner(-7, 9), DEEP_W), 'manor', TALL.manor),
  ],
  trees: [
    grows(deep.cell(-13, 4), 'pine'),
    grows(deep.cell(13, -6), 'oak'),
    grows(deep.cell(-8, -4), 'spruce'),
    grows(deep.cell(2, -9), 'birch'),
    grows(deep.cell(14, 65), 'scrub'),
  ],
  platforms: { a: DEEP_A_PLATFORM, b: DEEP_B_PLATFORM },
  summons: { a: DEEP_A_SUMMONS, b: mirroredOn(DEEP_LATTICE, DEEP_A_SUMMONS, DEEP_W) },
  onTheLine: { a: DEEP_A_LINE, b: DEEP_A_LINE.map((one) => mirroredCorner(DEEP_LATTICE, one, DEEP_W)) },
  lineHeight: 125,
  townsfolk: {
    a: crowdOn(DEEP_LATTICE, [2, 8], [13, 23], DEEP_A_PLATFORM, 20),
    b: crowdOn(DEEP_LATTICE, [11, 19], [11, 19], DEEP_B_PLATFORM, 20),
  },
  mist: deep.corner(1, 1),
  path: [
    deep.corner(1, 1),
    deep.corner(1, 9),
    deep.corner(9, 9),
    deep.corner(9, 20),
    deep.corner(16, 20),
    DEEP_FONT,
    restsOn(DEEP_FONT),
  ],
  receptacle: DEEP_FONT,
  seal: 60,
};

/**
 * The square: a sermon, a debate or a trade war in a town square, each house's speaker on a platform at the back of its
 * bank, its summons beside it, and the townsfolk between them walking to whoever is winning them; each happening forms
 * in mist at the palace doors and comes down the square along a gilt channel in the cobbles' joints to a font at the
 * front, where the slices it lights flash as it arrives. All of it on the map's lattice, so the map's pictures stand on it as
 * they do on the map. The first venue, because the game is not to be battle focused. Decision record 0116.
 */
export const SQUARE: Venue = { name: 'the square', wide: WIDE, deep: DEEP };
