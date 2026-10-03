import { note } from '../log/log';
import { FLAT_MAX_ZOOM } from '../geometry/world';

import { SIDE } from './waterMask';

/**
 * WIP SPIKE: the rivers' flow, as `npm run world:flow` wrote it beside a master's tiles: which zoom 7 tiles have
 * any, how far down a river the along tiles take to come round again, and each tile's pixels. A master never run
 * through it has none, and its rivers stand still, which the log says once.
 */
export interface FlowFiles {
  /** Which tiles have their rivers' flow worked out, as `x/y` at zoom 7; empty for a master with none. */
  tiles: Promise<ReadonlySet<string>>;
  /** The same once it has arrived, and null before. */
  known(): ReadonlySet<string> | null;
  /** How many world units down a river the along tiles take to come round again. */
  alongPeriod(): number;
  /** One tile as RGBA: its flow, or with `-along` how far down the river; null if it will not come. */
  pixels(x: number, y: number, which?: '' | '-along'): Promise<Uint8Array | null>;
}

export function flowFilesOf(worldRoot: string): FlowFiles {
  let known: ReadonlySet<string> | null = null;
  let alongPeriod = 64;
  const tiles = fetch(`${worldRoot}/flow/flow.json`)
    .then(async (response) =>
      response.ok ? ((await response.json()) as { tiles: string[]; alongPeriod?: number }) : null,
    )
    .catch(() => null)
    .then((file) => {
      note(
        'water',
        file === null
          ? 'no river flow worked out for this master, so its rivers stand still: npm run world:flow --prefix frontend'
          : `rivers run downstream: their flow is worked out over ${file.tiles.length} tiles`,
      );
      known = new Set(file?.tiles ?? []);
      alongPeriod = file?.alongPeriod ?? 64;
      return known;
    });

  const pixels = async (x: number, y: number, which = ''): Promise<Uint8Array | null> => {
    try {
      const response = await fetch(`${worldRoot}/flow/${FLAT_MAX_ZOOM}/${x}/${y}${which}.png`);
      if (!response.ok) {
        return null;
      }
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = new OffscreenCanvas(SIDE, SIDE);
      const drawing = canvas.getContext('2d', { willReadFrequently: true });
      if (drawing === null) {
        return null;
      }
      drawing.drawImage(bitmap, 0, 0);
      bitmap.close();
      return new Uint8Array(drawing.getImageData(0, 0, SIDE, SIDE).data.buffer);
    } catch {
      return null;
    }
  };

  return { tiles, known: () => known, alongPeriod: () => alongPeriod, pixels };
}
