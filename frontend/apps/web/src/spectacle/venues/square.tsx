import type { Arrangement, Point, Venue } from './venue';
import { crowdOf, mirrored } from './venue';

/** The square's cobbles, the diamonds turned as the map's ground is, worn paler where the crowd stands. */
function Cobbles({ width, height, id }: { width: number; height: number; id: string }) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <pattern id={`${id}-cobbles`} width="40" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 10 L20 0 L40 10 L20 20 Z" fill="none" stroke="rgba(60,48,30,0.16)" />
        </pattern>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bcae8b" />
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
        cy={height * 0.64}
        rx={width * 0.34}
        ry={height * 0.2}
        fill={`url(#${id}-worn)`}
      />
      <rect width={width} height={height} fill={`url(#${id}-cobbles)`} />
    </svg>
  );
}

const WIDE_W = 1440;
const WIDE_H = 900;
const WIDE_A_SPEAKER: Point = { x: 300, y: 500 };
const WIDE_A_SUMMONS: readonly Point[] = [
  { x: 165, y: 560 },
  { x: 235, y: 612 },
  { x: 92, y: 606 },
  { x: 310, y: 640 },
  { x: 160, y: 655 },
];
const WIDE_A_LINE: readonly Point[] = [
  { x: 105, y: 432 },
  { x: 235, y: 398 },
];
const WIDE_ROWS = [425, 482, 539, 596];
const WIDE_FONT: Point = { x: 720, y: 650 };
const WIDE_A_CHANNEL: readonly Point[] = [
  { x: 720, y: 662 },
  { x: 560, y: 694 },
  { x: 390, y: 640 },
  { x: 300, y: 582 },
];

/** The square held wide: the town's hall at the back, a platform at each end, the crowd between them. */
const WIDE: Arrangement = {
  scene: { width: WIDE_W, height: WIDE_H },
  figure: 74,
  ground: <Cobbles width={WIDE_W} height={WIDE_H} id="square-wide" />,
  buildings: [
    { picture: 'palace', x: 720, y: 318, height: 240 },
    { picture: 'market', x: 425, y: 328, height: 165 },
    { picture: 'manor', x: 1025, y: 325, height: 170 },
    { picture: 'mill', x: 1240, y: 288, height: 135 },
  ],
  trees: [
    { kind: 'oak', x: 70, y: 335, height: 190 },
    { kind: 'beech', x: 1385, y: 305, height: 170 },
    { kind: 'pine', x: 170, y: 255, height: 150 },
    { kind: 'birch', x: 1290, y: 250, height: 140 },
    { kind: 'spruce', x: 560, y: 190, height: 120 },
    { kind: 'pine', x: 880, y: 186, height: 115 },
    { kind: 'scrub', x: 40, y: 900, height: 120 },
    { kind: 'grass', x: 1400, y: 890, height: 60 },
  ],
  platforms: { a: WIDE_A_SPEAKER, b: { x: WIDE_W - WIDE_A_SPEAKER.x, y: WIDE_A_SPEAKER.y } },
  summons: { a: WIDE_A_SUMMONS, b: mirrored(WIDE_A_SUMMONS, WIDE_W) },
  onTheLine: { a: WIDE_A_LINE, b: mirrored(WIDE_A_LINE, WIDE_W) },
  lineHeight: 150,
  townsfolk: {
    a: crowdOf([445, 497, 549, 601, 653], WIDE_ROWS, WIDE_A_SPEAKER, 20, 21),
    b: crowdOf(
      [787, 839, 891, 943, 995],
      WIDE_ROWS,
      { x: WIDE_W - WIDE_A_SPEAKER.x, y: WIDE_A_SPEAKER.y },
      20,
      22,
    ),
  },
  mist: { x: 720, y: 348 },
  path: [{ x: 720, y: 352 }, { x: 704, y: 425 }, { x: 736, y: 505 }, { x: 716, y: 585 }, WIDE_FONT],
  receptacle: WIDE_FONT,
  channels: { a: WIDE_A_CHANNEL, b: mirrored(WIDE_A_CHANNEL, WIDE_W) },
  seal: 72,
};

