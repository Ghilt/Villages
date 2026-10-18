import { SCENERY_COLOURS, SCENERY_SHAPES, ellipse, n, path, polyline } from './sceneryShapes.ts';

/**
 * The placeholder pictures in `world/sprites/`, as SVG: every shape the map used to draw in code.
 *
 * These are the silhouettes that lived as Pixi `Graphics` calls in the web app, written out as path data
 * so that a tool with no browser can draw them. Scenery is drawn in its own colour, because a picture in
 * the folder carries its colour and is no longer tinted at runtime; the marks stay white, because they
 * are still tinted in a house's colours and are not drawn from files yet. See decision record 0059.
 *
 * Every drawing is laid out on a box `w` by `h` with its foot on the bottom edge, as it was in code. The scenery's
 * shapes and colours are `sceneryShapes.ts`, drawn with the same hand as the marks here.
 */

/** The box the scenery shapes were laid out in, and the margin their outlines are given. */
const SCENERY = { w: 64, h: 72 } as const;
const MARGIN = 4;

/** Which scenery kinds have a placeholder drawing, so a test can say when the kinds outgrow it. */
export function placeholderKinds(): readonly string[] {
  return Object.keys(SCENERY_SHAPES);
}

/** A drawing laid out on a box so wide and tall, with the margin its outlines are given, at so many times its size. */
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
