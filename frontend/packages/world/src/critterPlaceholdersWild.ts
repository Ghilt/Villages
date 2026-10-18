import { circle, ellipse, path } from './critterShapes.ts';
import type { CritterFrame } from './critterShapes.ts';

/**
 * The placeholders of the casts step 14 of docs/plans/living-world.md gives the rest of the world's ground, drawn as
 * the first casts' are (`critterPlaceholders.ts`): stand-ins to judge the cut and how a critter reads in motion, not
 * its look, lit from the upper right, on a transparent ground. Each is a kind's three frames, or its first two.
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

/** Every placeholder drawn here, by its kind's name in `world/critters.json`. */
export const WILD_DRAWINGS: Readonly<Record<string, CritterFrame>> = {
  partridge,
  lark,
  grouse,
  duck,
  ptarmigan,
};
