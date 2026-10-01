import { colourOf, contrastNeeded, contrastOf, over } from '../../ui/contrast';
import type { Rgba } from '../../ui/contrast';

/**
 * The page's contrast check: every word on the sheet against what is painted behind it, and which of them
 * fall short of what they need.
 *
 * What is behind a word is found the way it was drawn. From the word up through the boxes it is in, and at
 * each box the layers laid under what holds the word - a fill, a border's own middle, a button's face, a
 * background colour, a gradient - until something opaque is reached. A picture counts as its average colour,
 * which is what a texture reads as at a reading distance. Words nobody can see are passed over: a section
 * folded shut, anything disabled, which asks nothing of contrast. Words scrolled out of sight are measured
 * where they would be seen, because what is behind a list scrolled along is still its pane.
 *
 * This is the page's instrument and not a rule of the library's: the recipes' own test holds the library to
 * the same arithmetic without a browser. See docs/UI-COMPONENTS.md.
 */

export interface Unreadable {
  /** The element the words are in, which the page marks. */
  readonly element: HTMLElement;
  /** The words, as far as the first few. */
  readonly words: string;
  readonly contrast: number;
  readonly needed: number;
}

/** Disabled, which asks nothing of contrast, or put out of reach. */
const PASSED_OVER = ':disabled, [aria-disabled="true"], [inert], .ui-card--disabled';

const WHITE: Rgba = [255, 255, 255, 1];
const NOTHING: Rgba = [0, 0, 0, 0];
const URL_IN = /url\("([^"]+)"\)/;
const COLOURS_IN = /rgba?\([^)]*\)|color\(srgb[^)]*\)/g;

type Middle = readonly [number, number, number, number];

/** Each picture's average colour, by its address and the part of it asked for: worked out once a picture. */
const averages = new Map<string, Promise<Rgba | null>>();

function averageOf(address: string, middle: Middle | null): Promise<Rgba | null> {
  const key = `${address}|${middle?.join(' ') ?? 'whole'}`;
  let known = averages.get(key);
  if (known === undefined) {
    known = measured(address, middle);
    averages.set(key, known);
  }
  return known;
}

/** Whether a picture has come, waiting for it if it has not: not `decode`, which waits on a frame. */
function arrived(picture: HTMLImageElement): Promise<boolean> {
  if (picture.complete) {
    return Promise.resolve(picture.naturalWidth > 0);
  }
  return new Promise((settle) => {
    picture.addEventListener('load', () => settle(true), { once: true });
    picture.addEventListener('error', () => settle(false), { once: true });
  });
}

/** A picture's average colour, weighed by how opaque each pixel is; `middle` cuts its edges off, in shares. */
async function measured(address: string, middle: Middle | null): Promise<Rgba | null> {
  const picture = new Image();
  picture.src = address;
  if (!(await arrived(picture))) {
    return null;
  }
  const { naturalWidth: width, naturalHeight: height } = picture;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const drawn = canvas.getContext('2d', { willReadFrequently: true });
  if (drawn === null || width === 0 || height === 0) {
    return null;
  }
  drawn.drawImage(picture, 0, 0);
  const [top, right, bottom, left] = middle ?? [0, 0, 0, 0];
  const x = Math.round((width * left) / 100);
  const y = Math.round((height * top) / 100);
  const across = Math.max(1, Math.round(width * (1 - right / 100)) - x);
  const down = Math.max(1, Math.round(height * (1 - bottom / 100)) - y);
  const pixels = drawn.getImageData(x, y, across, down).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let opaque = 0;
  for (let at = 0; at < pixels.length; at += 4) {
    const alpha = pixels[at + 3]! / 255;
    red += pixels[at]! * alpha;
    green += pixels[at + 1]! * alpha;
    blue += pixels[at + 2]! * alpha;
    opaque += alpha;
  }
  return opaque === 0 ? NOTHING : [red / opaque, green / opaque, blue / opaque, opaque / (pixels.length / 4)];
}

/** The average of several colours: a gradient's, from its stops. */
function meanOf(colours: readonly Rgba[]): Rgba {
  const mean = (at: 0 | 1 | 2 | 3) => colours.reduce((sum, colour) => sum + colour[at], 0) / colours.length;
  return [mean(0), mean(1), mean(2), mean(3)];
}

/** What one element paints, top first: its border's middle, its background picture, its background colour. */
async function paintOf(element: Element): Promise<Rgba[]> {
  const style = getComputedStyle(element);
  const layers: Rgba[] = [];
  const border = URL_IN.exec(style.borderImageSource)?.[1];
  if (border !== undefined && /\bfill\b/.test(style.borderImageSlice)) {
    const cuts = (style.borderImageSlice.match(/[\d.]+%/g) ?? []).map(parseFloat);
    if (cuts.length > 0) {
      const [top, right = top, bottom = top, left = right] = cuts as [number, ...number[]];
      const middle = await averageOf(border, [top, right, bottom, left]);
      if (middle !== null) {
        layers.push(middle);
      }
    }
  }
  if (style.backgroundImage !== 'none') {
    const picture = URL_IN.exec(style.backgroundImage)?.[1];
    if (picture !== undefined) {
      const whole = await averageOf(picture, null);
      if (whole !== null) {
        layers.push(whole);
      }
    } else {
      const stops = (style.backgroundImage.match(COLOURS_IN) ?? []).map(colourOf);
      const known = stops.filter((stop): stop is Rgba => stop !== null);
      if (known.length > 0) {
        layers.push(meanOf(known));
      }
    }
  }
  const colour = colourOf(style.backgroundColor);
  if (colour !== null && colour[3] > 0) {
    layers.push(colour);
  }
  return layers;
}

