/**
 * The placeholder pictures in `world/sprites/`, as SVG: every shape the map used to draw in code.
 *
 * These are the silhouettes that lived as Pixi `Graphics` calls in the web app, written out as path data
 * so that a tool with no browser can draw them. Scenery is drawn in its own colour, because a picture in
 * the folder carries its colour and is no longer tinted at runtime; the marks stay white, because they
 * are still tinted in a house's colours and are not drawn from files yet. See decision record 0059.
 *
 * Every drawing is laid out on a box `w` by `h` with its foot on the bottom edge, as it was in code.
 */

/** The box the scenery shapes were laid out in, and the margin their outlines are given. */
const SCENERY = { w: 64, h: 72 } as const;
const MARGIN = 4;

const LINE = 'stroke="#3d4a33" stroke-opacity="0.85" stroke-width="3" stroke-linejoin="round"';
const FINE = 'stroke="#4a5237" stroke-opacity="0.85" stroke-width="2.4" stroke-linejoin="round"';
const TRUNK = '#6b5a44';

/**
 * What each kind was tinted, which is now what its placeholder is painted: the colour of the thing itself
 * rather than of the ground, darker than the paint almost everywhere so that it is a mark on the ground.
 */
export const SCENERY_COLOURS: Readonly<Record<string, string>> = {
  pine: '#4a6b47',
  spruce: '#37543c',
  birch: '#8fae6a',
  oak: '#5c8244',
  beech: '#6b9150',
  palm: '#5a9161',
  jungle: '#2f7055',
  acacia: '#8a9a52',
  mangrove: '#47705c',
  snag: '#9c9282',
  scrub: '#8a9159',
  heather: '#8f7a94',
  grass: '#93ab63',
  reed: '#9aa758',
  boulder: '#a3968a',
  cactus: '#6f8f5c',
};

const n = (value: number): string => String(Math.round(value * 100) / 100);

type Draw = (w: number, h: number, fill: string) => string;

const ellipse = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${n(cx - rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)}Z`;

const rect = (x: number, y: number, width: number, height: number, fill: string): string =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" fill="${fill}"/>`;

const path = (d: string, fill: string, stroke = ''): string => `<path d="${d}" fill="${fill}" ${stroke}/>`;

