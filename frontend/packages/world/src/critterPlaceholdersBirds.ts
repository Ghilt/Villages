import { circle, ellipse, path } from './critterShapes.ts';
import type { CritterFrame } from './critterShapes.ts';

/**
 * The placeholders of the birds step 14 of docs/plans/living-world.md brings, drawn as the first casts' are
 * (`critterPlaceholders.ts`): those that burst up, seen from behind as the songbird is, and those that circle, seen
 * from above as the hawk is. Stand-ins to judge the cut and how a bird reads in motion, not its look.
 */

/** A bird bursting up and away, as the songbird is drawn: its colours, how wide its wings and how big its body. */
interface Bursting {
  /** Its wings, the far one darker; its body and the light along its back; its head and the light on it; its tail. */
  wings: readonly [string, string];
  body: string;
  back: string;
  head: string;
  cheek: string;
  tail: string;
  /** How far its wings reach against the songbird's, and how big its body is against the songbird's. */
  span: number;
  plump: number;
  /** How long its tail is, from its body, in the frame's units. */
  tailLength: number;
  /** What it has that the others do not, drawn over its head: a crest, a comb, a ring about its neck. */
  marks?: (head: { x: number; y: number }) => string;
  /** A band of colour across each wing, a duck's. */
  band?: string;
}

/** A bird seen from behind and above as it bursts up, its wings up, then level, then down: one beat. */
function bursting(look: Bursting): CritterFrame {
  return (at) => {
    const tips = [
      [22, 30, 106, 30],
      [12, 70, 116, 70],
      [26, 104, 102, 104],
    ][at]!;
    const [lx, ly, rx, ry] = tips.map((value, index) =>
      index % 2 === 0 ? 64 + (value - 64) * look.span : value,
    ) as [number, number, number, number];
    const wing = (tx: number, ty: number, side: number) =>
      path(
        `M ${64 - 6 * side} 70 Q ${(64 + tx) / 2} ${(70 + ty) / 2 - 10} ${tx} ${ty} ` +
          `Q ${(64 + tx) / 2 + 4 * side} ${(70 + ty) / 2 + 8} ${64 - 2 * side} 82 Z`,
        side < 0 ? look.wings[0] : look.wings[1],
      );
    // Half way out along the wing, between its leading edge and its trailing one, lying along it.
    const band = (tx: number, ty: number, side: number) => {
      if (look.band === undefined) return '';
      const x = (64 - 4 * side + tx) / 2;
      const y = (76 + ty) / 2;
      const turn = (Math.atan2(ty - 76, tx - 64) * 180) / Math.PI;
      return ellipse(x, y, 9, 3, look.band, turn);
    };
    const below = 80 + 16 * look.plump;
    const head = { x: 64, y: 80 - 16 * look.plump - 6 };
    return (
      wing(lx, ly, 1) +
      wing(rx, ry, -1) +
      band(lx, ly, 1) +
      band(rx, ry, -1) +
      path(`M 58 ${below - 4} L 64 ${below - 4 + look.tailLength} L 70 ${below - 4} Z`, look.tail) +
      ellipse(64, 80, 11 * look.plump, 16 * look.plump, look.body) +
      ellipse(67, 76, 5 * look.plump, 9 * look.plump, look.back) +
      circle(head.x, head.y, 8 * Math.sqrt(look.plump), look.head) +
      circle(head.x + 2, head.y - 3, 3, look.cheek) +
      (look.marks?.(head) ?? '')
    );
  };
}

/** A partridge of the fields: grey-brown and round, its face orange and its short tail rufous. */
const partridge = bursting({
  wings: ['#6f6252', '#8f8170'],
  body: '#8c8070',
  back: '#a99d8a',
  head: '#c4874e',
  cheek: '#d9a46c',
  tail: '#a55a34',
  span: 0.9,
  plump: 1.2,
  tailLength: 12,
});

/** A lark of the grassland: small and streaked brown, a little crest on its head. */
const lark = bursting({
  wings: ['#6e5c42', '#977f5c'],
  body: '#8f7a58',
  back: '#b09a72',
  head: '#7d6848',
  cheek: '#a48c66',
  tail: '#5e4c36',
  span: 1,
  plump: 0.85,
  tailLength: 20,
  marks: (head) =>
    path(
      `M ${head.x - 4} ${head.y - 4} L ${head.x} ${head.y - 15} L ${head.x + 4} ${head.y - 4} Z`,
      '#6a5638',
    ),
});

/** A grouse of the heather: dark red-brown and plump, a red comb over its eye. */
const grouse = bursting({
  wings: ['#5a2f1e', '#7b4630'],
  body: '#6e3b26',
  back: '#8a5034',
  head: '#5c3020',
  cheek: '#7a4430',
  tail: '#3a2014',
  span: 0.95,
  plump: 1.3,
  tailLength: 12,
  marks: (head) => ellipse(head.x + 4, head.y - 5, 5, 2.5, '#c23b22', -15),
});

