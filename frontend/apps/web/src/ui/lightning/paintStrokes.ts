import type { Moment } from './strike';

/** A colour as red, green and blue from 0 to 255. */
export type Rgb = readonly [number, number, number];

const rgba = ([r, g, b]: Rgb, alpha: number) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;

/** A colour gone most of the way to white, as the core of a bolt is. */
export const hot = ([r, g, b]: Rgb): Rgb => [r + (255 - r) * 0.8, g + (255 - g) * 0.8, b + (255 - b) * 0.8];

/**
 * A moment of lightning drawn as strokes on a canvas, each light three times over and added to what is under it: a
 * wide blurred glow in its colour, a halo, and a hot white core; and each flash a pool of its colour. `scale` is the
 * canvas's pixels to a CSS pixel.
 */
export function paintStrokes(
  context: CanvasRenderingContext2D,
  moments: readonly Moment[],
  colourOf: (colour: string) => Rgb,
  scale: number,
): void {
  const { canvas } = context;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.globalCompositeOperation = 'lighter';
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const moment of moments) {
    for (const flash of moment.flashes) {
      if (flash.bright <= 0) continue;
      const pool = context.createRadialGradient(
        flash.at.x,
        flash.at.y,
        0,
        flash.at.x,
        flash.at.y,
        flash.reach,
      );
      pool.addColorStop(0, rgba(colourOf(flash.colour), 0.55 * flash.bright));
      pool.addColorStop(1, rgba(colourOf(flash.colour), 0));
      context.fillStyle = pool;
      context.fillRect(flash.at.x - flash.reach, flash.at.y - flash.reach, 2 * flash.reach, 2 * flash.reach);
    }
  }
  const passes = [
    { blur: 6, wide: 5, alpha: 0.5, core: false },
    { blur: 0, wide: 2.2, alpha: 0.8, core: false },
    { blur: 0, wide: 1, alpha: 1, core: true },
  ];
  for (const pass of passes) {
    context.filter = pass.blur > 0 ? `blur(${pass.blur}px)` : 'none';
    for (const moment of moments) {
      for (const light of moment.lights) {
        if (light.bright <= 0 || light.points.length < 2) continue;
        const colour = colourOf(light.colour);
        context.strokeStyle = rgba(pass.core ? hot(colour) : colour, pass.alpha * light.bright);
        context.lineWidth = light.width * pass.wide;
        context.beginPath();
        light.points.forEach((point, at) =>
          at === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y),
        );
        context.stroke();
      }
    }
  }
  context.filter = 'none';
  context.globalCompositeOperation = 'source-over';
}
