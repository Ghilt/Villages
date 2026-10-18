import { circle, ellipse, leg, path } from './critterShapes.ts';
import type { CritterFrame } from './critterShapes.ts';

/**
 * The placeholders of the animals of the sea and the ground step 14 of docs/plans/living-world.md brings, drawn as the
 * first casts' are (`critterPlaceholders.ts`): stand-ins to judge the cut and how a critter reads in motion, not its
 * look, lit from the upper right, on a transparent ground. Its birds are `critterPlaceholdersBirds.ts`.
 */

/** A dolphin seen from the side as it leaps, facing right: grey, darker along its back, its flukes up and then down. */
const dolphin: CritterFrame = (at) => {
  const flukes = at === 0 ? 'M 28 74 L 4 56 L 12 74 L 2 92 Z' : 'M 28 78 L 6 68 L 12 80 L 4 102 Z';
  return (
    path(flukes, '#56636f') +
    ellipse(64, 76, 40, 14, '#7d8c99') +
    path('M 26 76 Q 64 54 104 72 Q 64 66 26 76 Z', '#56636f') +
    path('M 56 64 L 66 44 L 74 64 Z', '#56636f') +
    ellipse(70, 84, 26, 5, '#d8dee3') +
    path('M 100 70 L 120 76 L 100 82 Z', '#7d8c99') +
    circle(96, 72, 2.5, '#121a22')
  );
};

