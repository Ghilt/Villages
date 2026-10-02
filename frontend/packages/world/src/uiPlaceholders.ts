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

/** A rectangle of the moodboard, in its own pixels, and `turned` left to right when it is one end made the other. */
export type Rect = readonly [left: number, top: number, width: number, height: number, turned?: 'turned'];

interface Named {
  readonly kind: UiKind;
  readonly name: string;
  /** What it is and where it came from, in a line, for the page. */
  readonly about: string;
}

/** A piece of the moodboard, in the moodboard's own pixels. */
export interface CutPlaceholder extends Named {
  /**
   * Where it is on the moodboard. Several rectangles, all as tall as each other, are laid side by side,
   * left to right, into one picture: a piece with something in its middle that must not be stretched -
   * the words painted on a plate - is cut either side of it and joined.
   */
  readonly from: Rect | readonly Rect[];
  /**
   * An outline to cut along, for a thing standing on something busy: in the moodboard's pixels, or, for a
   * picture joined from several rectangles, in the joined picture's, from its top left corner.
   */
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

/**
 * A gilt rule for a divider, drawn to be laid between its two ends: a line lit along its top, and at each
 * end a lozenge and a bead, so that everything which cannot stretch is outside its two cuts.
 */
function giltRule(width: number, height: number, end: number): string {
  const cy = height / 2;
  const line = height * 0.22;
  const lozenge = (cx: number) =>
    `<polygon points="${cx - end * 0.3},${cy} ${cx},${cy - height * 0.44} ${cx + end * 0.3},${cy} ${cx},${cy + height * 0.44}" ` +
    `fill="url(#boss)" stroke="#2f2210" stroke-width="${height / 18}"/>`;
  const bead = (cx: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${height * 0.15}" fill="url(#boss)" stroke="#2f2210" stroke-width="${height / 24}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    '<defs>' +
    `<linearGradient id="rule" gradientUnits="userSpaceOnUse" x1="0" y1="${cy - line / 2}" x2="0" y2="${cy + line / 2}">` +
    '<stop offset="0" stop-color="#5b4120"/><stop offset="0.2" stop-color="#f1d596"/>' +
    '<stop offset="0.45" stop-color="#d2ab66"/><stop offset="0.75" stop-color="#8c6832"/>' +
    '<stop offset="1" stop-color="#3a2a14"/></linearGradient>' +
    '<radialGradient id="boss" cx="0.5" cy="0.5" r="0.5" fx="0.66" fy="0.34">' +
    '<stop offset="0" stop-color="#fbe6b0"/><stop offset="0.45" stop-color="#d2ab66"/>' +
    '<stop offset="0.8" stop-color="#8a6630"/><stop offset="1" stop-color="#4a3418"/></radialGradient>' +
    '</defs>' +
    `<rect x="${end * 0.5}" y="${cy + line / 2}" width="${width - end}" height="${line * 0.3}" fill="rgba(0,0,0,0.35)"/>` +
    `<rect x="${end * 0.5}" y="${cy - line / 2}" width="${width - end}" height="${line}" fill="url(#rule)"/>` +
    lozenge(end * 0.32) +
    bead(end * 0.8) +
    lozenge(width - end * 0.32) +
    bead(width - end * 0.8) +
    '</svg>'
  );
}

/**
 * A tab's face: a gilt rim round its top and its sides, open at the bottom where it tucks under the pane
 * it opens, on dark wood at rest and on parchment when it is the one chosen, which is the pane's own sheet.
 */
function tabFace(width: number, height: number, chosen: boolean): string {
  const w = width;
  const h = height;
  const rim = h * 0.075;
  const r = h * 0.2;
  const body = chosen
    ? '<stop offset="0" stop-color="#ecdfc6"/><stop offset="0.55" stop-color="#d9c4a0"/><stop offset="1" stop-color="#c9b089"/>'
    : '<stop offset="0" stop-color="#4a3e2f"/><stop offset="0.5" stop-color="#342b20"/><stop offset="1" stop-color="#241e16"/>';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    '<defs>' +
    '<linearGradient id="gilt" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#f6e0a4"/><stop offset="0.25" stop-color="#d0a960"/>' +
    '<stop offset="0.7" stop-color="#8a6630"/><stop offset="1" stop-color="#5b4120"/></linearGradient>' +
    `<linearGradient id="body" x1="0" y1="0" x2="0" y2="1">${body}</linearGradient>` +
    '</defs>' +
    `<path d="M0 ${h} V${r} Q0 0 ${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h} Z" fill="#2a1d0d"/>` +
    `<path d="M${rim * 0.35} ${h} V${r} Q${rim * 0.35} ${rim * 0.35} ${r} ${rim * 0.35} H${w - r} ` +
    `Q${w - rim * 0.35} ${rim * 0.35} ${w - rim * 0.35} ${r} V${h} Z" fill="url(#gilt)"/>` +
    `<path d="M${rim} ${h} V${r + rim * 0.4} Q${rim} ${rim} ${r} ${rim} H${w - r} ` +
    `Q${w - rim} ${rim} ${w - rim} ${r + rim * 0.4} V${h} Z" fill="url(#body)"/>` +
    `<path d="M${r} ${rim * 1.6} H${w - r}" stroke="rgba(255,240,205,${chosen ? 0.5 : 0.18})" stroke-width="${rim * 0.4}"/>` +
    '</svg>'
  );
}

/**
 * A text field's face: parchment in a gilt rim, shaded at its top and bottom and not along it, so that it
 * stretches to any length without a seam, and a gilt clasp at each end inside the cuts.
 */
function fieldFace(width: number, height: number, end: number): string {
  const w = width;
  const h = height;
  const rim = h * 0.09;
  const r = h * 0.14;
  const clasp = (x: number) => {
    const bar = h * 0.07;
    const lozenge = h * 0.19;
    return (
      `<rect x="${x - bar / 2}" y="${rim * 1.7}" width="${bar}" height="${h - rim * 3.4}" rx="${bar / 2}" fill="url(#gilt)"/>` +
      `<path d="M${x} ${h / 2 - lozenge} L${x + lozenge * 0.55} ${h / 2} L${x} ${h / 2 + lozenge} ` +
      `L${x - lozenge * 0.55} ${h / 2} Z" fill="url(#gilt)" stroke="#5b4120" stroke-width="${h * 0.014}"/>`
    );
  };
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    '<defs>' +
    '<linearGradient id="gilt" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#f6e0a4"/><stop offset="0.25" stop-color="#d0a960"/>' +
    '<stop offset="0.7" stop-color="#8a6630"/><stop offset="1" stop-color="#5b4120"/></linearGradient>' +
    '<linearGradient id="sheet" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#b79a73"/><stop offset="0.2" stop-color="#d8c4a1"/>' +
    '<stop offset="0.5" stop-color="#e3d2b1"/><stop offset="0.8" stop-color="#d4bd98"/>' +
    '<stop offset="1" stop-color="#b39570"/></linearGradient>' +
    '</defs>' +
    `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="#2a1d0d"/>` +
    `<rect x="${rim * 0.35}" y="${rim * 0.35}" width="${w - rim * 0.7}" height="${h - rim * 0.7}" rx="${r * 0.9}" fill="url(#gilt)"/>` +
    `<rect x="${rim}" y="${rim}" width="${w - rim * 2}" height="${h - rim * 2}" rx="${r * 0.7}" fill="url(#sheet)"/>` +
    `<path d="M${rim + r} ${rim * 1.45} H${w - rim - r}" stroke="rgba(43,29,16,0.3)" stroke-width="${rim * 0.55}"/>` +
    clasp(end * 0.5) +
    clasp(w - end * 0.5) +
    '</svg>'
  );
}

