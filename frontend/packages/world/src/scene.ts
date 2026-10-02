/**
 * A placeholder scene: where a conversation is happening, in cut paper, for behind a conversation.
 *
 * Plainly a placeholder, as the portraits are. The scenes a player sees are Adam's own pictures, saved over
 * these in `world/scenes/`, and until he has made them this is what stands in: a few layers of coloured
 * paper, sky to foreground, drawn from a seed so the same scene is the same picture on every machine. See
 * `docs/plans/character-dialogue.md`.
 */

import { coverage, ellipse, type Point, randomFrom, smooth } from './cutPaper.ts';
import type { RgbImage } from './png.ts';

/** The scenes there are placeholders for: the ones the server's sample dialogues name. */
export const SCENES = ['harbour'] as const;
export type SceneKey = (typeof SCENES)[number];

/**
 * Three wide by two tall, the shape an image model hands back, so a picture made with one needs no cropping:
 * the pane crops whatever it is given to its own shape, a tall slice of it in the column on a desktop.
 */
export const SCENE_WIDTH = 1536;
export const SCENE_HEIGHT = 1024;

type Rgb = readonly [number, number, number];

/** One sheet of paper: its shapes, cut in one colour. */
interface Layer {
  readonly shapes: readonly (readonly Point[])[];
  readonly colour: Rgb;
}

/** A band across the picture between two edges, each a list of points from left to right. */
function band(top: readonly Point[], bottom = 1.02): Point[] {
  return [...top, [1.02, bottom], [-0.02, bottom]];
}

/** A rectangle, by its left, top, right and bottom. */
function box(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ];
}

/**
 * The harbour: a far shore with a light on it, the sea, a ship at anchor with her sails furled, and the stone
 * of the quay in front, where whoever is talking stands. The horizon is just above the middle and the quay's
 * end and the ship either side of the middle, so a tall slice of it still has the quay and the water.
 */
function harbour(random: () => number): Layer[] {
  const vary = (spread: number): number => (random() * 2 - 1) * spread;

  const clouds: Point[][] = [
    ellipse(0.2 + vary(0.03), 0.17, 0.16, 0.022),
    ellipse(0.29 + vary(0.03), 0.205, 0.11, 0.016),
    ellipse(0.78 + vary(0.03), 0.13, 0.13, 0.018),
  ];
  const farShore = smooth(
    band(
      [
        [-0.02, 0.43],
        [0.08, 0.4],
        [0.17, 0.41 + vary(0.01)],
        [0.27, 0.445],
        [0.36, 0.475],
        [0.42, 0.5],
        [0.44, 0.52],
      ],
      0.53,
    ),
    6,
  );
  const farHills = smooth(
    band(
      [
        [0.5, 0.52],
        [0.6, 0.47 + vary(0.01)],
        [0.72, 0.455],
        [0.86, 0.47 + vary(0.01)],
        [1.02, 0.45],
      ],
      0.53,
    ),
    6,
  );
  const lighthouse = [box(0.115, 0.32, 0.135, 0.42), box(0.109, 0.305, 0.141, 0.325)];
  const waves = Array.from({ length: 9 }, (_, index) =>
    ellipse(0.48 + random() * 0.5, 0.6 + (index / 9) * 0.32 + vary(0.01), 0.04 + random() * 0.05, 0.004),
  );
  // The ship, moored off the end of the quay: a hull, two masts with their yards, and the sails furled on them.
  const hull: Point[] = [
    [0.56, 0.585],
    [0.84, 0.575],
    [0.815, 0.635],
    [0.59, 0.64],
  ];
  const bowsprit: Point[] = [
    [0.818, 0.579],
    [0.9, 0.548],
    [0.902, 0.554],
    [0.822, 0.586],
  ];
  const masts = [box(0.646, 0.22, 0.652, 0.59), box(0.746, 0.26, 0.752, 0.585), bowsprit];
  const yards = [0.3, 0.4, 0.5].flatMap((y, index) => [
    box(0.6, y + index * 0.004, 0.7, y + index * 0.004 + 0.006),
    box(0.705, y + 0.04, 0.795, y + 0.046),
  ]);
  const furled = [0.3, 0.4, 0.5].flatMap((y, index) => [
    ellipse(0.649, y + index * 0.004 + 0.012, 0.05, 0.01),
    ellipse(0.749, y + 0.052, 0.045, 0.009),
  ]);
  // The quay: a wall of dressed stone along the left, with steps down to the water at its far end, and
  // the bollards along its top.
  const quay: Point[] = [
    [-0.02, 0.62],
    [0.44, 0.62],
    [0.46, 0.66],
    [0.49, 0.66],
    [0.51, 0.71],
    [0.54, 0.71],
    [0.56, 0.77],
    [0.6, 0.77],
    [0.62, 1.02],
    [-0.02, 1.02],
  ];
  const quayTop = box(-0.02, 0.612, 0.44, 0.63);
  const bollards = [0.1, 0.25, 0.38].map((x) => smooth(box(x, 0.585, x + 0.022, 0.62), 4));
  // Each course of stone stops at the face of the wall it is laid in, a step further out the lower it is.
  const courses = (
    [
      [0.7, 0.5],
      [0.78, 0.598],
      [0.86, 0.605],
      [0.94, 0.612],
    ] as const
  ).map(([y, face]) => box(-0.02, y, face, y + 0.005));

  return [
    { shapes: clouds, colour: [224, 211, 184] },
    { shapes: [farShore], colour: [190, 181, 152] },
    { shapes: lighthouse, colour: [158, 146, 118] },
    { shapes: [farHills], colour: [205, 196, 168] },
    { shapes: waves, colour: [170, 178, 168] },
    { shapes: [hull, ...masts, ...yards], colour: [58, 50, 43] },
    { shapes: furled, colour: [218, 206, 180] },
    { shapes: [quay], colour: [78, 69, 59] },
    { shapes: [quayTop], colour: [110, 99, 85] },
    { shapes: courses, colour: [64, 57, 49] },
    { shapes: bollards, colour: [40, 35, 30] },
  ];
}