/** Spray, white and thin, so the sea shows through it. */
const mist = (cx: number, cy: number, rx: number, ry: number, opacity: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#f2f6fa" fill-opacity="${opacity}"/>`;

/**
 * A whale blowing, seen from the side, standing on the bottom edge where its back breaks the sea: its back coming up
 * with a puff of spray, then a tall spout standing up out of it and spreading at the top, then its back going under
 * and the spray drifting down.
 */
const whale: CritterFrame = (at) => {
  const back = [
    ellipse(64, 118, 40, 9, '#36414b') + ellipse(70, 114, 18, 3, '#4c5864'),
    ellipse(64, 116, 44, 11, '#36414b') + ellipse(70, 111, 20, 3, '#4c5864'),
    ellipse(60, 122, 30, 6, '#36414b'),
  ][at]!;
  const spray = [
    mist(64, 100, 8, 8, 0.8) + mist(60, 92, 5, 5, 0.6),
    mist(64, 76, 6, 30, 0.85) +
      mist(54, 40, 14, 11, 0.75) +
      mist(74, 38, 14, 11, 0.75) +
      mist(64, 30, 10, 9, 0.7),
    mist(40, 92, 20, 9, 0.4) +
      mist(88, 90, 20, 9, 0.4) +
      mist(64, 100, 26, 10, 0.45) +
      mist(64, 76, 12, 12, 0.3),
  ][at]!;
  return back + spray;
};

/** A lizard dashing to the right, low and flat: its legs splayed one way, under it, and the other way, its tail swinging. */
const lizard: CritterFrame = (at) => {
  // Darker than the sand it runs on, with a pale stripe along its back, so it reads there by its colour.
  const skin = '#7f6436';
  const dark = '#5a4524';
  const legs = [
    leg(50, 112, 40, 120, dark, 4) + leg(80, 112, 90, 120, dark, 4),
    leg(50, 112, 56, 120, dark, 4) + leg(80, 112, 72, 120, dark, 4),
    leg(50, 112, 60, 120, dark, 4) + leg(80, 112, 88, 120, dark, 4),
  ][at]!;
  const tail = ['M 42 112 Q 22 110 4 117', 'M 42 112 Q 22 104 4 109', 'M 42 112 Q 24 117 4 113'][at]!;
  return (
    `<path d="${tail}" stroke="${skin}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    legs +
    ellipse(66, 111, 26, 7, skin) +
    ellipse(68, 108, 18, 3, '#d1bb84') +
    ellipse(96, 110, 10, 6, skin) +
    circle(100, 107, 1.8, '#1a140a')
  );
};

/** A marmot facing right: sitting up on its haunches to look about, then loping stretched out, then landing. */
const marmot: CritterFrame = (at) => {
  const fur = '#8a6a44';
  const dark = '#5e4630';
  const pale = '#b39468';
  if (at === 0) {
    return (
      ellipse(44, 112, 9, 5, dark) +
      ellipse(60, 96, 18, 24, fur, -8) +
      ellipse(65, 100, 9, 15, pale, -8) +
      ellipse(58, 118, 10, 4, dark) +
      circle(66, 66, 12, fur) +
      ellipse(76, 70, 5, 3.5, dark) +
      circle(72, 63, 2.2, '#140e08')
    );
  }
  const body =
    at === 1 ? { x: 62, y: 104, rx: 28, ry: 12, turn: -4 } : { x: 62, y: 108, rx: 24, ry: 12, turn: 8 };
  const head = (at === 1 ? [94, 98] : [86, 108]) as [number, number];
  const legs =
    at === 1
      ? leg(42, 110, 28, 120, dark, 6) + leg(82, 110, 96, 120, dark, 6)
      : leg(46, 114, 40, 120, dark, 6) + leg(78, 114, 84, 120, dark, 6);
  return (
    legs +
    ellipse(body.x - body.rx, body.y - 2, 9, 5, dark) +
    ellipse(body.x, body.y, body.rx, body.ry, fur, body.turn) +
    ellipse(body.x + 4, body.y - 4, body.rx * 0.6, body.ry * 0.45, pale, body.turn) +
    circle(head[0], head[1], 10, fur) +
    ellipse(head[0] + 8, head[1] + 3, 4, 3, dark) +
    circle(head[0] + 4, head[1] - 3, 2, '#140e08')
  );
};

/** The black at the end of an ear, from its root to its tip: the last third of it, lying along it. */
const earTip = (rootX: number, rootY: number, tipX: number, tipY: number) => {
  const turn = (Math.atan2(tipY - rootY, tipX - rootX) * 180) / Math.PI;
  const x = rootX + (tipX - rootX) * 0.85;
  const y = rootY + (tipY - rootY) * 0.85;
  return ellipse(x, y, Math.hypot(tipX - rootX, tipY - rootY) * 0.17, 2.2, '#1f1f22', turn);
};

/** An arctic hare bounding to the right as the hare does: white, its ears tipped black, shaded cool. */
const arcticHare: CritterFrame = (at) => {
  const white = '#eef1f4';
  const shade = '#cfd6dc';
  const body = [
    { x: 60, y: 96, rx: 20, ry: 17, turn: -25 },
    { x: 64, y: 90, rx: 32, ry: 11, turn: -4 },
    { x: 62, y: 98, rx: 24, ry: 14, turn: 10 },
  ][at]!;
  const head = (
    [
      [78, 70],
      [98, 82],
      [84, 92],
    ] as const
  )[at]!;
  const ears = (
    [
      [76, 38, 86, 40],
      [114, 64, 110, 60],
      [96, 68, 104, 72],
    ] as const
  )[at]!;
  const legs = [
    leg(52, 108, 46, 118, shade, 6) + leg(70, 106, 74, 118, shade, 6),
    leg(36, 94, 18, 106, shade, 6) + leg(90, 96, 104, 114, shade, 6),
    leg(48, 108, 40, 118, shade, 6) + leg(76, 106, 84, 118, shade, 6),
  ][at]!;
  return (
    legs +
    ellipse(body.x, body.y, body.rx, body.ry, white, body.turn) +
    ellipse(body.x - 3, body.y + 6, body.rx * 0.7, body.ry * 0.4, shade, body.turn) +
    path(
      `M ${head[0] - 3} ${head[1] - 6} L ${ears[0]} ${ears[1]} L ${head[0] + 2} ${head[1] - 8} Z ` +
        `M ${head[0] + 2} ${head[1] - 7} L ${ears[2]} ${ears[3]} L ${head[0] + 6} ${head[1] - 5} Z`,
      '#dde2e7',
    ) +
    earTip(head[0] - 1, head[1] - 7, ears[0], ears[1]) +
    earTip(head[0] + 4, head[1] - 6, ears[2], ears[3]) +
    ellipse(head[0], head[1], 11, 9, white) +
    circle(head[0] + 5, head[1] - 2, 2, '#1d120b')
  );
};

/** Every placeholder drawn here, by its kind's name in `world/critters.json`. */
export const WILD_DRAWINGS: Readonly<Record<string, CritterFrame>> = {
  dolphin,
  whale,
  lizard,
  marmot,
  'arctic-hare': arcticHare,
};