/**
 * A meter's tube: a gilt rim round glass, its ends rounded, drawn to be cut at its two ends so that it lays
 * at any length. Empty, the glass is dark; full, it is lit green, as the moodboard's faith bar is.
 */
function meterTube(width: number, height: number, full: boolean): string {
  const w = width;
  const h = height;
  const rim = h * 0.18;
  const glass = full
    ? '<stop offset="0" stop-color="#2e4520"/><stop offset="0.28" stop-color="#9cc069"/>' +
      '<stop offset="0.5" stop-color="#6c9a43"/><stop offset="1" stop-color="#2a3f1c"/>'
    : '<stop offset="0" stop-color="#121719"/><stop offset="0.3" stop-color="#34434a"/>' +
      '<stop offset="0.6" stop-color="#232d32"/><stop offset="1" stop-color="#0f1315"/>';
  const stadium = (inset: number) => {
    const r = h / 2 - inset;
    return (
      `M${h / 2} ${inset} H${w - h / 2} A${r} ${r} 0 0 1 ${w - h / 2} ${h - inset} ` +
      `H${h / 2} A${r} ${r} 0 0 1 ${h / 2} ${inset} Z`
    );
  };
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    '<defs>' +
    '<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#f6e0a4"/><stop offset="0.35" stop-color="#c79f5c"/>' +
    '<stop offset="0.7" stop-color="#7e5d2c"/><stop offset="1" stop-color="#4a3418"/></linearGradient>' +
    `<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">${glass}</linearGradient>` +
    '</defs>' +
    `<path d="${stadium(0)}" fill="#2a1d0d"/>` +
    `<path d="${stadium(h * 0.04)}" fill="url(#rim)"/>` +
    `<path d="${stadium(rim)}" fill="url(#glass)"/>` +
    `<path d="M${h / 2} ${rim + h * 0.1} H${w - h / 2}" stroke="rgba(255,250,235,${full ? 0.45 : 0.16})" ` +
    `stroke-width="${h * 0.07}" stroke-linecap="round"/>` +
    '</svg>'
  );
}

