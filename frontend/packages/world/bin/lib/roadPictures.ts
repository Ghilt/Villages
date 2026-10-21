import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import type { Palette } from '../../src/palette.ts';
import { toRgb } from '../../src/palette.ts';
import { encodeRgbPng } from '../../src/png.ts';
import type { Chain } from '../../src/roads/network.ts';
import type { RuinPiece } from '../../src/ruinLayout.ts';

import type { WorldTiles } from './classTiles.ts';
import { writtenAt } from './outputs.ts';
import { PAINTERLY_DIR } from './paths.ts';

/*
 * The roads over the ground around a few towns of 1790, to look at: the ground darkened in the colours it is drawn
 * in, every ruined town's pieces in grey, every settlement a pale square at its middle, the roads by their grade -
 * a track brown, a road pale, a trunk yellow - and every bridge red. `world:roads --picture` draws them into
 * `world/painterly/roads/`. See docs/plans/settlements-and-roads.md.
 */

export interface RoadPictures {
  readonly tiles: WorldTiles;
  readonly palette: Palette;
  readonly render: { colours: Record<string, string>; sea: string };
  readonly chains: readonly Chain[];
  readonly towns: readonly { id: string; name: string; x: number; y: number }[];
  readonly ruinPieces: ReadonlyMap<string, readonly RuinPiece[]>;
  readonly sites: readonly { x: number; y: number }[];
  readonly around: readonly string[];
  readonly unitsPerPixel: number;
  readonly say: (line: string) => void;
}

const WIDE = 900;
const HIGH = 600;
const COLOURS = {
  track: [240, 190, 120],
  road: [255, 246, 220],
  trunk: [255, 214, 90],
  bridge: [230, 60, 50],
  ruin: [190, 180, 175],
  site: [255, 250, 235],
} as const;

export async function drawRoadPictures(how: RoadPictures): Promise<void> {
  const { tiles, palette, render, chains, unitsPerPixel, say } = how;
  const colourOf = new Map(
    palette.classes.map((one) => [one.name, toRgb(render.colours[one.name] ?? render.sea)]),
  );
  const output = writtenAt(resolve(PAINTERLY_DIR, 'roads'));
  await mkdir(output, { recursive: true });
  for (const id of how.around) {
    const town = how.towns.find((one) => one.id === id);
    if (town === undefined) {
      say(`no town ${id} to draw the roads about`);
      continue;
    }
    const left = town.x - (WIDE / 2) * unitsPerPixel;
    const top = town.y - (HIGH / 2) * unitsPerPixel;
    await tiles.prepare(left, top, left + WIDE * unitsPerPixel, top + HIGH * unitsPerPixel);
    const pixels = new Uint8Array(WIDE * HIGH * 3);
    for (let py = 0; py < HIGH; py += 1) {
      for (let px = 0; px < WIDE; px += 1) {
        const terrain = tiles.classAt(left + (px + 0.5) * unitsPerPixel, top + (py + 0.5) * unitsPerPixel);
        const [red, green, blue] = colourOf.get(terrain) ?? [0, 0, 0];
        pixels.set([red * 0.6, green * 0.6, blue * 0.6], (py * WIDE + px) * 3);
      }
    }
    const dot = (x: number, y: number, colour: readonly number[]) => {
      const px = Math.round((x - left) / unitsPerPixel);
      const py = Math.round((y - top) / unitsPerPixel);
      if (px < 0 || py < 0 || px >= WIDE || py >= HIGH) return;
      pixels.set(colour, (py * WIDE + px) * 3);
    };
    // Two pixels wide, so a road reads at a glance over the ground.
    const line = (ax: number, ay: number, bx: number, by: number, colour: readonly number[]) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (unitsPerPixel / 2)));
      for (let step = 0; step <= steps; step += 1) {
        const x = ax + ((bx - ax) * step) / steps;
        const y = ay + ((by - ay) * step) / steps;
        dot(x, y, colour);
        dot(x + unitsPerPixel, y, colour);
      }
    };
    for (const pieces of how.ruinPieces.values()) {
      for (const piece of pieces) dot(piece.x, piece.y, COLOURS.ruin);
    }
    for (const site of how.sites) {
      for (let dy = -2; dy <= 2; dy += 1)
        for (let dx = -2; dx <= 2; dx += 1) dot(site.x + dx, site.y + dy, COLOURS.site);
    }
    let drawn = 0;
    for (const chain of chains) {
      const colour = chain.bridge === null ? COLOURS[chain.grade] : COLOURS.bridge;
      const inside = chain.points.some(
        (point) =>
          point.x >= left &&
          point.y >= top &&
          point.x < left + WIDE * unitsPerPixel &&
          point.y < top + HIGH * unitsPerPixel,
      );
      if (!inside) continue;
      drawn += 1;
      for (let at = 0; at + 1 < chain.points.length; at += 1) {
        const a = chain.points[at]!;
        const b = chain.points[at + 1]!;
        line(a.x, a.y, b.x, b.y, colour);
      }
    }
    const name = `${town.name.toLowerCase().replace(/[^a-z]+/g, '-')}.png`;
    await writeFile(
      resolve(output, name),
      encodeRgbPng({ width: WIDE, height: HIGH, pixels }, (raw) => deflateSync(raw, { level: 6 })),
    );
    say(`${town.name}: ${drawn} stretches of road drawn into ${resolve(output, name)}`);
  }
}
