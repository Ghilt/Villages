/**
 * The scenery's placeholder shapes and colours, as SVG: the silhouettes the map drew in code for every kind of
 * scenery, each in the colour of the thing itself, laid out on a box `w` by `h` with its foot on the bottom edge.
 * `placeholderArt.ts` draws a kind's placeholder from them, and the marks' with the same hand. See decision record
 * 0059.
 */

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
  fern: '#4f7a3e',
};

export const n = (value: number): string => String(Math.round(value * 100) / 100);

export type Draw = (w: number, h: number, fill: string) => string;

export const ellipse = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${n(cx - rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)}Z`;

const rect = (x: number, y: number, width: number, height: number, fill: string): string =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" fill="${fill}"/>`;

export const path = (d: string, fill: string, stroke = ''): string =>
  `<path d="${d}" fill="${fill}" ${stroke}/>`;

export const polyline = (points: readonly (readonly [number, number])[]): string =>
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

export const SCENERY_SHAPES: Readonly<Record<string, Draw>> = {
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
  // A fern: fronds arching up and out from its foot, each a long narrow leaf.
  fern: (w, h, fill) =>
    path(
      (
        [
          [0.04, 0.66],
          [0.18, 0.26],
          [0.5, 0.04],
          [0.82, 0.26],
          [0.96, 0.66],
        ] as const
      )
        .map(([x, y]) => {
          const footX = w * 0.5;
          const tipX = w * x;
          const tipY = h * y;
          const long = Math.hypot(tipX - footX, tipY - h);
          const sideX = (-(tipY - h) / long) * w * 0.08;
          const sideY = ((tipX - footX) / long) * w * 0.08;
          const midX = (footX + tipX) / 2;
          const midY = (h + tipY) / 2 - h * 0.12;
          return (
            `M${n(footX)} ${n(h)}Q${n(midX + sideX)} ${n(midY + sideY)} ${n(tipX)} ${n(tipY)}` +
            `Q${n(midX - sideX)} ${n(midY - sideY)} ${n(footX)} ${n(h)}Z`
          );
        })
        .join(''),
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