const zIndexOf = (element: Element): number => {
  const z = getComputedStyle(element).zIndex;
  return z === 'auto' ? 0 : Number(z);
};

/** A box laid over its parent rather than in its flow, that paints something: a fill, a border, a face. */
function isLayer(element: Element): boolean {
  const style = getComputedStyle(element);
  if (style.position !== 'absolute' && style.position !== 'fixed') {
    return false;
  }
  return (
    style.backgroundImage !== 'none' ||
    URL_IN.test(style.borderImageSource) ||
    (colourOf(style.backgroundColor)?.[3] ?? 0) > 0
  );
}

interface Point {
  readonly x: number;
  readonly y: number;
}

const holds = (element: Element, { x, y }: Point): boolean => {
  const box = element.getBoundingClientRect();
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
};

/** Where the words are looked at: the middle of their first line. */
function pointOf(words: Text): Point | null {
  const range = document.createRange();
  range.selectNodeContents(words);
  const line = [...range.getClientRects()].find((rect) => rect.width > 1 && rect.height > 1);
  return line === undefined ? null : { x: line.left + line.width / 2, y: line.top + line.height / 2 };
}

/** Whether a box clips what is in it, as a scroll area does. */
const clips = (box: Element): boolean => {
  const style = getComputedStyle(box);
  return style.overflowX !== 'visible' || style.overflowY !== 'visible';
};

/** The nearest point to `point` inside `box`. */
function inside(point: Point, box: Element): Point {
  const edge = box.getBoundingClientRect();
  const nearest = (at: number, from: number, to: number) =>
    Math.min(Math.max(at, from + 1), Math.max(from + 1, to - 1));
  return { x: nearest(point.x, edge.left, edge.right), y: nearest(point.y, edge.top, edge.bottom) };
}

/**
 * What is painted behind the words at that point, everything under them laid together. Inside a box that
 * scrolls, words scrolled out of sight are where they are, among the rest of what scrolls with them; past
 * it, they are where they would be seen, because what is behind a scrolled list is still its pane.
 */
async function behindOf(words: Text, point: Point): Promise<Rgba> {
  const layers: Rgba[] = [];
  let branch: Node = words;
  let at = point;
  for (let box = words.parentElement; box !== null; box = box.parentElement) {
    const above =
      branch instanceof Element && getComputedStyle(branch).position !== 'static' ? zIndexOf(branch) : 0;
    const under = [...box.children].filter(
      (child) =>
        child !== branch &&
        !child.contains(branch) &&
        isLayer(child) &&
        holds(child, at) &&
        zIndexOf(child) <= above,
    );
    // Top first: the higher of two, and of two as high the later.
    under.sort(
      (one, other) =>
        zIndexOf(other) - zIndexOf(one) ||
        (one.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1),
    );
    for (const layer of under) {
      layers.push(...(await paintOf(layer)));
    }
    layers.push(...(await paintOf(box)));
    if (1 - layers.reduce((clear, layer) => clear * (1 - layer[3]), 1) > 0.99) {
      break;
    }
    if (clips(box)) {
      at = inside(at, box);
    }
    branch = box;
  }
  return layers.reduceRight((under, top) => over(top, under), WHITE);
}

/** How opaque an element is drawn, all the boxes it is in taken together. */
function shownOf(element: Element): number {
  let shown = 1;
  for (let box: Element | null = element; box !== null; box = box.parentElement) {
    shown *= Number(getComputedStyle(box).opacity);
  }
  return shown;
}

/** Every word under `root` that cannot be read against what is behind it, in the order they are on the page. */
export async function findUnreadable(root: Element): Promise<Unreadable[]> {
  const found: Unreadable[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const words = node as Text;
    const element = words.parentElement;
    if (
      !(element instanceof HTMLElement) ||
      words.data.trim() === '' ||
      element.closest(PASSED_OVER) !== null
    ) {
      continue;
    }
    const style = getComputedStyle(element);
    const shown = shownOf(element);
    if (style.visibility !== 'visible' || shown < 0.1) {
      continue;
    }
    const point = pointOf(words);
    const ink = colourOf(style.color);
    if (point === null || ink === null) {
      continue;
    }
    const behind = await behindOf(words, point);
    const contrast = contrastOf(over([ink[0], ink[1], ink[2], ink[3] * shown], behind), behind);
    const needed = contrastNeeded(parseFloat(style.fontSize), Number(style.fontWeight));
    if (contrast < needed) {
      found.push({ element, words: words.data.trim().slice(0, 40), contrast, needed });
    }
  }
  return found;
}

/** The attribute a word too faint to read is marked with, saying by how much. */
export const MARK = 'data-ui-unreadable';

/** Marks exactly these, and takes the mark off whatever had it. */
export function markUnreadable(root: Element, found: readonly Unreadable[]): void {
  for (const marked of root.querySelectorAll(`[${MARK}]`)) {
    marked.removeAttribute(MARK);
  }
  for (const one of found) {
    one.element.setAttribute(MARK, `${one.contrast.toFixed(1)} to 1, needs ${one.needed}`);
  }
}
