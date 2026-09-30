/**
 * The interface's pictures: what `npm run world:ui` reads out of `world/ui/`, what it writes for the page,
 * and the arithmetic between the two.
 *
 * Pure, as `art.ts` is for the sprites, so every rule is a test. The reading, resizing and writing are
 * `bin/cutUi.ts`'s. The page reads what is written through the types here, so the tool and the page
 * cannot disagree about what a cut picture is. See decision record 0068 and `AUTHORING-THE-ART.md`.
 */

/** The folders of `world/ui/`, one a kind of picture. */
export const UI_KINDS = ['borders', 'fills', 'embellishments', 'medallions', 'marks', 'controls'] as const;
export type UiKind = (typeof UI_KINDS)[number];

/**
 * How many of a picture's own pixels go to one pixel as it is shown. **Every** picture in `world/ui/` is
 * painted at four times the size it is drawn, so that a phone's screen at three has something to draw
 * from, and a picture's size as shown is its size as painted divided by this, rounded.
 */
export const PAINTED_AT = 4;

/** The densities every picture is cut at: an ordinary screen, a sharp one, and a phone's. */
export const CUT_AT = [1, 2, 3] as const;

/** A picture's name, which is its file name without the extension: lowercase words joined by hyphens. */
export const UI_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The file types a picture can be. */
export const UI_PICTURES = new Set(['.png', '.webp', '.jpg', '.jpeg']);

/** How the edges of a border are laid between its corners: CSS's own four words for it. */
export const REPEATS = ['stretch', 'repeat', 'round', 'space'] as const;
export type Repeat = (typeof REPEATS)[number];

/** Four lengths, one a side, in the order CSS says them: top, right, bottom, left. */
export type Sides = readonly [number, number, number, number];

/**
 * What the `<name>.json` beside a border says. **Every length is in the picture's own pixels**, the
 * ones a paint program shows, so a number is read off the picture rather than worked out.
 */
export interface BorderFile {
  /** Where the four cuts are, each measured in from its own edge: top, right, bottom, left. */
  readonly slice: Sides;
  /** How the edges between the corners are laid along the box: one for both, or across and then down. */
  readonly repeat?: Repeat | readonly [Repeat, Repeat];
  /** How much further in than the cuts the content starts. */
  readonly inset?: Sides;
  /** How far the border stands out past the box it frames. */
  readonly outset?: Sides;
  /** Whether the picture's own middle is drawn inside the border, rather than left for a fill. */
  readonly middle?: boolean;
  /** How far under the border a fill reaches, so no gap shows between an uneven inner edge and the fill. */
  readonly fillUnder?: Sides;
}

/** A border as the page lays it: every length now in CSS pixels, at the size the picture is shown. */
export interface UiBorder {
  readonly slice: Sides;
  readonly repeat: readonly [Repeat, Repeat];
  readonly inset: Sides;
  readonly outset: Sides;
  readonly middle: boolean;
  readonly fillUnder: Sides;
}

/** One of the files a picture was cut into. */
export interface UiCut {
  /** Screen pixels to a CSS pixel: 1, 2 or 3. */
  readonly density: number;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

/** One picture, cut. */
export interface UiPicture {
  readonly kind: UiKind;
  readonly name: string;
  /** The file in `world/ui/` it was cut from, relative to that folder: `borders/gilt-simple.webp`. */
  readonly source: string;
  /** Still the agent's stand-in rather than Adam's picture. */
  readonly placeholder: boolean;
  /** For a placeholder, what it is and where it came from. */
  readonly about?: string;
  /** Its size as shown, in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Its size as painted, in its own pixels. */
  readonly painted: { readonly width: number; readonly height: number };
  /** What was done to it: `its own alpha`, `keyed rgb(28,26,23)`, `opaque`. */
  readonly how: string;
  readonly cuts: readonly UiCut[];
  readonly border?: UiBorder;
}

/**
 * What `npm run world:ui` writes to `public/ui/ui.json`, and what the page reads first.
 *
 * `version` is a hash of everything else but the time, so a page told the pictures changed can tell a cut
 * that changed nothing from one that did.
 */
export interface UiArtFile {
  readonly version: string;
  readonly cutAt: string;
  readonly paintedAt: number;
  readonly pictures: readonly UiPicture[];
}

/** A length as painted, as shown: a quarter, rounded, and never nothing for something that is there. */
export function asShown(painted: number): number {
  return painted <= 0 ? 0 : Math.max(1, Math.round(painted / PAINTED_AT));
}

/**
 * What is wrong with a picture's file name, or null when nothing is. A name is what a recipe calls the
 * picture by, so it is held to the one shape the code can write without quoting.
 */
export function nameProblem(file: string): string | null {
  const dot = file.lastIndexOf('.');
  if (dot <= 0) {
    return `${file} has no extension`;
  }
  const extension = file.slice(dot).toLowerCase();
  if (!UI_PICTURES.has(extension)) {
    return `${file} is not a picture this tool reads: PNG, WebP or JPEG`;
  }
  const name = file.slice(0, dot);
  return UI_NAME.test(name) ? null : `${file}: a name is lowercase words joined by hyphens, like gilt-simple`;
}

function isLength(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function sidesOf(value: unknown, what: string, where: string): Sides | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isLength(value)) {
    return [value, value, value, value];
  }
  if (Array.isArray(value) && value.length === 4 && value.every(isLength)) {
    return [value[0], value[1], value[2], value[3]] as Sides;
  }
  throw new Error(
    `${where}: ${what} is one length or four - top, right, bottom, left - in the picture's own pixels`,
  );
}