const polyline = (points: readonly (readonly [number, number])[]): string =>
  points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${n(x)} ${n(y)}`).join('') + 'Z';

/** A conifer of a given waist: tiers of needles over a short trunk. */
const conifer =
  (waist: number, tiers: number): Draw =>
  (w, h, fill) => {
    const right: [number, number][] = [];
    const left: [number, number][] = [];
    for (let tier = 1; tier <= tiers; tier += 1) {
      const down = (tier / tiers) * 0.82;
      const out = waist * (tier / tiers);
      right.push([w * (0.5 + out), h * down], [w * (0.5 + out * 0.66), h * down]);
      left.unshift([w * (0.5 - out * 0.66), h * down], [w * (0.5 - out), h * down]);
    }
    right[right.length - 1] = [w * (0.5 + waist), h * 0.82];
    left[0] = [w * (0.5 - waist), h * 0.82];
    return (
      rect(w * 0.45, h * 0.8, w * 0.1, h * 0.2, TRUNK) +
      path(polyline([[w * 0.5, 0], ...right, ...left]), fill, LINE)
    );
  };

/** A broadleaf: a crown on a trunk. */
const broadleaf =
  (wide: number, tall: number, crownAt: number): Draw =>
  (w, h, fill) =>
    rect(w * 0.46, h * (crownAt + tall * 0.55), w * 0.08, h * (1 - crownAt - tall * 0.55), TRUNK) +
    path(ellipse(w * 0.5, h * crownAt, w * wide, h * tall), fill, LINE);

const SCENERY_SHAPES: Readonly<Record<string, Draw>> = {
  pine: conifer(0.36, 3),
  spruce: conifer(0.26, 4),
  birch: (w, h, fill) =>
    rect(w * 0.47, h * 0.5, w * 0.06, h * 0.5, TRUNK) +
    path(ellipse(w * 0.5, h * 0.3, w * 0.24, h * 0.3), fill, FINE),
  oak: broadleaf(0.42, 0.36, 0.4),
  beech: broadleaf(0.33, 0.42, 0.36),
  palm: (w, h, fill) => {
    const stem =
      `M${n(w * 0.46)} ${n(h)}Q${n(w * 0.52)} ${n(h * 0.6)} ${n(w * 0.6)} ${n(h * 0.3)}` +
      `L${n(w * 0.66)} ${n(h * 0.32)}Q${n(w * 0.58)} ${n(h * 0.62)} ${n(w * 0.54)} ${n(h)}Z`;
    const fronds = (
      [
        [0.06, 0.34],
        [0.2, 0.06],
        [0.62, 0.0],
        [0.94, 0.18],
        [0.98, 0.46],
      ] as const
    )
      .map(
        ([toX, toY]) =>
          `M${n(w * 0.62)} ${n(h * 0.3)}Q${n(w * ((0.62 + toX) / 2))} ${n(h * (toY - 0.12))} ${n(w * toX)} ${n(h * toY)}` +
          `Q${n(w * ((0.62 + toX) / 2))} ${n(h * (toY + 0.1))} ${n(w * 0.62)} ${n(h * 0.34)}Z`,
      )
      .join('');
    return path(stem, TRUNK) + path(fronds, fill, FINE);
  },
  jungle: (w, h, fill) =>
    rect(w * 0.45, h * 0.62, w * 0.1, h * 0.38, TRUNK) +
    path(
      `M${n(w * 0.04)} ${n(h * 0.5)}Q${n(w * 0.1)} ${n(h * 0.12)} ${n(w * 0.34)} ${n(h * 0.1)}` +
        `Q${n(w * 0.5)} ${n(h * -0.04)} ${n(w * 0.68)} ${n(h * 0.1)}` +
        `Q${n(w * 0.92)} ${n(h * 0.14)} ${n(w * 0.96)} ${n(h * 0.5)}` +
        `Q${n(w * 0.5)} ${n(h * 0.66)} ${n(w * 0.04)} ${n(h * 0.5)}Z`,
      fill,
      LINE,
    ),
  acacia: (w, h, fill) =>
    path(
      polyline([
        [w * 0.46, h],
        [w * 0.48, h * 0.45],
        [w * 0.54, h * 0.45],
        [w * 0.56, h],
      ]),
      TRUNK,
    ) +
    path(
      `M${n(w * 0.04)} ${n(h * 0.4)}Q${n(w * 0.5)} ${n(h * 0.04)} ${n(w * 0.96)} ${n(h * 0.4)}` +
        `Q${n(w * 0.5)} ${n(h * 0.3)} ${n(w * 0.04)} ${n(h * 0.4)}Z`,
      fill,
      LINE,
    ),
  mangrove: (w, h, fill) => {
    const roots = [0.08, 0.28, 0.5, 0.72, 0.92]
      .map(
        (foot) =>
          `M${n(w * foot)} ${n(h)}Q${n(w * ((foot + 0.5) / 2))} ${n(h * 0.82)} ${n(w * 0.5)} ${n(h * 0.56)}` +
          `L${n(w * 0.5)} ${n(h * 0.66)}Q${n(w * ((foot + 0.5) / 2))} ${n(h * 0.9)} ${n(w * (foot + 0.06))} ${n(h)}Z`,
      )
      .join('');
    return path(roots, TRUNK) + path(ellipse(w * 0.5, h * 0.36, w * 0.4, h * 0.3), fill, LINE);
  },
  snag: (w, h, fill) =>
    path(
      polyline([
        [w * 0.44, h],
        [w * 0.44, h * 0.2],
        [w * 0.3, h * 0.06],
        [w * 0.5, h * 0.14],
        [w * 0.5, h * 0.4],
        [w * 0.78, h * 0.22],
        [w * 0.56, h * 0.52],
        [w * 0.56, h],
      ]),
      fill,
      LINE,
    ),
  scrub: (w, h, fill) =>
    path(
      ellipse(w * 0.3, h * 0.66, w * 0.28, h * 0.3) +
        ellipse(w * 0.7, h * 0.66, w * 0.26, h * 0.28) +
        ellipse(w * 0.5, h * 0.44, w * 0.32, h * 0.34),
      fill,
      FINE,
    ),
  heather: (w, h, fill) => {
    const points: [number, number][] = [[w * 0.02, h]];
    for (let at = 0; at <= 6; at += 1) {
      points.push([w * (0.02 + (at / 6) * 0.96), h * (at % 2 === 0 ? 0.34 : 0.16)]);
    }
    points.push([w * 0.98, h]);
    return path(polyline(points), fill, FINE);
  },
  grass: (w, h, fill) =>
    path(
      polyline([
        [w * 0.5, h],
        [w * 0.18, h * 0.3],
        [w * 0.36, h * 0.34],
        [w * 0.5, h * 0.08],
        [w * 0.64, h * 0.34],
        [w * 0.82, h * 0.3],
      ]),
      fill,
      FINE,
    ),
  reed: (w, h, fill) =>
    path(
      (
        [
          [0.28, 0.06, 0.1],
          [0.5, 0.1, 0.02],
          [0.72, 0.04, 0.18],
        ] as const
      )
        .map(([foot, lean, top]) =>
          polyline([
            [w * foot, h],
            [w * (foot + lean), h * top],
            [w * (foot + lean + 0.09), h * (top + 0.14)],
            [w * (foot + lean + 0.02), h * (top + 0.3)],
            [w * (foot + 0.07), h],
          ]),
        )
        .join(''),
      fill,
      FINE,
    ),
  boulder: (w, h, fill) =>
    path(
      polyline([
        [w * 0.06, h],
        [w * 0.14, h * 0.44],
        [w * 0.42, h * 0.16],
        [w * 0.72, h * 0.22],
        [w * 0.94, h * 0.58],
        [w * 0.9, h],
      ]),
      fill,
      LINE,
    ),
  cactus: (w, h, fill) =>
    path(
      `M${n(w * 0.42)} ${n(h)}L${n(w * 0.42)} ${n(h * 0.08)}Q${n(w * 0.5)} ${n(h * -0.02)} ${n(w * 0.58)} ${n(h * 0.08)}L${n(w * 0.58)} ${n(h)}Z` +
        `M${n(w * 0.42)} ${n(h * 0.52)}L${n(w * 0.2)} ${n(h * 0.52)}Q${n(w * 0.1)} ${n(h * 0.5)} ${n(w * 0.1)} ${n(h * 0.36)}` +
        `L${n(w * 0.24)} ${n(h * 0.36)}L${n(w * 0.24)} ${n(h * 0.42)}L${n(w * 0.42)} ${n(h * 0.42)}Z` +
        `M${n(w * 0.58)} ${n(h * 0.4)}L${n(w * 0.78)} ${n(h * 0.4)}Q${n(w * 0.88)} ${n(h * 0.38)} ${n(w * 0.88)} ${n(h * 0.24)}` +
        `L${n(w * 0.76)} ${n(h * 0.24)}L${n(w * 0.76)} ${n(h * 0.3)}L${n(w * 0.58)} ${n(h * 0.3)}Z`,
      fill,
      FINE,
    ),
};

/** Which scenery kinds have a placeholder drawing, so a test can say when the kinds outgrow it. */
export function placeholderKinds(): readonly string[] {
  return Object.keys(SCENERY_SHAPES);
}

function svg(width: number, height: number, body: string, scale: number): string {
  const box = `${-MARGIN} ${-MARGIN} ${width + MARGIN * 2} ${height + MARGIN * 2}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" ` +
    `width="${(width + MARGIN * 2) * scale}" height="${(height + MARGIN * 2) * scale}">${body}</svg>`
  );
}

