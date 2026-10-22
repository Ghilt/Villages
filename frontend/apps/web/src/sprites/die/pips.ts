import { FACES } from './physics';
import type { Vec3 } from './physics';

/**
 * Which number of pips each face of the die carries. A die is laid out as a real one is: opposite faces add to seven,
 * and the one, the two and the three meet at a corner turning the same way on every die. Any number can be put on any
 * face by turning that layout, one of the twenty-four ways a cube can be turned, so the face a throw will leave on top
 * can be painted with the number the game wants before the die has moved. See `docs/plans/choice-roll-podium.md`,
 * *The pips*.
 */

/** The numbers on the faces of a die not yet turned, in the order of `FACES`: east, west, south, north, up, down. */
export const LAYOUT: readonly number[] = [2, 5, 3, 4, 1, 6];

/** A turn of the cube onto itself: where each of the three axes goes, as a signed axis. */
type Turn = readonly [Vec3, Vec3, Vec3];

const AXES: readonly Vec3[] = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];

function determinant([a, b, c]: Turn): number {
  return a.x * (b.y * c.z - b.z * c.y) - a.y * (b.x * c.z - b.z * c.x) + a.z * (b.x * c.y - b.y * c.x);
}

/** The twenty-four turns of a cube onto itself: every signed choice of axes that is not a mirror. */
export const TURNS: readonly Turn[] = [0, 1, 2].flatMap((i) =>
  [0, 1, 2]
    .filter((j) => j !== i)
    .flatMap((j) => {
      const k = 3 - i - j;
      return [1, -1].flatMap((si) =>
        [1, -1].flatMap((sj) =>
          [1, -1]
            .map((sk): Turn => [scaled(AXES[i]!, si), scaled(AXES[j]!, sj), scaled(AXES[k]!, sk)])
            .filter((turn) => determinant(turn) > 0),
        ),
      );
    }),
);

function scaled(v: Vec3, by: number): Vec3 {
  return { x: v.x * by, y: v.y * by, z: v.z * by };
}

function applied(turn: Turn, v: Vec3): Vec3 {
  return {
    x: turn[0].x * v.x + turn[1].x * v.y + turn[2].x * v.z,
    y: turn[0].y * v.x + turn[1].y * v.y + turn[2].y * v.z,
    z: turn[0].z * v.x + turn[1].z * v.y + turn[2].z * v.z,
  };
}

function faceOf(direction: Vec3): number {
  return FACES.findIndex(
    (face) => face.x === direction.x && face.y === direction.y && face.z === direction.z,
  );
}

/** The numbers each face carries once the layout is turned: which face each face's number came from. */
export function turnedLayout(turn: Turn): number[] {
  const numbers = new Array<number>(FACES.length).fill(0);
  FACES.forEach((face, from) => {
    numbers[faceOf(applied(turn, face))] = LAYOUT[from]!;
  });
  return numbers;
}

/** A real die's layout with `number` on the face `face`, which is where a throw will leave it on top. */
export function layoutShowing(face: number, number: number): number[] {
  for (const turn of TURNS) {
    const numbers = turnedLayout(turn);
    if (numbers[face] === number) return numbers;
  }
  throw new Error(`no die shows ${number} on face ${face}`);
}
