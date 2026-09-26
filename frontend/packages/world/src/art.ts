/**
 * Turning a picture Adam hands over into a sprite the game can draw.
 *
 * Pure arithmetic on RGBA pixels, so that every rule here is a test and not a hope. Decoding, resizing
 * and encoding are sharp's, in `bin/cutArt.ts`; what is decided about the pixels is decided here.
 *
 * A picture arrives however its tool made it: any size, often on a flat background rather than a
 * transparent one, usually mostly empty, and with its soft edges half background. Three things turn it
 * into a sprite. The background is keyed out, the picture is trimmed to what is left, and its **foot** is
 * found - the point that stands on the ground, which is the anchor every thing on the map shares
 * (decision 0051). Then sprites are packed into one atlas, because the scenery is one particle layer and a
 * particle layer draws from one texture. See decision record 0059.
 */

export interface Rgba {
  width: number;
  height: number;
  /** Four bytes a pixel, straight (not premultiplied) alpha. */
  data: Uint8Array;
}

export interface Keyed {
  image: Rgba;
  /** The colour that was keyed out, or null where the picture brought its own transparency. */
  background: readonly [number, number, number] | null;
}

/** How many pixels must already be see-through before a picture counts as bringing its own alpha. */
const OWN_ALPHA_SHARE = 0.001;

/** How far a border pixel may stray from the rest before the border is not one colour. */
const BORDER_SPREAD = 24;

/** Within this of the background a pixel is background, whole. */
const KEY_NEAR = 14;

/** Beyond this it is picture, whole. Between the two it is an edge, part of each. */
const KEY_FAR = 48;

/** How far apart two colours are: the largest difference in any one channel. */
function distance(data: Uint8Array, at: number, colour: readonly [number, number, number]): number {
  return Math.max(
    Math.abs(data[at]! - colour[0]),
    Math.abs(data[at + 1]! - colour[1]),
    Math.abs(data[at + 2]! - colour[2]),
  );
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

/** Whether the picture already has see-through pixels of its own, in which case it is never keyed. */
export function hasOwnAlpha(image: Rgba): boolean {
  let clear = 0;
  for (let at = 3; at < image.data.length; at += 4) {
    if (image.data[at]! < 250) {
      clear += 1;
    }
  }
  return clear > image.width * image.height * OWN_ALPHA_SHARE;
}

/** The indices of the pixels two deep around the edge of the picture. */
function borderPixels(width: number, height: number): number[] {
  const ring: number[] = [];
  const deep = Math.min(2, Math.floor(Math.min(width, height) / 2));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x < deep || y < deep || x >= width - deep || y >= height - deep) {
        ring.push(y * width + x);
      }
    }
  }
  return ring;
}

/**
 * The background colour, read off the border, or an error if the border is not one colour.
 *
 * Refusing is the point. A picture whose edge is a landscape, or a gradient, or a tree cut off by the
 * frame has no background to key, and guessing one would eat a piece of the picture silently.
 */
export function backgroundOf(image: Rgba): [number, number, number] {
  const ring = borderPixels(image.width, image.height);
  const colour: [number, number, number] = [0, 1, 2].map((channel) =>
    median(ring.map((pixel) => image.data[pixel * 4 + channel]!)),
  ) as [number, number, number];
  const strays = ring.filter((pixel) => distance(image.data, pixel * 4, colour) > BORDER_SPREAD).length;
  if (strays > ring.length * 0.02) {
    throw new Error(
      `the border is not one colour (${strays} of ${ring.length} border pixels differ from ` +
        `rgb(${colour.join(', ')})), so there is no background to take away. ` +
        'Give it a flat background or a transparent one.',
    );
  }
  return colour;
}

/**
 * Takes a flat background away, and the background's colour out of the edges it leaves.
 *
 * **Filled from the edges, not keyed everywhere.** Only background that joins the border goes, so a pale
 * patch inside the picture - a birch's bark, a highlight - is kept even when it is the colour of the
 * paper. An edge pixel is part picture and part background: it keeps as much alpha as it is far from the
 * background, and the background is subtracted out of its colour, `C = (P - (1 - a)B) / a`. Without that
 * every tree carries a pale rim of the paper it was drawn on, which on dark forest ground is a halo.
 */