/** An outline round a circle, in `steps` straight pieces: the knob on a slider, standing on a tube. */
function circle(cx: number, cy: number, r: number, steps = 24): Point[] {
  return Array.from({ length: steps }, (_, at) => {
    const turn = (2 * Math.PI * at) / steps;
    return [
      Math.round((cx + r * Math.cos(turn)) * 10) / 10,
      Math.round((cy + r * Math.sin(turn)) * 10) / 10,
    ] as const;
  });
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

/** A divider's rule as shown: as long as it is painted at, as tall as its lozenges, and its two ends. */
const RULE = { width: 160, height: 9, end: 14 };

/** A tab's face as shown: tall, and wide enough to stretch, with its rounded corners outside its cuts. */
const TAB = { width: 64, height: 40, end: 12 };

/** A text field as shown: as tall as a button, its clasps in its ends, and a stretch of parchment between. */
const FIELD = { width: 96, height: 44, end: 16 };

/** A meter's tube as shown: long enough to stretch, as tall as the moodboard's faith bar, its rounded ends. */
const METER = { width: 120, height: 14, end: 10 };

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
  {
    kind: 'borders',
    name: 'plate',
    about:
      'the moodboard’s Paris plate: its left end, a strip of its middle, and the same end turned for the ' +
      'right, leaving out the words and the emblem painted on it',
    // A strip from anywhere else on the plate is lighter or darker than its end, and the join shows; one
    // from right beside the end and the end turned round for the other side are all the one sheet.
    from: [
      [233, 480, 32, 92],
      [265, 480, 3, 92],
      [233, 480, 32, 92, 'turned'],
    ],
    // In the joined picture's pixels: it stands on the map, so it is cut along its rim and its leaves.
    outline: [
      [35, 15],
      [36, 11],
      [39, 4],
      [42, 10],
      [46, 20],
      [50, 29],
      [54, 35],
      [62, 37],
      [64, 40],
      [60, 42],
      [55, 43],
      [54, 47],
      [57, 51],
      [56, 55],
      [52, 59],
      [50, 65],
      [47, 71],
      [46, 77],
      [43, 83],
      [39, 81],
      [35, 77],
      [32, 77],
      [28, 81],
      [24, 83],
      [21, 77],
      [20, 71],
      [17, 65],
      [15, 59],
      [11, 55],
      [10, 51],
      [13, 47],
      [12, 43],
      [7, 42],
      [3, 40],
      [5, 37],
      [13, 35],
      [17, 29],
      [21, 20],
      [25, 10],
      [28, 4],
      [31, 11],
      [32, 15],
    ],
    border: { slice: [24, 32, 24, 32], repeat: 'stretch', middle: true },
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
  {
    kind: 'fills',
    name: 'stone',
    about: 'painted: the dark stone Adam’s frame of acanthus stood on, which repeated would band',
    fill: 'stone',
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

  {
    kind: 'embellishments',
    name: 'knot-boss',
    about: 'the round knot in the middle of one of the moodboard’s dividers',
    from: [1201, 384, 20, 21],
    key: true,
  },
  {
    kind: 'embellishments',
    name: 'knot-fleur',
    about: 'the fleur-de-lis in the middle of one of the moodboard’s dividers',
    from: [1068, 410, 21, 23],
    key: true,
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
    name: 'field',
    about:
      'drawn: parchment in a gilt rim with a clasp at each end, for words to be written in; the moodboard’s ' +
      'own has its words painted on it and an ornament over them, so it cannot be cut without either',
    svg: fieldFace(painted(FIELD.width), painted(FIELD.height), painted(FIELD.end)),
    border: {
      slice: [painted(FIELD.height / 2), painted(FIELD.end), painted(FIELD.height / 2), painted(FIELD.end)],
      repeat: 'stretch',
    },
  },
  // A carousel's dots: one a thing, and the one it is showing lit.
  {
    kind: 'controls',
    name: 'dot',
    about: 'a gilt ring from between the moodboard’s carousel arrows, one for each thing',
    from: [1389, 207, 14, 14],
    outline: circle(1396, 213.8, 6.6),
  },
  {
    kind: 'controls',
    name: 'dot-at',
    about: 'the gilt knob on the moodboard’s slider, for the thing a carousel is showing',
    from: [1079, 196, 37, 37],
    outline: circle(1097.5, 214, 16.5),
  },
  {
    kind: 'controls',
    name: 'round-plain',
    about: 'drawn: a gilt ring round dark stone, for a drawn mark to stand on',
    svg: roundFace(painted(64)),
  },
  {
    kind: 'controls',
    name: 'tab',
    about: 'drawn: a tab at rest, dark wood in a gilt rim, open at the bottom where it tucks under its pane',
    svg: tabFace(painted(TAB.width), painted(TAB.height), false),
    border: {
      slice: [painted(TAB.height / 2), painted(TAB.end), painted(TAB.height / 2), painted(TAB.end)],
      repeat: 'stretch',
    },
  },
  {
    kind: 'controls',
    name: 'tab-chosen',
    about: 'drawn: the tab that is chosen, on the parchment of the pane it opens',
    svg: tabFace(painted(TAB.width), painted(TAB.height), true),
    border: {
      slice: [painted(TAB.height / 2), painted(TAB.end), painted(TAB.height / 2), painted(TAB.end)],
      repeat: 'stretch',
    },
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

  // The slider, the moodboard's, in three pictures: its track, joined from its two ends and a strip of the
  // empty tube; a strip of the lit tube, which is laid from the left end to the knob; and the knob, cut
  // round, because it stands on the tube.
  {
    kind: 'controls',
    name: 'slider',
    about:
      'the moodboard’s slider, its drape and its ornament joined by a strip of its empty tube, for a ' +
      'knob to travel along',
    from: [
      [931, 183, 94, 65],
      [1150, 183, 6, 65],
      [1205, 183, 30, 65],
    ],
    // Its tube along the picture's middle, which is where the knob is centred, so it reaches as far above the
    // tube as the drape hangs below. Along an outline rather than keyed: the drape's folds and the empty
    // glass are as dark as the ground.
    outline: [
      [0, 32],
      [4.5, 25],
      [9.5, 20],
      [12.6, 13.75],
      [17, 10],
      [21.4, 10.6],
      [27, 13.75],
      [34.5, 14.4],
      [40.75, 15],
      [45.75, 15.6],
      [52, 18.75],
      [59.5, 21.25],
      [72, 21.25],
      [82, 20],
      [92, 20.6],
      [94, 21.3],
      [100, 21.3],
      [106, 22],
      [110.5, 24],
      [115, 21.5],
      [116, 20.5],
      [118, 19.5],
      [121.5, 20],
      [123, 22],
      [123, 25.5],
      [125.5, 27],
      [127.5, 29.5],
      [129.2, 32],
      [127.5, 35],
      [125, 36],
      [123, 37.5],
      [122.5, 41],
      [122, 44],
      [120, 45.5],
      [117.5, 44.5],
      [116, 42],
      [112, 41],
      [108, 41],
      [105.5, 43],
      [100, 43.8],
      [94, 43.8],
      [92, 46.25],
      [84.5, 45],
      [82, 50],
      [77, 55],
      [74.5, 63.75],
      [70.75, 63.75],
      [69.5, 57.5],
      [67, 55],
      [62, 50],
      [57, 49.4],
      [52, 48.75],
      [42, 48.75],
      [34.5, 47.5],
      [28.25, 51.25],
      [27, 56.25],
      [21.4, 56.25],
      [19.5, 51.25],
      [13.25, 47.5],
      [9.5, 43.75],
      [5.75, 38.75],
      [2, 34.4],
    ],
    border: { slice: [32, 30, 33, 94], repeat: 'stretch' },
  },
  {
    kind: 'controls',
    name: 'slider-fill',
    about: 'a strip of the moodboard’s slider where its tube is lit, laid from the left end to the knob',
    from: [1035, 183, 6, 65],
    // Past the strip's own sides, so that its ends stay whole when it is stretched along the tube.
    outline: [
      [1032, 204.2],
      [1044, 204.2],
      [1044, 226.6],
      [1032, 226.6],
    ],
  },
  {
    kind: 'controls',
    name: 'slider-knob',
    about: 'the gilt knob on the moodboard’s slider',
    // Its ring in the middle of the picture, which is the point laid on the tube's middle.
    from: [1079, 196, 37, 37],
    outline: circle(1097.5, 214, 16.5),
  },

  // The meter: a tube to show a level in, drawn, and the same tube full.
  {
    kind: 'controls',
    name: 'meter',
    about: 'drawn: a gilt tube of dark glass, for a level to be shown in',
    svg: meterTube(painted(METER.width), painted(METER.height), false),
    border: {
      slice: [painted(METER.height / 2), painted(METER.end), painted(METER.height / 2), painted(METER.end)],
      repeat: 'stretch',
    },
  },
  {
    kind: 'controls',
    name: 'meter-full',
    about: 'drawn: the same tube full, lit green as the moodboard’s faith bar is, shown as far as the level',
    svg: meterTube(painted(METER.width), painted(METER.height), true),
    border: {
      slice: [painted(METER.height / 2), painted(METER.end), painted(METER.height / 2), painted(METER.end)],
      repeat: 'stretch',
    },
  },

  // Dividers: a rule laid between its two ends. The knots that stand in the middle of one are
  // embellishments, above, because any knot goes on any rule.
  {
    kind: 'dividers',
    name: 'gilt',
    about: 'drawn: the moodboard’s gilt rule, a lozenge and a bead at each end',
    svg: giltRule(painted(RULE.width), painted(RULE.height), painted(RULE.end)),
    border: { slice: [0, painted(RULE.end), 0, painted(RULE.end)], repeat: 'stretch', middle: true },
  },
];

/** What a placeholder is, by its kind and name, for the page to say. */
export function placeholderAbout(kind: UiKind, name: string): string | undefined {
  return UI_PLACEHOLDERS.find((placeholder) => placeholder.kind === kind && placeholder.name === name)?.about;
}