const LAYERS: Readonly<Record<SceneKey, (random: () => number) => Layer[]>> = { harbour };

/** The sky above the horizon, warm paper paling towards it, and the sea under it, darkening towards the shore. */
function ground(row: number, height: number, horizon: number): Rgb {
  const y = row / height;
  if (y < horizon) {
    const towards = y / horizon;
    return [228 + 15 * towards, 216 + 16 * towards, 190 + 18 * towards];
  }
  const deep = (y - horizon) / (1 - horizon);
  return [150 - 30 * deep, 160 - 28 * deep, 152 - 26 * deep];
}

/**
 * One placeholder scene, at any size: the sky and the sea, every layer of paper laid over them in order, and
 * the whole a little darker towards its edges, as the portraits' cards are.
 */
export function drawScene(key: SceneKey, width = SCENE_WIDTH, height = SCENE_HEIGHT): RgbImage {
  const random = randomFrom(key.split('').reduce((sum, letter) => sum * 31 + letter.charCodeAt(0), 7));
  const pixels = new Uint8Array(width * height * 3);
  for (let row = 0; row < height; row += 1) {
    const sky = ground(row, height, 0.53);
    for (let column = 0; column < width; column += 1) {
      pixels.set(sky, (row * width + column) * 3);
    }
  }

  for (const layer of LAYERS[key](random)) {
    const cut = coverage(layer.shapes, width, height);
    for (let at = 0; at < cut.length; at += 1) {
      const covered = cut[at]!;
      if (covered === 0) {
        continue;
      }
      for (let channel = 0; channel < 3; channel += 1) {
        const under = pixels[at * 3 + channel]!;
        pixels[at * 3 + channel] = Math.round(under + (layer.colour[channel]! - under) * covered);
      }
    }
  }

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const dx = column / width - 0.5;
      const dy = row / height - 0.5;
      const shade = 1 - 0.12 * Math.min(1, (dx * dx + dy * dy) * 2.4);
      const at = (row * width + column) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[at + channel] = Math.round(pixels[at + channel]! * shade);
      }
    }
  }
  return { width, height, pixels };
}