/**
 * A scenery kind's placeholder, eight times the size it was drawn in code so that the tool shrinks it as
 * it would shrink a real picture. A kind nobody drew is the bush, which is visibly wrong rather than
 * missing, as it was in code.
 */
export function sceneryPlaceholderSvg(kind: string): string {
  const draw = SCENERY_SHAPES[kind] ?? SCENERY_SHAPES.scrub!;
  return svg(SCENERY.w, SCENERY.h, draw(SCENERY.w, SCENERY.h, SCENERY_COLOURS[kind] ?? '#6f8a55'), 8);
}

const MARK_LINE = (width: number, opacity = 0.85) =>
  `stroke="#4a4034" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linejoin="round"`;

/** The marks, laid out in the boxes `PixiSpriteRenderer.ts` draws them in, and white because they are tinted. */
const MARKS: Readonly<Record<string, { w: number; h: number; draw: (w: number, h: number) => string }>> = {
  castle: {
    w: 150,
    h: 160,
    draw: (w, h) => {
      const tower = w * 0.267;
      const towerTop = h * 0.3;
      const wallTop = h * 0.56;
      const crenel = h * 0.094;
      const gap = w * 0.089;
      return path(
        polyline([
          [3, h - 3],
          [3, towerTop],
          [3 + tower / 3, towerTop],
          [3 + tower / 3, towerTop - crenel],
          [3 + (tower * 2) / 3, towerTop - crenel],
          [3 + (tower * 2) / 3, towerTop],
          [3 + tower, towerTop],
          [3 + tower, wallTop],
          [w / 2 - gap, wallTop],
          [w / 2 - gap, wallTop - crenel],
          [w / 2 + gap, wallTop - crenel],
          [w / 2 + gap, wallTop],
          [w - 3 - tower, wallTop],
          [w - 3 - tower, towerTop],
          [w - 3 - (tower * 2) / 3, towerTop],
          [w - 3 - (tower * 2) / 3, towerTop - crenel],
          [w - 3 - tower / 3, towerTop - crenel],
          [w - 3 - tower / 3, towerTop],
          [w - 3, towerTop],
          [w - 3, h - 3],
        ]),
        '#ffffff',
        MARK_LINE(6),
      );
    },
  },
  'castle-icon': {
    w: 48,
    h: 64,
    draw: (w, h) => {
      const top = h * 0.16;
      const shoulder = h * 0.34;
      return path(
        polyline([
          [4, h - 3],
          [4, top],
          [w * 0.3, top],
          [w * 0.3, shoulder],
          [w * 0.42, shoulder],
          [w * 0.42, top],
          [w * 0.58, top],
          [w * 0.58, shoulder],
          [w * 0.7, shoulder],
          [w * 0.7, top],
          [w - 4, top],
          [w - 4, h - 3],
        ]),
        '#ffffff',
        MARK_LINE(5, 0.9),
      );
    },
  },
  candidate: {
    w: 44,
    h: 64,
    draw: (w, h) =>
      path(
        polyline([
          [4, 2],
          [w - 2, 12],
          [4, 22],
        ]),
        '#ffffff',
      ) + `<rect x="0" y="0" width="5" height="${h}" fill="#ffffff" ${MARK_LINE(3)}/>`,
  },
  figure: {
    w: 80,
    h: 160,
    draw: (w, h) => {
      const head = w * 0.2;
      return (
        path(
          polyline([
            [w / 2 - w * 0.14, head * 2.55],
            [w * 0.2, head * 3.5],
            [4, h - 3],
            [w - 4, h - 3],
            [w * 0.8, head * 3.5],
            [w / 2 + w * 0.14, head * 2.55],
          ]),
          '#ffffff',
          MARK_LINE(5),
        ) + path(ellipse(w / 2, head + 4, head, head), '#ffffff', MARK_LINE(5))
      );
    },
  },
  'figure-icon': {
    w: 60,
    h: 64,
    draw: (w, h) =>
      path(
        `M3 ${n(h - 3)}C3 ${n(h * 0.62)} ${n(w * 0.24)} ${n(h * 0.52)} ${n(w / 2)} ${n(h * 0.52)}` +
          `C${n(w * 0.76)} ${n(h * 0.52)} ${n(w - 3)} ${n(h * 0.62)} ${n(w - 3)} ${n(h - 3)}Z`,
        '#ffffff',
        MARK_LINE(5, 0.9),
      ) + path(ellipse(w / 2, h * 0.28, h * 0.2, h * 0.2), '#ffffff', MARK_LINE(5, 0.9)),
  },
  'selection-ring': {
    w: 128,
    h: 128,
    draw: (w, h) =>
      `<path d="${ellipse(w / 2, h / 2, w / 2 - 4, h / 4 - 4)}" fill="none" stroke="#ffffff" stroke-width="6"/>`,
  },
};

/** The names of the marks, which are the file names in `world/sprites/marks/`. */
export const MARK_NAMES: readonly string[] = Object.keys(MARKS);

/** A mark's placeholder, twice the size the renderer laid it out in. */
export function markPlaceholderSvg(name: string): string {
  const mark = MARKS[name];
  if (mark === undefined) {
    throw new Error(`no mark called ${name}; the marks are ${MARK_NAMES.join(', ')}`);
  }
  return svg(mark.w, mark.h, mark.draw(mark.w, mark.h), 2);
}
