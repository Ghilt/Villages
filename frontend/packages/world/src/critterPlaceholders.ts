/**
 * The placeholders `world:critters` draws for the critters Adam has not painted: one strip a kind, its frames side
 * by side, each a square, drawn from simple shapes. They are stand-ins for the pictures, there to judge the cut and
 * how a critter reads in motion, not its look. Lit from the upper right, as every picture on the map is
 * (`LOOK-AND-FEEL.md`), on a transparent ground, standing on the bottom edge where the kind stands on anything.
 */

/** How big a frame of a placeholder is drawn, before the cut crops and scales it. */
export const CRITTER_DRAWN = 128;

type Frame = (at: number) => string;

const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, turn = 0) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${turn} ${cx} ${cy})"/>`;
const circle = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
const path = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`;
const leg = (x1: number, y1: number, x2: number, y2: number, colour: string, width = 5) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colour}" stroke-width="${width}" stroke-linecap="round"/>`;

/** A small bird seen from behind and above, its wings up, then level, then down: one beat. */
const songbird: Frame = (at) => {
  const tips = [
    [22, 30, 106, 30],
    [12, 70, 116, 70],
    [26, 104, 102, 104],
  ][at]!;
  const [lx, ly, rx, ry] = tips as [number, number, number, number];
  const wing = (tx: number, ty: number, side: number) =>
    path(
      `M ${64 - 6 * side} 70 Q ${(64 + tx) / 2} ${(70 + ty) / 2 - 10} ${tx} ${ty} ` +
        `Q ${(64 + tx) / 2 + 4 * side} ${(70 + ty) / 2 + 8} ${64 - 2 * side} 82 Z`,
      side < 0 ? '#5b4636' : '#7a604a',
    );
  return (
    wing(lx, ly, 1) +
    wing(rx, ry, -1) +
    path('M 58 92 L 64 112 L 70 92 Z', '#4a382b') +
    ellipse(64, 80, 11, 16, '#6b5240') +
    ellipse(67, 76, 5, 9, '#9a7c5e') +
    circle(64, 62, 8, '#5b4636') +
    circle(66, 59, 3, '#8f7358')
  );
};

/** A squirrel bounding to the right: gathered, stretched out in the air, landing. */
const squirrel: Frame = (at) => {
  const body = [
    {
      x: 64,
      y: 96,
      rx: 20,
      ry: 13,
      turn: -10,
      tail: 'M 46 96 C 18 92 14 52 34 40 C 44 34 52 46 44 56 C 38 66 42 84 52 92 Z',
    },
    {
      x: 66,
      y: 88,
      rx: 28,
      ry: 10,
      turn: 0,
      tail: 'M 40 88 C 18 86 6 72 10 58 C 14 50 24 56 26 64 C 30 74 36 80 46 84 Z',
    },
    {
      x: 66,
      y: 98,
      rx: 21,
      ry: 12,
      turn: 12,
      tail: 'M 48 96 C 24 98 12 70 26 52 C 34 44 44 52 38 62 C 34 72 40 86 52 92 Z',
    },
  ][at]!;
  const head = [
    [84, 84],
    [94, 82],
    [84, 98],
  ][at]! as [number, number];
  const legs = [
    leg(56, 104, 52, 118, '#6e3a1e') + leg(76, 104, 80, 118, '#6e3a1e'),
    leg(46, 94, 34, 112, '#6e3a1e') + leg(88, 92, 104, 110, '#6e3a1e'),
    leg(58, 106, 54, 118, '#6e3a1e') + leg(80, 104, 86, 118, '#6e3a1e'),
  ][at]!;
  return (
    path(body.tail, '#b8673a') +
    legs +
    ellipse(body.x, body.y, body.rx, body.ry, '#9c4f2a', body.turn) +
    ellipse(body.x + 4, body.y - 4, body.rx * 0.6, body.ry * 0.45, '#c07648', body.turn) +
    circle(head[0], head[1], 10, '#9c4f2a') +
    path(
      `M ${head[0] - 4} ${head[1] - 8} L ${head[0]} ${head[1] - 20} L ${head[0] + 4} ${head[1] - 8} Z`,
      '#7f3f20',
    ) +
    circle(head[0] + 4, head[1] - 2, 2, '#1d120b')
  );
};

