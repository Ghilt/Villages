/**
 * The interface's placeholders: the agent's stand-ins for Adam's pictures, so that the page at
 * /admin/inspect-ui-components looks like the moodboard from the first day rather than like grey boxes.
 *
 * Most are **cut out of the moodboard itself**, `world/ui/moodboard.webp`, by a rectangle of it measured
 * in its own pixels, and made four times the size, because every picture in `world/ui/` is painted at
 * four times the size it is shown. They are soft for it, and rough on purpose: they are there to judge a
 * layout and a cut by, not a style. The rest are **drawn** - a gilt border that repeats cleanly, which
 * none of the moodboard's samples do, and the fills, which have to repeat without a seam.
 *
 * `npm run world:ui --prefix frontend -- --placeholders` writes one for every name here that has no
 * picture, and never writes over a picture that is there. See decision record 0068.
 */

import type { BorderFile, UiKind } from './uiArt.ts';
import { PAINTED_AT } from './uiArt.ts';
import type { FillName } from './uiFills.ts';

export type Point = readonly [number, number];

interface Named {
  readonly kind: UiKind;
  readonly name: string;
  /** What it is and where it came from, in a line, for the page. */
  readonly about: string;
}

/** A piece of the moodboard, in the moodboard's own pixels. */
export interface CutPlaceholder extends Named {
  readonly from: readonly [left: number, top: number, width: number, height: number];
  /** An outline to cut along, for a thing standing on something busy, in the moodboard's pixels. */
  readonly outline?: readonly Point[];
  /** Whether to key the moodboard's dark ground away, for a thing standing on it. */
  readonly key?: boolean;
  /** For a border, where its cuts go, in the moodboard's pixels. */
  readonly border?: BorderFile;
}

/** Drawn as SVG, at the size it is painted. */
export interface DrawnPlaceholder extends Named {
  readonly svg: string;
  /** For a border, where its cuts go, in the picture's own pixels. */
  readonly border?: BorderFile;
}

/** Painted pixel by pixel, a fill that repeats. */
export interface PaintedPlaceholder extends Named {
  readonly fill: FillName;
  /** Its width and height as painted. */
  readonly size: number;
}

export type UiPlaceholder = CutPlaceholder | DrawnPlaceholder | PaintedPlaceholder;

/** The size the rectangles below were measured on; a different moodboard is not cut from. */
export const MOODBOARD_SIZE = { width: 1536, height: 1024 } as const;

/**
 * One side's worth of a moulding, outer edge to inner: where each colour stands, as a share of the width.
 * The light comes from the upper right, as it does on everything (`LOOK-AND-FEEL.md`).
 */
const MOULDING: readonly (readonly [number, string])[] = [
  [0, '#2f2210'],
  [0.06, '#3a2a14'],
  [0.08, '#a98446'],
  [0.15, '#f1d596'],
  [0.23, '#8c6832'],
  [0.3, '#47321a'],
  [0.36, '#6f5228'],
  [0.5, '#e3c17f'],
  [0.64, '#b38c4d'],
  [0.76, '#7a592b'],
  [0.79, '#efd18f'],
  [0.84, '#5b4120'],
  [0.9, '#34260f'],
  [0.93, '#c9a15c'],
  [1, '#7d5d2e'],
];

/**
 * A gilt frame drawn to be sliced: four mitred sides whose moulding runs the same the whole way along,
 * so an edge can be laid at any length without a seam, and a rosette over each mitre, in the corners, so
 * the only thing that cannot repeat is inside a cut.
 */