export function keyOut(image: Rgba): Keyed {
  if (hasOwnAlpha(image)) {
    return { image, background: null };
  }
  const background = backgroundOf(image);
  const { width, height } = image;
  const data = new Uint8Array(image.data);
  const reached = new Uint8Array(width * height);
  const stack: number[] = [];
  for (const pixel of borderPixels(width, height)) {
    if (distance(data, pixel * 4, background) < KEY_FAR) {
      reached[pixel] = 1;
      stack.push(pixel);
    }
  }
  while (stack.length > 0) {
    const pixel = stack.pop()!;
    const x = pixel % width;
    const y = (pixel - x) / width;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const next = ny * width + nx;
      if (reached[next] === 0 && distance(data, next * 4, background) < KEY_FAR) {
        reached[next] = 1;
        stack.push(next);
      }
    }
  }

  // The fringe: picture pixels touching the background. A lossy edge is a pixel or two of colours
  // halfway between the picture and the paper, far enough from the paper to survive the fill and pale
  // enough to read as a rim, so each one is measured against the solid picture just inside it.
  const fringe = new Uint8Array(width * height);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (reached[pixel] === 1) {
      continue;
    }
    const x = pixel % width;
    const y = (pixel - x) / width;
    for (let dy = -1; dy <= 1 && fringe[pixel] === 0; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && reached[ny * width + nx] === 1) {
          fringe[pixel] = 1;
          break;
        }
      }
    }
  }

  const source = image.data;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const at = pixel * 4;
    let alpha = 1;
    if (reached[pixel] === 1) {
      const far = distance(source, at, background);
      alpha = far <= KEY_NEAR ? 0 : (far - KEY_NEAR) / (KEY_FAR - KEY_NEAR);
    } else if (fringe[pixel] === 1) {
      alpha = fringeAlpha(source, reached, fringe, width, height, pixel, background);
    }
    if (alpha === 1) {
      continue;
    }
    if (alpha === 0) {
      data[at] = background[0];
      data[at + 1] = background[1];
      data[at + 2] = background[2];
      data[at + 3] = 0;
      continue;
    }
    for (let channel = 0; channel < 3; channel += 1) {
      const unmixed = (source[at + channel]! - (1 - alpha) * background[channel]!) / alpha;
      data[at + channel] = Math.max(0, Math.min(255, Math.round(unmixed)));
    }
    data[at + 3] = Math.round(alpha * source[at + 3]!);
  }
  return { image: { width, height, data }, background };
}

/** How far in from a fringe pixel the solid picture it is a mix of is looked for. */
const FRINGE_REACH = 2;

/**
 * How much of a fringe pixel is picture: where its colour falls on the line from the background to the
 * solid picture beside it. A pixel with no solid picture near it is left whole, because there is nothing
 * to say what it is a mix of.
 */
function fringeAlpha(
  data: Uint8Array,
  reached: Uint8Array,
  fringe: Uint8Array,
  width: number,
  height: number,
  pixel: number,
  background: readonly [number, number, number],
): number {
  const x = pixel % width;
  const y = (pixel - x) / width;
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let dy = -FRINGE_REACH; dy <= FRINGE_REACH; dy += 1) {
    for (let dx = -FRINGE_REACH; dx <= FRINGE_REACH; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const near = ny * width + nx;
      if (reached[near] === 0 && fringe[near] === 0) {
        red += data[near * 4]!;
        green += data[near * 4 + 1]!;
        blue += data[near * 4 + 2]!;
        count += 1;
      }
    }
  }
  if (count === 0) {
    return 1;
  }
  let along = 0;
  let length = 0;
  const inner = [red, green, blue];
  for (let channel = 0; channel < 3; channel += 1) {
    const toward = inner[channel]! / count - background[channel]!;
    along += (data[pixel * 4 + channel]! - background[channel]!) * toward;
    length += toward * toward;
  }
  return length === 0 ? 1 : Math.max(0, Math.min(1, along / length));
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Below this alpha a pixel is not part of the picture, for trimming and for finding the foot. */
const SOLID = 8;