/** A duck of the wet land: grey-brown, its head green with a white ring under it, a blue band on its wings. */
const duck = bursting({
  wings: ['#6e695c', '#908a7c'],
  body: '#8a8576',
  back: '#a7a294',
  head: '#2e6a46',
  cheek: '#3f8a5c',
  tail: '#3a3a3a',
  span: 1.05,
  plump: 1.2,
  tailLength: 12,
  marks: (head) => ellipse(head.x, head.y + 9, 8, 2.5, '#eeeeea'),
  band: '#3b5fa8',
});

/** A ptarmigan of the snow: white all over but for its black tail and a red mark over its eye, shaded cool. */
const ptarmigan = bursting({
  wings: ['#d6dde6', '#f6f8fa'],
  body: '#e6eaef',
  back: '#ffffff',
  head: '#e4e9ee',
  cheek: '#f4f6f8',
  tail: '#1f1f22',
  span: 0.95,
  plump: 1.15,
  tailLength: 12,
  marks: (head) => ellipse(head.x + 4, head.y - 5, 4, 2, '#c8402c', -15),
});

/**
 * A gull seen from above, as the hawk is, its nose to the top of the frame: long narrow wings, grey with black tips,
 * spread to glide and then swept back a little in a beat; white beneath and a yellow bill.
 */
const gull: CritterFrame = (at) => {
  const [tip, sweep] = at === 0 ? [62, 0] : [54, 9];
  const wing = (side: number) =>
    path(
      `M ${64 + 6 * side} 58 C ${64 + 30 * side} ${50 + sweep} ${64 + tip * side} ${54 + sweep} ` +
        `${64 + tip * side} ${60 + sweep} C ${64 + 40 * side} ${64 + sweep} ${64 + 20 * side} 66 ${64 + 6 * side} 66 Z`,
      side > 0 ? '#b9c0c6' : '#a4acb3',
    ) + ellipse(64 + (tip - 5) * side, 58 + sweep, 6, 3, '#222428');
  return (
    wing(1) +
    wing(-1) +
    path('M 58 82 L 70 82 L 72 98 L 56 98 Z', '#e9ebe8') +
    ellipse(64, 66, 7, 20, '#f2f2ee') +
    ellipse(65, 62, 3, 12, '#ffffff') +
    circle(64, 44, 7, '#f4f4f0') +
    path('M 62 38 L 64 30 L 66 38 Z', '#e0b030')
  );
};

/** A big bird circling, seen from above as the hawk is: broad wings fingered at their ends, its own colours. */
interface Broad {
  wings: readonly [string, string];
  fingers: string;
  body: string;
  back: string;
  /** The ruff or the nape behind its head, its head and its beak. */
  neck: string;
  head: string;
  beak: string;
  tail: string;
  /** Its tail, as a path under its body. */
  tailShape: string;
}

function broad(look: Broad): CritterFrame {
  return (at) => {
    const [tip, sweep] = at === 0 ? [62, 0] : [54, 8];
    const wing = (side: number) =>
      path(
        `M ${64 + 7 * side} 54 C ${64 + 30 * side} ${44 + sweep} ${64 + tip * side} ${48 + sweep} ` +
          `${64 + tip * side} ${60 + sweep} C ${64 + 42 * side} ${76 + sweep} ${64 + 22 * side} 76 ${64 + 7 * side} 72 Z`,
        side > 0 ? look.wings[1] : look.wings[0],
      );
    const fingers = (side: number) =>
      [0, 1, 2]
        .map((k) => ellipse(64 + (tip - 3 - k * 5) * side, 58 + sweep + k * 4, 6, 2, look.fingers, 70 * side))
        .join('');
    return (
      wing(1) +
      wing(-1) +
      fingers(1) +
      fingers(-1) +
      path(look.tailShape, look.tail) +
      ellipse(64, 66, 10, 24, look.body) +
      ellipse(66, 62, 4, 14, look.back) +
      ellipse(64, 46, 8, 5, look.neck) +
      circle(64, 38, 7, look.head) +
      path('M 61 31 L 64 24 L 67 31 Z', look.beak)
    );
  };
}

/** A vulture: dark brown, a pale ruff about its bare pinkish head. */
const vulture = broad({
  wings: ['#3e3328', '#54463a'],
  fingers: '#241c15',
  body: '#4a3d31',
  back: '#6a5948',
  neck: '#d9cfc0',
  head: '#c99b8a',
  beak: '#e8dcc0',
  tail: '#3e3328',
  tailShape: 'M 56 86 L 72 86 L 74 100 L 54 100 Z',
});

/** An eagle: dark brown, its nape golden and its beak yellow, its tail longer than a vulture's. */
const eagle = broad({
  wings: ['#4a3422', '#5f4530'],
  fingers: '#2a1d12',
  body: '#553b26',
  back: '#7a5636',
  neck: '#c79a4a',
  head: '#6b4a2c',
  beak: '#e0b030',
  tail: '#4a3422',
  tailShape: 'M 56 86 L 72 86 L 78 108 L 50 108 Z',
});

/** Every bird drawn here, by its kind's name in `world/critters.json`. */
export const BIRD_DRAWINGS: Readonly<Record<string, CritterFrame>> = {
  partridge,
  lark,
  grouse,
  duck,
  ptarmigan,
  gull,
  vulture,
  eagle,
};