function giltFrame(size: number, moulding: number, rosette: boolean): string {
  const s = size;
  const m = moulding;
  const stops = MOULDING.map(([at, colour]) => `<stop offset="${at}" stop-color="${colour}"/>`).join('');
  const sides = [
    // name, the side's outline, the gradient's run from its outer edge to its inner, and its light
    ['top', `0,0 ${s},0 ${s - m},${m} ${m},${m}`, [0, 0, 0, m], 'rgba(255,248,225,0.10)'],
    ['right', `${s},0 ${s},${s} ${s - m},${s - m} ${s - m},${m}`, [s, 0, s - m, 0], 'rgba(255,248,225,0.04)'],
    ['bottom', `${s},${s} 0,${s} ${m},${s - m} ${s - m},${s - m}`, [0, s, 0, s - m], 'rgba(20,12,4,0.22)'],
    ['left', `0,${s} 0,0 ${m},${m} ${m},${s - m}`, [0, 0, m, 0], 'rgba(20,12,4,0.12)'],
  ] as const;
  const gradients = sides
    .map(
      ([name, , [x1, y1, x2, y2]]) =>
        `<linearGradient id="${name}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`,
    )
    .join('');
  const faces = sides
    .map(
      ([name, points, , light]) =>
        `<polygon points="${points}" fill="url(#${name})"/><polygon points="${points}" fill="${light}"/>`,
    )
    .join('');
  const mitres = (
    [
      [0, 0, m, m],
      [s, 0, s - m, m],
      [s, s, s - m, s - m],
      [0, s, m, s - m],
    ] as const
  )
    .map(
      ([x1, y1, x2, y2]) =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(40,26,10,0.55)" stroke-width="${m / 36}"/>`,
    )
    .join('');
  const corners = (
    [
      [m / 2, m / 2],
      [s - m / 2, m / 2],
      [s - m / 2, s - m / 2],
      [m / 2, s - m / 2],
    ] as const
  )
    .map(([cx, cy]) =>
      rosette
        ? `<circle cx="${cx}" cy="${cy}" r="${m * 0.36}" fill="url(#boss)" stroke="#2f2210" stroke-width="${m / 24}"/>` +
          `<circle cx="${cx}" cy="${cy}" r="${m * 0.22}" fill="none" stroke="#5b4120" stroke-width="${m / 30}"/>` +
          `<circle cx="${cx}" cy="${cy}" r="${m * 0.08}" fill="#f6dda0"/>`
        : `<polygon points="${cx},${cy - m * 0.42} ${cx + m * 0.42},${cy} ${cx},${cy + m * 0.42} ${cx - m * 0.42},${cy}" ` +
          `fill="url(#boss)" stroke="#2f2210" stroke-width="${m / 16}"/>`,
    )
    .join('');
  const boss =
    '<radialGradient id="boss" cx="0.5" cy="0.5" r="0.5" fx="0.66" fy="0.34">' +
    '<stop offset="0" stop-color="#fbe6b0"/><stop offset="0.45" stop-color="#d2ab66"/>' +
    '<stop offset="0.8" stop-color="#8a6630"/><stop offset="1" stop-color="#4a3418"/></radialGradient>';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">` +
    `<defs>${gradients}${boss}</defs>${faces}${mitres}${corners}</svg>`
  );
}

/**
 * A round face for a mark button: a gilt ring round dark stone, lit from the upper right, with nothing on
 * it, so a drawn mark can stand in the middle. The moodboard's round buttons all have their mark painted
 * in, which is one way; this is the other.
 */
function roundFace(size: number): string {
  const c = size / 2;
  const r = size / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    '<defs>' +
    '<linearGradient id="ring" x1="1" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#f6e0a4"/><stop offset="0.3" stop-color="#d0a960"/>' +
    '<stop offset="0.65" stop-color="#86622f"/><stop offset="1" stop-color="#3f2c12"/></linearGradient>' +
    '<radialGradient id="stone" cx="0.5" cy="0.5" r="0.5" fx="0.62" fy="0.36">' +
    '<stop offset="0" stop-color="#5b5246"/><stop offset="0.6" stop-color="#3a332a"/>' +
    '<stop offset="1" stop-color="#1f1a14"/></radialGradient>' +
    '</defs>' +
    `<circle cx="${c}" cy="${c}" r="${r * 0.97}" fill="#2a1d0d"/>` +
    `<circle cx="${c}" cy="${c}" r="${r * 0.93}" fill="url(#ring)"/>` +
    `<circle cx="${c}" cy="${c}" r="${r * 0.8}" fill="#34260f"/>` +
    `<circle cx="${c}" cy="${c}" r="${r * 0.77}" fill="url(#stone)"/>` +
    `<circle cx="${c}" cy="${c}" r="${r * 0.77}" fill="none" stroke="rgba(255,240,205,0.22)" stroke-width="${size / 90}"/>` +
    '</svg>'
  );
}