const DEEP_W = 900;
const DEEP_H = 1440;
const DEEP_A_SPEAKER: Point = { x: 240, y: 600 };
const DEEP_A_SUMMONS: readonly Point[] = [
  { x: 150, y: 702 },
  { x: 225, y: 742 },
  { x: 135, y: 786 },
  { x: 220, y: 822 },
  { x: 150, y: 862 },
];
const DEEP_A_LINE: readonly Point[] = [
  { x: 105, y: 528 },
  { x: 335, y: 478 },
];
const DEEP_ROWS = [650, 705, 760, 815, 870];
const DEEP_FONT: Point = { x: 450, y: 940 };
const DEEP_A_CHANNEL: readonly Point[] = [
  { x: 450, y: 952 },
  { x: 320, y: 938 },
  { x: 255, y: 870 },
  { x: 240, y: 682 },
];

/**
 * The square held deep: the same two banks made deep, the town's hall at the far end, each platform near it on its
 * own bank, the summons below it one behind another, the crowd up the middle either side of the happenings' lane, and
 * the font under them, clear of the trays a deep stage stands its slices in. Everything that matters stands between
 * 130 and 770 across, so a phone, narrower than the scene, crops only the edges.
 */
const DEEP: Arrangement = {
  scene: { width: DEEP_W, height: DEEP_H },
  figure: 78,
  ground: <Cobbles width={DEEP_W} height={DEEP_H} id="square-deep" />,
  buildings: [
    { picture: 'palace', x: 450, y: 330, height: 220 },
    { picture: 'market', x: 215, y: 412, height: 140 },
    { picture: 'manor', x: 690, y: 405, height: 140 },
  ],
  trees: [
    { kind: 'pine', x: 125, y: 300, height: 130 },
    { kind: 'oak', x: 795, y: 330, height: 150 },
    { kind: 'spruce', x: 330, y: 215, height: 100 },
    { kind: 'birch', x: 590, y: 210, height: 100 },
    { kind: 'scrub', x: 60, y: 1440, height: 120 },
  ],
  platforms: { a: DEEP_A_SPEAKER, b: { x: DEEP_W - DEEP_A_SPEAKER.x, y: DEEP_A_SPEAKER.y } },
  summons: { a: DEEP_A_SUMMONS, b: mirrored(DEEP_A_SUMMONS, DEEP_W) },
  onTheLine: { a: DEEP_A_LINE, b: mirrored(DEEP_A_LINE, DEEP_W) },
  lineHeight: 125,
  townsfolk: {
    a: crowdOf([298, 338, 378, 418], DEEP_ROWS, DEEP_A_SPEAKER, 20, 23),
    b: crowdOf(
      [482, 522, 562, 602],
      DEEP_ROWS,
      { x: DEEP_W - DEEP_A_SPEAKER.x, y: DEEP_A_SPEAKER.y },
      20,
      24,
    ),
  },
  mist: { x: 450, y: 352 },
  path: [{ x: 450, y: 356 }, { x: 440, y: 480 }, { x: 458, y: 640 }, { x: 444, y: 800 }, DEEP_FONT],
  receptacle: DEEP_FONT,
  channels: { a: DEEP_A_CHANNEL, b: mirrored(DEEP_A_CHANNEL, DEEP_W) },
  seal: 76,
};

/**
 * The square: a sermon, a debate or a trade war in a town square, each house's speaker on a platform at the back of its
 * bank, its summons beside it, and the townsfolk between them walking to whoever is winning them; each happening forms
 * in mist at the palace doors, comes down the square along gilt channels to a font at the front, and jolts the
 * platforms along channels to each. The first venue, because the game is not to be battle focused. Decision record
 * 0116.
 */
export const SQUARE: Venue = { name: 'the square', wide: WIDE, deep: DEEP };
