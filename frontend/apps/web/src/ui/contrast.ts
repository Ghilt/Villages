/**
 * Whether words can be read on what is behind them: the arithmetic of the Web Content Accessibility
 * Guidelines' contrast, which the page's contrast switch and the recipes' test both measure by.
 *
 * Words want **4.5 to 1** against what is behind them, and large words - 24 pixels, or 18.66 and bold -
 * want 3. Between black and white it is 21; between two colours that are the same, 1. See
 * docs/UI-COMPONENTS.md.
 */

/** A colour as red, green and blue from nought to 255, and how opaque it is, from nought to one. */
export type Rgba = readonly [number, number, number, number];

/** What ordinary words need. */
export const READABLE = 4.5;

/** What large words need: 24 pixels, or 18.66 and bold, which are 18 and 14 points. */
export const READABLE_LARGE = 3;

/**
 * A colour as CSS writes it - `#2b1d10`, `#abc`, `rgb(43, 29, 16)`, `rgb(43 29 16 / 0.5)`, `rgba(…)`, or
 * `color(srgb 0.17 0.11 0.06)`, which is how a browser hands back a `color-mix` - or null for one it
 * cannot read.
 */
export function colourOf(css: string): Rgba | null {
  const said = css.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(said);
  if (hex !== null) {
    const digits = hex[1]!.length === 3 ? [...hex[1]!].map((one) => one + one).join('') : hex[1]!;
    return [0, 2, 4].map((at) => parseInt(digits.slice(at, at + 2), 16)).concat(1) as unknown as Rgba;
  }
  const rgb = /^rgba?\(([^)]*)\)$/.exec(said);
  if (rgb !== null) {
    return partsOf(rgb[1]!, 1);
  }
  const srgb = /^color\(srgb\s+([^)]*)\)$/.exec(said);
  if (srgb !== null) {
    return partsOf(srgb[1]!, 255);
  }
  return null;
}

/** Three channels, each times `scale` unless it is a share, and perhaps an alpha, by commas, spaces or a slash. */
function partsOf(inside: string, scale: number): Rgba | null {
  const parts = inside.split(/[\s,/]+/).filter((one) => one !== '');
  if (parts.length < 3) {
    return null;
  }
  const share = (one: string) => Number(one.slice(0, -1)) / 100;
  const channel = (one: string) => (one.endsWith('%') ? share(one) * 255 : Number(one) * scale);
  const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? share(parts[3]) : Number(parts[3]);
  const colour: Rgba = [channel(parts[0]!), channel(parts[1]!), channel(parts[2]!), alpha];
  return colour.some((one) => Number.isNaN(one)) ? null : colour;
}

/** One channel of sRGB, from nought to 255, as the light it gives. */
function linear(channel: number): number {
  const share = channel / 255;
  return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
}

/** How bright a colour is to the eye, from nought for black to one for white: its relative luminance. */
export function luminanceOf([red, green, blue]: Rgba): number {
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** How far apart two colours are in brightness: 1 when they are the same, 21 for black on white. */
export function contrastOf(one: Rgba, other: Rgba): number {
  const [lighter, darker] = [luminanceOf(one), luminanceOf(other)].sort((a, b) => b - a) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/** One colour laid over another, as the browser lays a translucent one. */
export function over(top: Rgba, under: Rgba): Rgba {
  const alpha = top[3] + under[3] * (1 - top[3]);
  if (alpha === 0) {
    return [0, 0, 0, 0];
  }
  const mixed = (at: 0 | 1 | 2) => (top[at] * top[3] + under[at] * under[3] * (1 - top[3])) / alpha;
  return [mixed(0), mixed(1), mixed(2), alpha];
}

/** What contrast words of this size and weight need. */
export function contrastNeeded(pixels: number, weight: number): number {
  return pixels >= 24 || (weight >= 700 && pixels >= 18.66) ? READABLE_LARGE : READABLE;
}