/** The smallest box holding every pixel that shows, or null for a picture with nothing in it. */
export function opaqueBox(image: Rgba): Box | null {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3]! >= SOLID) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** A piece of a picture, copied out. */
export function crop(image: Rgba, box: Box): Rgba {
  const data = new Uint8Array(box.width * box.height * 4);
  for (let y = 0; y < box.height; y += 1) {
    const from = ((box.y + y) * image.width + box.x) * 4;
    data.set(image.data.subarray(from, from + box.width * 4), y * box.width * 4);
  }
  return { width: box.width, height: box.height, data };
}

/** How much of the bottom of a picture is read to find where it stands. */
const FOOT_BAND = 0.08;

/**
 * Where the picture stands on the ground, in its own pixels.
 *
 * The bottom edge, and across it the middle of whatever is in the lowest few rows, weighted by how
 * solid it is: for a tree that is its trunk and roots, however lopsided its crown. A crown that leans
 * right would put a middle-of-the-box anchor beside the trunk, and the tree would stand on air.
 */
export function footOf(image: Rgba): { x: number; y: number } {
  const box = opaqueBox(image);
  if (box === null) {
    return { x: image.width / 2, y: image.height };
  }
  const band = Math.max(1, Math.round(box.height * FOOT_BAND));
  let weight = 0;
  let sum = 0;
  for (let y = box.y + box.height - band; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3]!;
      if (alpha >= SOLID) {
        weight += alpha;
        sum += alpha * (x + 0.5);
      }
    }
  }
  return { x: sum / weight, y: box.y + box.height };
}

export interface Placed {
  x: number;
  y: number;
}

/**
 * Where each of these frames goes in one atlas: shelves, tallest first, no wider than `widest`.
 *
 * Nothing clever, because there are a couple of dozen and they are about the same height. `pad` is left
 * clear around every frame so that the mipmaps, which average neighbouring texels, never pull one
 * sprite's edge into its neighbour's.
 */
export function packShelves(
  sizes: readonly { width: number; height: number }[],
  pad: number,
  widest: number,
): { placed: Placed[]; width: number; height: number } {
  const order = sizes.map((_, index) => index).sort((a, b) => sizes[b]!.height - sizes[a]!.height);
  const placed: Placed[] = new Array<Placed>(sizes.length);
  let x = pad;
  let y = pad;
  let shelf = 0;
  let width = 0;
  for (const index of order) {
    const size = sizes[index]!;
    if (x + size.width + pad > widest && x > pad) {
      y += shelf + pad;
      x = pad;
      shelf = 0;
    }
    placed[index] = { x, y };
    x += size.width + pad;
    width = Math.max(width, x);
    shelf = Math.max(shelf, size.height);
  }
  return { placed, width, height: y + shelf + pad };
}

/** One sprite's place in the atlas, in the atlas's pixels, and where it stands. */
export interface ArtFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The foot, in the frame's own pixels from its top left: the anchor it is drawn from. */
  footX: number;
  footY: number;
  /** Still the placeholder that was drawn for it, rather than a picture Adam put there. */
  placeholder: boolean;
  /** The file in `world/sprites/<group>/` it was cut from. */
  source: string;
}

/**
 * What `npm run world:art` writes beside an atlas, and what the browser reads first.
 *
 * `version` is a hash of the atlas's own bytes, so asking for `<atlas>.webp?v=<version>` can never hand
 * back a picture from before the last cut.
 */
export interface ArtAtlasFile {
  version: string;
  cutAt: string;
  width: number;
  height: number;
  bytes: number;
  frames: Record<string, ArtFrame>;
}
