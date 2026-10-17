import { Texture } from 'pixi.js';

import { SHADE_COLOUR } from '../../map/light';

/**
 * What of the critters is drawn in code rather than from a picture, once each: the soft shadow every critter casts,
 * and the ring a fish leaves on the water. Each is a small canvas the layer stretches to size.
 */

/** A soft dark oval, the shadow every critter casts, in the shade the one light casts. */
export function shadowTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 16;
  const paint = canvas.getContext('2d')!;
  const [r, g, b] = SHADE_COLOUR.map((one) => Math.round(one * 255));
  const fall = paint.createRadialGradient(16, 8, 0, 16, 8, 8);
  fall.addColorStop(0, `rgba(${r},${g},${b},1)`);
  fall.addColorStop(1, `rgba(${r},${g},${b},0)`);
  paint.setTransform(2, 0, 0, 1, 0, 0);
  paint.fillStyle = fall;
  paint.fillRect(0, 0, 16, 16);
  return Texture.from(canvas);
}

/**
 * A ring of light on the water with a faint dark trough inside it, so it reads on pale water and dark alike, soft at
 * its edges: a circle the layer flattens as the ground is tipped.
 */
export function ringTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const paint = canvas.getContext('2d')!;
  const light = paint.createRadialGradient(32, 32, 18, 32, 32, 31);
  light.addColorStop(0, 'rgba(30,60,80,0)');
  light.addColorStop(0.35, 'rgba(30,60,80,0.35)');
  light.addColorStop(0.62, 'rgba(236,244,246,1)');
  light.addColorStop(1, 'rgba(236,244,246,0)');
  paint.fillStyle = light;
  paint.fillRect(0, 0, 64, 64);
  return Texture.from(canvas);
}
