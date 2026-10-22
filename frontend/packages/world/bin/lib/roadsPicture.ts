import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import { chunk } from '../../src/png.ts';
import type { Chain, RoadGrade } from '../../src/roads/network.ts';
import { ownFile, writtenAt } from './outputs.ts';
import { GROUND_DIR } from './paths.ts';

/*
 * Every road of the world in one picture, for the Roads renderer to lay over the ground quietened: a square of the
 * world as the origin and culture maps are, nothing where there is no road, so it shows the whole network at any zoom.
 * The roads by their grade - a track dark brown, a road orange, a trunk red - each bridge near black, each settlement a
 * small dark dot and each ruined town a grey one, all drawn soft-edged at their width. `world:roads` writes it beside
 * the server's own files, as `world/ground/<master>/roads.png`: a picture of where every road is, which no player is
 * served, since a road reaches the page only through the fog; the dev server hands it to the renderer, an instrument.
 * See docs/plans/houses-bridges-and-road-render.md.
 */

/** How many pixels a side the picture is: eight world units a pixel on a world of 32,768, as the origin map is. */
export const ROADS_PICTURE_SIDE = 4096;

type Rgb = readonly [number, number, number];

/** Half of how wide each is drawn, in pixels, and its colour. */
const ROADS: Readonly<Record<RoadGrade, { half: number; colour: Rgb }>> = {
  track: { half: 0.5, colour: [110, 72, 36] },
  road: { half: 0.75, colour: [214, 110, 30] },
  trunk: { half: 1.1, colour: [196, 32, 36] },
};
const BRIDGE = { half: 1.1, colour: [24, 24, 28] as Rgb };
const SETTLEMENT = { half: 1.2, colour: [40, 36, 32] as Rgb };
const RUIN = { half: 1.8, colour: [125, 125, 125] as Rgb };

/**
 * Draws a soft-edged stroke from one point to another, in pixels, over what is there: each pixel covered by how far
 * its middle lies from the line within `half`, so the ends are round. Wraps round the world from left to right, as the
 * world does, and stops at the top and the bottom.
 */
export function stroke(
  pixels: Uint8Array,
  side: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  half: number,
  colour: Rgb,
): void {
  const reach = half + 1;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const long = dx * dx + dy * dy;
  for (
    let row = Math.floor(Math.min(from.y, to.y) - reach);
    row <= Math.max(from.y, to.y) + reach;
    row += 1
  ) {
    if (row < 0 || row >= side) continue;
    for (
      let column = Math.floor(Math.min(from.x, to.x) - reach);
      column <= Math.max(from.x, to.x) + reach;
      column += 1
    ) {
      const px = column + 0.5;
      const py = row + 0.5;
      const t = long === 0 ? 0 : Math.max(0, Math.min(1, ((px - from.x) * dx + (py - from.y) * dy) / long));
      const away = Math.hypot(px - (from.x + dx * t), py - (from.y + dy * t));
      const cover = Math.max(0, Math.min(1, half + 0.5 - away));
      if (cover === 0) continue;
      const at = (row * side + (((column % side) + side) % side)) * 4;
      const was = pixels[at + 3]! / 255;
      const alpha = cover + was * (1 - cover);
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[at + channel] = Math.round(
          (colour[channel]! * cover + pixels[at + channel]! * was * (1 - cover)) / alpha,
        );
      }
      pixels[at + 3] = Math.round(alpha * 255);
    }
  }
}

/**
 * A PNG of four bytes a pixel, the fourth how much of it there is: the shared encoder writes only three, and a change to
 * it would make every world step that cuts a picture again, so this one is the roads' own.
 */
export function encodeRgbaPng(side: number, pixels: Uint8Array): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, side);
  view.setUint32(4, side);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = side * 4;
  const raw = new Uint8Array((stride + 1) * side);
  for (let row = 0; row < side; row += 1)
    raw.set(pixels.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', new Uint8Array(0)),
  ];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.length;
  }
  return png;
}

/** The picture's pixels, four bytes each, of every road shaped, the settlements and the ruined towns. */
export function roadsPicture(
  chains: readonly Chain[],
  settlements: readonly { x: number; y: number }[],
  ruins: readonly { x: number; y: number }[],
  width: number,
  side = ROADS_PICTURE_SIDE,
): Uint8Array {
  const pixels = new Uint8Array(side * side * 4);
  const scale = side / width;
  const at = (point: { x: number; y: number }) => ({ x: point.x * scale, y: point.y * scale });
  // The lesser first, so a trunk runs over the tracks that meet it, and a bridge over its road.
  const order = (chain: Chain) =>
    chain.bridge !== null ? 3 : ['track', 'road', 'trunk'].indexOf(chain.grade);
  for (const chain of [...chains].sort((one, other) => order(one) - order(other))) {
    const { half, colour } = chain.bridge !== null ? BRIDGE : ROADS[chain.grade];
    for (let step = 1; step < chain.points.length; step += 1) {
      stroke(pixels, side, at(chain.points[step - 1]!), at(chain.points[step]!), half, colour);
    }
  }
  for (const ruin of ruins) stroke(pixels, side, at(ruin), at(ruin), RUIN.half, RUIN.colour);
  for (const one of settlements) stroke(pixels, side, at(one), at(one), SETTLEMENT.half, SETTLEMENT.colour);
  return pixels;
}

/** Writes a master's picture as `roads.png` beside its settlements, never through a borrowed copy, and says how many bytes. */
export async function writeRoadsPicture(
  master: string,
  chains: readonly Chain[],
  settlements: readonly { x: number; y: number }[],
  ruins: readonly { x: number; y: number }[],
  width: number,
): Promise<number> {
  const side = ROADS_PICTURE_SIDE;
  const folder = writtenAt(resolve(GROUND_DIR, master));
  const file = resolve(folder, 'roads.png');
  await mkdir(folder, { recursive: true });
  ownFile(file, 'the roads picture');
  const png = encodeRgbaPng(side, roadsPicture(chains, settlements, ruins, width));
  await writeFile(file, png);
  return png.length;
}