/** An outline round a box with its short ends made half circles, as an oval button is, in eight steps a half. */
function stadium(left: number, top: number, width: number, height: number): Point[] {
  const r = height / 2;
  const cy = top + r;
  const ends = [
    { cx: left + width - r, from: -Math.PI / 2 },
    { cx: left + r, from: Math.PI / 2 },
  ];
  return ends.flatMap(({ cx, from }) =>
    Array.from({ length: 9 }, (_, at) => {
      const turn = from + (Math.PI * at) / 8;
      return [
        Math.round((cx + r * Math.cos(turn)) * 10) / 10,
        Math.round((cy + r * Math.sin(turn)) * 10) / 10,
      ] as const;
    }),
  );
}

/** The width of a moulding in shown pixels, and so of the drawn frames' cuts. */
const GILT = { size: 96, moulding: 18, cut: 24 };
const THIN = { size: 48, moulding: 8, cut: 12 };

const painted = (shown: number) => shown * PAINTED_AT;

/** Every placeholder there is, in the order the page shows them. */
export const UI_PLACEHOLDERS: readonly UiPlaceholder[] = [
  // Borders. The two drawn ones first, because they are the ones that slice cleanly.
  {
    kind: 'borders',
    name: 'gilt-simple',
    about: 'drawn: a gilt moulding the same the whole way along, with a rosette over each mitre',
    svg: giltFrame(painted(GILT.size), painted(GILT.moulding), true),
    border: {
      slice: [painted(GILT.cut), painted(GILT.cut), painted(GILT.cut), painted(GILT.cut)],
      repeat: 'stretch',
    },
  },
  {
    kind: 'borders',
    name: 'gilt-thin',
    about: 'drawn: a narrow gilt moulding for a card, a lozenge on each mitre',
    svg: giltFrame(painted(THIN.size), painted(THIN.moulding), false),
    border: {
      slice: [painted(THIN.cut), painted(THIN.cut), painted(THIN.cut), painted(THIN.cut)],
      repeat: 'stretch',
    },
  },
  {
    kind: 'borders',
    name: 'gilt-drape',
    about: 'the moodboard’s gilt frame with a red drape in one corner and a cherub in the other',
    from: [16, 654, 108, 117],
    border: { slice: [40, 30, 28, 42], repeat: 'stretch', middle: true },
  },
  {
    kind: 'borders',
    name: 'stone-arch',
    about: 'the moodboard’s stone arch on two columns',
    from: [142, 658, 107, 111],
    border: { slice: [46, 24, 24, 24], repeat: 'stretch', middle: true },
  },
  {
    kind: 'borders',
    name: 'lapis-drape',
    about: 'the moodboard’s frame with a blue drape and a laurel',
    from: [266, 658, 106, 111],
    border: { slice: [38, 34, 30, 34], repeat: 'stretch', middle: true },
  },
  {
    kind: 'borders',
    name: 'cloud-scroll',
    about: 'the moodboard’s frame of clouds and a scroll',
    from: [391, 658, 104, 111],
    border: { slice: [36, 34, 36, 34], repeat: 'stretch', middle: true },
  },
  {
    kind: 'borders',
    name: 'gothic-cross',
    about: 'the moodboard’s gothic arch with a cross at its crown',
    from: [514, 658, 107, 111],
    border: { slice: [46, 24, 24, 24], repeat: 'stretch', middle: true },
  },
  {
    kind: 'borders',
    name: 'sunburst-clouds',
    about: 'the moodboard’s frame with a sun breaking through clouds',
    from: [640, 658, 107, 111],
    border: { slice: [42, 36, 30, 30], repeat: 'stretch', middle: true },
  },
  {
    kind: 'borders',
    name: 'column-science',
    about: 'the moodboard’s columns, with a flask, a wheel and a cherub',
    from: [764, 656, 112, 112],
    border: { slice: [30, 40, 34, 34], repeat: 'stretch', middle: true },
  },

  // Fills: painted to repeat without a seam, 128 pixels square as shown.
  {
    kind: 'fills',
    name: 'parchment',
    about: 'painted: mottled paper with faint fibres',
    fill: 'parchment',
    size: painted(128),
  },
  {
    kind: 'fills',
    name: 'night',
    about: 'painted: the dark the moodboard lies on',
    fill: 'night',
    size: painted(128),
  },
  { kind: 'fills', name: 'dark-wood', about: 'painted: a dark grain', fill: 'dark-wood', size: painted(128) },
  {
    kind: 'fills',
    name: 'velvet',
    about: 'painted: red velvet hanging in folds',
    fill: 'velvet',
    size: painted(128),
  },

  // Embellishments, cut along an outline because each stands over the busy map in the moodboard.
  {
    kind: 'embellishments',
    name: 'cherub-standing',
    about: 'the cherub standing at the foot of the cathedral’s panel',
    from: [812, 225, 60, 123],
    outline: [
      [836, 229],
      [846, 227],
      [854, 231],
      [858, 238],
      [860, 246],
      [865, 247],
      [869, 255],
      [868, 266],
      [863, 274],
      [860, 284],
      [861, 298],
      [858, 310],
      [861, 322],
      [864, 334],
      [862, 343],
      [853, 345],
      [848, 338],
      [842, 328],
      [834, 322],
      [828, 313],
      [824, 302],
      [821, 292],
      [816, 286],
      [814, 279],
      [818, 274],
      [822, 272],
      [823, 262],
      [826, 250],
      [830, 240],
      [833, 233],
    ],
  },
  {
    kind: 'embellishments',
    name: 'cross-gilt',
    about: 'the gilt cross standing on the cathedral’s panel',
    from: [698, 91, 49, 62],
    outline: [
      [719, 93],
      [726, 93],
      [729, 99],
      [728, 106],
      [729, 110],
      [736, 110],
      [739, 107],
      [743, 110],
      [745, 116],
      [743, 122],
      [739, 125],
      [736, 122],
      [729, 122],
      [729, 146],
      [727, 151],
      [718, 151],
      [716, 146],
      [716, 122],
      [709, 122],
      [706, 125],
      [702, 122],
      [700, 116],
      [702, 110],
      [706, 107],
      [709, 110],
      [716, 110],
      [717, 106],
      [716, 99],
    ],
  },
  {
    kind: 'embellishments',
    name: 'drape-velvet',
    about: 'the red drape hanging behind the cathedral’s panel',
    from: [816, 146, 48, 106],
    outline: [
      [818, 152],
      [832, 148],
      [846, 150],
      [852, 160],
      [856, 176],
      [860, 196],
      [862, 214],
      [860, 232],
      [852, 238],
      [840, 232],
      [830, 236],
      [823, 246],
      [818, 250],
    ],
  },
  {
    kind: 'embellishments',
    name: 'sunburst',
    about: 'the sun at the end of the moodboard’s dividers',
    from: [1370, 398, 52, 44],
    key: true,
    outline: [
      [1396, 398],
      [1414, 404],
      [1422, 420],
      [1414, 436],
      [1396, 442],
      [1378, 436],
      [1370, 420],
      [1378, 404],
    ],
  },

  // Controls: a button's face at rest, keyed off the moodboard's dark ground. The two drapes and the oval
  // are cut like a border, so a button stretches to its words; the round ones are one size, their marks
  // painted in, and the drawn round face has none, for a drawn mark to stand on.
  {
    kind: 'controls',
    name: 'primary',
    about: 'the moodboard’s primary button, a red drape over a gilt bar',
    from: [916, 73, 138, 65],
    // Along an outline rather than keyed: the drape's darkest folds are as dark as the ground it lies on.
    outline: [
      [923, 78],
      [946, 76],
      [1028, 75],
      [1050, 77],
      [1053, 95],
      [1053, 118],
      [1046, 124],
      [1041, 133],
      [1030, 133],
      [1000, 135],
      [986, 137],
      [970, 134],
      [940, 133],
      [926, 136],
      [922, 128],
      [919, 108],
      [919, 92],
    ],
    border: { slice: [32, 42, 33, 42], repeat: 'stretch' },
  },
  {
    kind: 'controls',
    name: 'secondary',
    about: 'the moodboard’s secondary button, a blue drape in a gilt frame',
    from: [1059, 78, 98, 57],
    outline: [
      [1061, 80],
      [1155, 80],
      [1155, 134],
      [1061, 134],
    ],
    border: { slice: [28, 30, 29, 30], repeat: 'stretch' },
  },
  {
    kind: 'controls',
    name: 'oval',
    about: 'the moodboard’s oval, stone in a gilt rim',
    from: [1162, 75, 101, 61],
    outline: stadium(1163, 76, 99, 59),
    border: { slice: [30, 34, 31, 34], repeat: 'stretch' },
  },
  {
    kind: 'controls',
    name: 'close',
    about: 'the moodboard’s close, a cross on red in a gilt ring',
    from: [1261, 276, 65, 68],
    key: true,
  },
  {
    kind: 'controls',
    name: 'minimise',
    about: 'the moodboard’s minimise, a bar in a gilt ring',
    from: [1351, 284, 59, 57],
    key: true,
  },
  {
    kind: 'controls',
    name: 'maximise',
    about: 'the moodboard’s maximise, a square in a gilt ring',
    from: [1445, 278, 59, 63],
    key: true,
  },
  {
    kind: 'controls',
    name: 'previous',
    about: 'the moodboard’s carousel arrow, pointing back',
    from: [1272, 180, 67, 72],
    key: true,
  },
  {
    kind: 'controls',
    name: 'next',
    about: 'the moodboard’s carousel arrow, pointing on',
    from: [1441, 174, 65, 70],
    key: true,
  },
  {
    kind: 'controls',
    name: 'round-plain',
    about: 'drawn: a gilt ring round dark stone, for a drawn mark to stand on',
    svg: roundFace(painted(64)),
  },

  // Medallions, keyed off the dark ground they stand on.
  {
    kind: 'medallions',
    name: 'compass',
    about: 'the moodboard’s compass icon',
    from: [912, 442, 138, 152],
    key: true,
  },
  {
    kind: 'medallions',
    name: 'portrait-oval',
    about: 'the moodboard’s character icon, a portrait in an oval with a drape',
    from: [1068, 440, 146, 156],
    key: true,
  },
  {
    kind: 'medallions',
    name: 'shield',
    about: 'the moodboard’s house shield',
    from: [1236, 456, 128, 142],
    key: true,
  },
  {
    kind: 'medallions',
    name: 'sigil',
    about: 'the moodboard’s house sigil, an eagle crowned',
    from: [1386, 446, 126, 150],
    key: true,
  },
];

/** What a placeholder is, by its kind and name, for the page to say. */
export function placeholderAbout(kind: UiKind, name: string): string | undefined {
  return UI_PLACEHOLDERS.find((placeholder) => placeholder.kind === kind && placeholder.name === name)?.about;
}
