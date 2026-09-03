/**
 * The terrain classes of the world, and the colour each wears in the master image.
 *
 * The colours are data rather than a look: they exist so that a human can tell classes apart while
 * painting, and so that any pixel can be snapped back to exactly one class on the way in. What a forest
 * actually looks like is the renderer's business.
 */

export interface TerrainClass {
  id: number;
  name: string;
  /** As `#rrggbb`, which is what an image editor shows and what the master holds. */
  colour: string;
  water?: boolean;
}

export interface MasterShape {
  width: number;
  height: number;
  projection: 'equirectangular';
}

export interface Palette {
  master: MasterShape;
  classes: TerrainClass[];
}

export type Rgb = readonly [number, number, number];

export function toRgb(colour: string): Rgb {
  const hex = colour.startsWith('#') ? colour.slice(1) : colour;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`${colour} is not a six-digit colour`);
  }
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

export function toHex([r, g, b]: Rgb): string {
  const pair = (value: number) => value.toString(16).padStart(2, '0');
  return `#${pair(r)}${pair(g)}${pair(b)}`;
}

/** Straight-line distance in colour space. Crude, and enough to keep classes apart. */
export function colourDistance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * How close two classes are allowed to be.
 *
 * The rule exists so that snapping a blended pixel cannot land on the wrong terrain. It was 48 while there
 * were thirteen classes; thirty-two of them do fit at 48, but only by shoving colours a long way from what
 * they should look like, which makes the image harder to paint and read.
 *
 * At 40 the worst case is a pixel exactly midway between two classes, twenty from each: still resolved the
 * same way every time, merely the least confident case there is. What actually keeps blends out is the
 * authoring discipline in docs/AUTHORING-THE-WORLD.md, which mandates the Pencil, no anti-aliasing, zero
 * bucket tolerance and nearest-neighbour interpolation. The importer reports any colour it had to reach
 * far for, and that alarm was tightened when this was loosened.
 */
export const MINIMUM_CLASS_DISTANCE = 40;

export interface PaletteProblem {
  kind: 'duplicate-id' | 'duplicate-name' | 'too-close' | 'bad-colour';
  detail: string;
}

/** Everything that would make a palette unusable, reported together rather than one throw at a time. */
export function paletteProblems(palette: Palette): PaletteProblem[] {
  const problems: PaletteProblem[] = [];
  const ids = new Set<number>();
  const names = new Set<string>();

  // Colours that parse, kept aside: a class whose colour is nonsense is reported once and then left out
  // of the distance comparison, so that one bad entry does not hide every other problem.
  const readable: { name: string; rgb: Rgb }[] = [];

  for (const terrain of palette.classes) {
    if (ids.has(terrain.id)) {
      problems.push({ kind: 'duplicate-id', detail: `${terrain.id} is used twice` });
    }
    if (names.has(terrain.name)) {
      problems.push({ kind: 'duplicate-name', detail: `${terrain.name} is used twice` });
    }
    ids.add(terrain.id);
    names.add(terrain.name);

    try {
      readable.push({ name: terrain.name, rgb: toRgb(terrain.colour) });
    } catch {
      problems.push({ kind: 'bad-colour', detail: `${terrain.name} has colour ${terrain.colour}` });
    }
  }

  for (let i = 0; i < readable.length; i += 1) {
    for (let j = i + 1; j < readable.length; j += 1) {
      const a = readable[i]!;
      const b = readable[j]!;
      const distance = colourDistance(a.rgb, b.rgb);
      if (distance < MINIMUM_CLASS_DISTANCE) {
        problems.push({
          kind: 'too-close',
          detail: `${a.name} and ${b.name} are ${distance.toFixed(1)} apart`,
        });
      }
    }
  }

  return problems;
}

export interface Snap {
  id: number;
  /** How far the pixel was from the class it was assigned. Zero for a colour painted exactly. */
  distance: number;
}

/**
 * A palette with its colours already parsed, for asking the same question a hundred million times.
 *
 * Reading a colour out of its hexadecimal text is cheap once and ruinous in a loop over every pixel of a
 * world, so a caller that is snapping an image prepares the palette first.
 */
export interface PreparedPalette {
  ids: Int32Array;
  /** Three bytes a class, in the same order as the ids. */
  channels: Uint8Array;
}

export function preparePalette(palette: Palette): PreparedPalette {
  const ids = new Int32Array(palette.classes.length);
  const channels = new Uint8Array(palette.classes.length * 3);

  palette.classes.forEach((terrain, index) => {
    ids[index] = terrain.id;
    channels.set(toRgb(terrain.colour), index * 3);
  });

  return { ids, channels };
}

/**
 * The class a pixel belongs to. Every colour resolves to something, because an image editor leaves blended
 * pixels along every edge and refusing them would mean refusing every edit. How far it had to reach is
 * reported so that the importer can complain about a colour nobody meant to paint.
 */
export function snapPrepared([red, green, blue]: Rgb, prepared: PreparedPalette): Snap {
  let bestId = prepared.ids[0] ?? 0;
  let bestSquared = Infinity;

  for (let index = 0; index < prepared.ids.length; index += 1) {
    const at = index * 3;
    const dr = red - prepared.channels[at]!;
    const dg = green - prepared.channels[at + 1]!;
    const db = blue - prepared.channels[at + 2]!;
    const squared = dr * dr + dg * dg + db * db;
    if (squared < bestSquared) {
      bestSquared = squared;
      bestId = prepared.ids[index]!;
    }
  }

  return { id: bestId, distance: Math.sqrt(bestSquared) };
}

/** The same question, for a caller asking it once. Prepare the palette instead if you are in a loop. */
export function snapToClass(colour: Rgb, palette: Palette): Snap {
  return snapPrepared(colour, preparePalette(palette));
}

/** A lookup from class id to its definition, for the many places that need one. */
export function byId(palette: Palette): Map<number, TerrainClass> {
  return new Map(palette.classes.map((terrain) => [terrain.id, terrain]));
}
