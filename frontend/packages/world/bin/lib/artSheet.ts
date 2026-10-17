import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import sharp from 'sharp';

import { PAINTERLY_DIR, RENDER } from './paths.ts';

/**
 * The art tool's contact sheet: every sprite it cut at the sizes it is drawn at, on the grounds it is drawn over,
 * into `world/painterly/art-sheet.png`. Apart from `cutArt.ts`, which cuts and packs, because it is only looked at.
 */

/** A cut sprite as the sheet needs it: its name, its pixels, its size, its foot, and whether it is a placeholder. */
export interface SheetCut {
  readonly name: string;
  readonly pixels: Buffer;
  readonly width: number;
  readonly height: number;
  readonly footX: number;
  readonly placeholder: boolean;
}

/** A colour from `world/render.json`, for the ground the contact sheet stands the sprites on. */
function groundColour(name: string, fallback: string): string {
  const render = JSON.parse(readFileSync(RENDER, 'utf8')) as { colours?: Record<string, string> };
  return render.colours?.[name] ?? fallback;
}

/**
 * Every sprite at the three sizes it is actually drawn at, on the ground it is drawn over.
 *
 * Shrunk by sharp rather than by a graphics card, which is close to what mipmaps do and not identical to
 * it. What it is for is the question a picture cannot answer at full size: whether the thing still reads
 * at twenty pixels, and whether it disappears into the forest it stands in.
 */
export async function contactSheet(cuts: readonly SheetCut[]): Promise<string> {
  const sizes = [20, 40, 80];
  const grounds = [
    ['broadleaf-forest', groundColour('broadleaf-forest', '#9dbc7e')],
    ['taiga', groundColour('taiga', '#6e9078')],
    ['meadow', groundColour('meadow', '#c4ce8d')],
  ] as const;
  const cellWidth = 96;
  const cellHeight = 100;
  const labelWidth = 210;
  const width = labelWidth + sizes.length * grounds.length * cellWidth;
  const height = 30 + cuts.length * cellHeight;
  const bands = grounds
    .map(([, colour], index) =>
      sizes
        .map(
          (_, at) =>
            `<rect x="${labelWidth + (index * sizes.length + at) * cellWidth}" y="0" width="${cellWidth}" ` +
            `height="${height}" fill="${colour}"/>`,
        )
        .join(''),
    )
    .join('');
  const headings = grounds
    .map(([ground], index) =>
      sizes
        .map(
          (size, at) =>
            `<text x="${labelWidth + (index * sizes.length + at) * cellWidth + 6}" y="18" font-size="12" ` +
            `font-family="sans-serif" fill="#222">${ground.slice(0, 8)} ${size}px</text>`,
        )
        .join(''),
    )
    .join('');
  const labels = cuts
    .map(
      (cut, row) =>
        `<text x="8" y="${30 + row * cellHeight + cellHeight / 2}" font-size="14" font-family="sans-serif" ` +
        `fill="${cut.placeholder ? '#666' : '#000'}">${cut.name}${cut.placeholder ? ' (placeholder)' : ''}</text>`,
    )
    .join('');
  const base = sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
        `<rect width="100%" height="100%" fill="#f4f1e8"/>${bands}${headings}${labels}</svg>`,
    ),
  );
  const layers: sharp.OverlayOptions[] = [];
  for (const [row, cut] of cuts.entries()) {
    for (let ground = 0; ground < grounds.length; ground += 1) {
      for (const [at, size] of sizes.entries()) {
        const tall = Math.min(size, cut.height);
        const wide = Math.max(1, Math.round((cut.width * tall) / cut.height));
        const small = await sharp(cut.pixels, { raw: { width: cut.width, height: cut.height, channels: 4 } })
          .resize(wide, tall, { kernel: 'lanczos3', fit: 'fill' })
          .png()
          .toBuffer();
        const column = ground * sizes.length + at;
        const footX = labelWidth + column * cellWidth + cellWidth / 2;
        const footY = 30 + row * cellHeight + cellHeight - 8;
        layers.push({
          input: small,
          left: Math.round(footX - (cut.footX / cut.width) * wide),
          top: Math.round(footY - tall),
        });
      }
    }
  }
  mkdirSync(PAINTERLY_DIR, { recursive: true });
  const out = resolve(PAINTERLY_DIR, 'art-sheet.png');
  await base.composite(layers).png().toFile(out);
  return out;
}