/** A hare bounding to the right: sitting up, stretched out in the air, gathered again. */
const hare: Frame = (at) => {
  const body = [
    { x: 60, y: 96, rx: 20, ry: 17, turn: -25 },
    { x: 64, y: 90, rx: 32, ry: 11, turn: -4 },
    { x: 62, y: 98, rx: 24, ry: 14, turn: 10 },
  ][at]!;
  const head = [
    [78, 70],
    [98, 82],
    [84, 92],
  ][at]! as [number, number];
  const ears = [
    [76, 36, 86, 38],
    [116, 64, 112, 60],
    [96, 66, 104, 70],
  ][at]! as [number, number, number, number];
  const legs = [
    leg(52, 108, 46, 118, '#5e4c36', 6) + leg(70, 106, 74, 118, '#5e4c36', 6),
    leg(36, 94, 18, 106, '#5e4c36', 6) + leg(90, 96, 104, 114, '#5e4c36', 6),
    leg(48, 108, 40, 118, '#5e4c36', 6) + leg(76, 106, 84, 118, '#5e4c36', 6),
  ][at]!;
  return (
    legs +
    ellipse(body.x, body.y, body.rx, body.ry, '#8a7458', body.turn) +
    ellipse(body.x + 5, body.y - 5, body.rx * 0.55, body.ry * 0.45, '#a68f70', body.turn) +
    circle(body.x - body.rx + 2, body.y - 4, 6, '#f2efe6') +
    path(
      `M ${head[0] - 3} ${head[1] - 6} L ${ears[0]} ${ears[1]} L ${head[0] + 2} ${head[1] - 8} Z ` +
        `M ${head[0] + 2} ${head[1] - 7} L ${ears[2]} ${ears[3]} L ${head[0] + 6} ${head[1] - 5} Z`,
      '#7a6448',
    ) +
    ellipse(head[0], head[1], 11, 9, '#8a7458') +
    circle(head[0] + 5, head[1] - 2, 2, '#1d120b')
  );
};

/** A fish seen from the side as it leaps, its tail flicked one way and then the other. */
const fish: Frame = (at) => {
  const tail = at === 0 ? 'M 36 78 L 2 44 L 18 76 L 10 96 Z' : 'M 36 82 L 10 64 L 18 84 L 2 116 Z';
  return (
    path(tail, '#4d6878') +
    ellipse(66, 80, 34, 15, '#9fb7c6') +
    path('M 34 78 Q 66 56 100 78 Q 66 70 34 78 Z', '#3f5a6b') +
    path('M 58 66 L 70 54 L 76 68 Z', '#4d6878') +
    ellipse(70, 86, 20, 5, '#d4e2ea') +
    circle(90, 76, 3, '#13202a')
  );
};

/**
 * A hawk seen from above, as the map is, its nose to the top of the frame, its broad wings spread to glide, then
 * swept a little back and up in a beat. The map turns it to the way it flies, so it is drawn facing up.
 */
const hawk: Frame = (at) => {
  const [tip, sweep] = at === 0 ? [62, 0] : [52, 10];
  const wing = (side: number) =>
    path(
      `M ${64 + 7 * side} 56 C ${64 + 30 * side} ${46 + sweep} ${64 + tip * side} ${50 + sweep} ` +
        `${64 + (tip - 2) * side} ${60 + sweep} C ${64 + 40 * side} ${70 + sweep} ${64 + 22 * side} 72 ${64 + 7 * side} 70 Z`,
      side > 0 ? '#8a6a4c' : '#6b4e36',
    );
  return (
    wing(1) +
    wing(-1) +
    path('M 56 86 L 72 86 L 80 112 L 48 112 Z', '#7a5c42') +
    ellipse(64, 66, 9, 24, '#6b4e36') +
    ellipse(66, 62, 4, 14, '#9a7a5a') +
    circle(64, 40, 8, '#5b4030') +
    path('M 61 33 L 64 27 L 67 33 Z', '#d9b25a')
  );
};

/**
 * A crow seen from behind and above as it bursts out of a ruin, wings up, level and down, as the songbird is drawn but
 * black, bigger in the body and ragged at the wing's end: the ruins' bird.
 */