function repeatOf(value: unknown, where: string): readonly [Repeat, Repeat] {
  const one = (given: unknown): Repeat => {
    if (typeof given === 'string' && (REPEATS as readonly string[]).includes(given)) {
      return given as Repeat;
    }
    throw new Error(`${where}: repeat is one of ${REPEATS.join(', ')}, or two of them, across and down`);
  };
  if (value === undefined) {
    return ['round', 'round'];
  }
  if (Array.isArray(value) && value.length === 2) {
    return [one(value[0]), one(value[1])];
  }
  return [one(value), one(value)];
}

/**
 * Reads a border's file, refusing anything it would have to guess at, with a message that says what to
 * write instead. `where` is the file's name, for the message.
 */
export function readBorderFile(text: string, where: string): BorderFile {
  let given: Record<string, unknown>;
  try {
    given = JSON.parse(text) as Record<string, unknown>;
  } catch (cause) {
    throw new Error(`${where} is not JSON: ${(cause as Error).message}`, { cause });
  }
  if (given === null || typeof given !== 'object' || Array.isArray(given)) {
    throw new Error(`${where} is an object, with a slice in it`);
  }
  const known = new Set(['slice', 'repeat', 'inset', 'outset', 'middle', 'fillUnder']);
  const stray = Object.keys(given).filter((key) => !known.has(key));
  if (stray.length > 0) {
    throw new Error(
      `${where}: ${stray.join(', ')} is not something a border says; it says ${[...known].join(', ')}`,
    );
  }
  const slice = sidesOf(given.slice, 'slice', where);
  if (slice === undefined) {
    throw new Error(`${where} says no slice: where the four cuts go, in from each edge`);
  }
  if (given.middle !== undefined && typeof given.middle !== 'boolean') {
    throw new Error(`${where}: middle is true or false`);
  }
  const repeat = repeatOf(given.repeat, where);
  const inset = sidesOf(given.inset, 'inset', where);
  const outset = sidesOf(given.outset, 'outset', where);
  const fillUnder = sidesOf(given.fillUnder, 'fillUnder', where);
  return {
    slice,
    repeat,
    ...(inset === undefined ? {} : { inset }),
    ...(outset === undefined ? {} : { outset }),
    ...(given.middle === undefined ? {} : { middle: given.middle as boolean }),
    ...(fillUnder === undefined ? {} : { fillUnder }),
  };
}

const quarter = (sides: Sides): Sides => [
  asShown(sides[0]),
  asShown(sides[1]),
  asShown(sides[2]),
  asShown(sides[3]),
];

/**
 * A border's file, laid at the size its picture is shown.
 *
 * The cuts are taken to the nearest whole pixel as shown, so that at 1x, 2x and 3x alike every cut falls
 * between two of the cut file's own pixels rather than through one, which is what keeps a corner crisp
 * where it meets its edge. Two cuts that would cross - a top and bottom that between them are taller
 * than the picture - are refused, because the browser would quietly draw no middle at all.
 */
export function borderAsShown(
  file: BorderFile,
  shown: { width: number; height: number },
  where: string,
): UiBorder {
  const slice = quarter(file.slice);
  if (slice[0] + slice[2] > shown.height || slice[1] + slice[3] > shown.width) {
    throw new Error(
      `${where}: its cuts cross - top and bottom, or left and right, add up to more than the picture - ` +
        `so there would be no edge between the corners`,
    );
  }
  const repeat = file.repeat === undefined ? (['round', 'round'] as const) : repeatOf(file.repeat, where);
  return {
    slice,
    repeat,
    inset: quarter(file.inset ?? [0, 0, 0, 0]),
    outset: quarter(file.outset ?? [0, 0, 0, 0]),
    middle: file.middle ?? false,
    fillUnder:
      file.fillUnder === undefined
        ? [
            Math.round(slice[0] / 2),
            Math.round(slice[1] / 2),
            Math.round(slice[2] / 2),
            Math.round(slice[3] / 2),
          ]
        : quarter(file.fillUnder),
  };
}

/**
 * How much of a mask a pixel is, for an outline drawn round something that stands on a busy ground.
 *
 * Every pixel's centre is measured against the outline: whole inside it, nothing outside, and across the
 * edge a ramp `feather` pixels wide, so a cut-out has a soft edge rather than a staircase. The points are
 * in the picture's own pixels, in order round the outline; it closes itself.
 */
export function outlineMask(
  width: number,
  height: number,
  outline: readonly (readonly [number, number])[],
  feather: number,
): Uint8Array {
  const alpha = new Uint8Array(width * height);
  const count = outline.length;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      let nearest = Infinity;
      for (let at = 0, before = count - 1; at < count; before = at, at += 1) {
        const [ax, ay] = outline[before]!;
        const [bx, by] = outline[at]!;
        if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) {
          inside = !inside;
        }
        const dx = bx - ax;
        const dy = by - ay;
        const along =
          dx === 0 && dy === 0
            ? 0
            : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
        nearest = Math.min(nearest, Math.hypot(px - (ax + along * dx), py - (ay + along * dy)));
      }
      const signed = inside ? nearest : -nearest;
      const share = feather <= 0 ? (inside ? 1 : 0) : Math.max(0, Math.min(1, 0.5 + signed / feather));
      alpha[y * width + x] = Math.round(share * 255);
    }
  }
  return alpha;
}

/**
 * How much the pictures weigh on the wire at a density: every picture's file at that density, added up.
 * What the page holds against the budget, which is said at 2x because that is most screens a player has.
 */
export function weightAt(pictures: readonly UiPicture[], density: number): number {
  return pictures.reduce(
    (sum, picture) => sum + (picture.cuts.find((cut) => cut.density === density)?.bytes ?? 0),
    0,
  );
}

/** The most the whole interface's pictures should weigh at 2x, in bytes, so the page stays quick to open. */
export const UI_BUDGET = 2 * 1024 * 1024;