const crow: Frame = (at) => {
  const tips = [
    [14, 24, 114, 24],
    [4, 64, 124, 64],
    [18, 104, 110, 104],
  ][at]!;
  const [lx, ly, rx, ry] = tips as [number, number, number, number];
  const wing = (tx: number, ty: number, side: number) =>
    path(
      `M ${64 - 8 * side} 68 Q ${(64 + tx) / 2} ${(68 + ty) / 2 - 12} ${tx} ${ty} ` +
        `L ${tx + 6 * side} ${ty + 6} L ${tx + 2 * side} ${ty + 10} ` +
        `Q ${(64 + tx) / 2 + 4 * side} ${(68 + ty) / 2 + 10} ${64 - 2 * side} 84 Z`,
      side < 0 ? '#16141a' : '#262329',
    );
  return (
    wing(lx, ly, 1) +
    wing(rx, ry, -1) +
    path('M 56 94 L 64 116 L 72 94 Z', '#121015') +
    ellipse(64, 80, 13, 19, '#1d1b20') +
    ellipse(67, 75, 5, 10, '#3a3640') +
    circle(64, 58, 9, '#1a181d')
  );
};

/** A crow seen from above, circling over a ruin: its wings spread to glide, then swept back in a beat, black. */
const crowAloft: Frame = (at) => {
  const [tip, sweep] = at === 0 ? [58, 0] : [48, 12];
  const wing = (side: number) =>
    path(
      `M ${64 + 6 * side} 58 C ${64 + 26 * side} ${50 + sweep} ${64 + tip * side} ${52 + sweep} ` +
        `${64 + tip * side} ${60 + sweep} L ${64 + (tip - 6) * side} ${64 + sweep} ` +
        `C ${64 + 34 * side} ${70 + sweep} ${64 + 18 * side} 72 ${64 + 6 * side} 70 Z`,
      side > 0 ? '#2a272d' : '#18161b',
    );
  return (
    wing(1) +
    wing(-1) +
    path('M 58 84 L 70 84 L 76 104 L 52 104 Z', '#1c1a1f') +
    ellipse(64, 68, 8, 20, '#1d1b20') +
    circle(64, 46, 7, '#141216') +
    path('M 62 40 L 64 32 L 66 40 Z', '#3a3640')
  );
};

/** A rat scurrying to the right, low to the ground: stretched, gathered, stretched again, its long tail behind. */
const rat: Frame = (at) => {
  const body = [
    { x: 64, y: 106, rx: 24, ry: 9, tail: 'M 42 106 C 26 108 14 102 4 108' },
    { x: 66, y: 104, rx: 18, ry: 11, tail: 'M 50 104 C 34 98 20 112 6 104' },
    { x: 62, y: 106, rx: 25, ry: 8, tail: 'M 38 106 C 24 104 14 112 4 106' },
  ][at]!;
  const legs = [
    leg(52, 112, 46, 118, '#4a3f38', 3) + leg(78, 112, 84, 118, '#4a3f38', 3),
    leg(58, 112, 56, 118, '#4a3f38', 3) + leg(74, 112, 76, 118, '#4a3f38', 3),
    leg(48, 112, 40, 118, '#4a3f38', 3) + leg(80, 112, 88, 118, '#4a3f38', 3),
  ][at]!;
  const head = body.x + body.rx;
  return (
    `<path d="${body.tail}" stroke="#8a6f66" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    legs +
    ellipse(body.x, body.y, body.rx, body.ry, '#5d5049') +
    ellipse(body.x + 3, body.y - 3, body.rx * 0.6, body.ry * 0.45, '#776860') +
    ellipse(head, body.y - 2, 9, 6, '#5d5049', -10) +
    circle(head - 4, body.y - 8, 3, '#a48a80') +
    circle(head + 3, body.y - 4, 1.5, '#0e0b0a')
  );
};

const DRAWINGS: Record<string, Frame> = {
  songbird,
  squirrel,
  hare,
  fish,
  hawk,
  crow,
  'crow-aloft': crowAloft,
  rat,
};

/** The kinds a placeholder can be drawn for. A kind listed in `world/critters.json` and not here is drawn as a blot. */
export function critterPlaceholderKinds(): string[] {
  return Object.keys(DRAWINGS);
}

/** A placeholder strip for a kind with so many frames, as SVG, a square frame each. */
export function critterPlaceholderSvg(kind: string, frames: number): string {
  const draw = DRAWINGS[kind] ?? ((at: number) => circle(64, 100, 14 + 2 * at, '#6b5a4a'));
  const size = CRITTER_DRAWN;
  const drawn = Array.from(
    { length: frames },
    (_, at) => `<g transform="translate(${at * size} 0)">${draw(at % 3)}</g>`,
  ).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size * frames}" height="${size}" ` +
    `viewBox="0 0 ${size * frames} ${size}">${drawn}</svg>`
  );
}
