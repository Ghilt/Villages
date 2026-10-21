/** A rectangle in the units of whatever it is measured in. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Where on a sheet one picture is, in the sheet's pixels. */
export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * How a scene `scene` units wide and high is drawn in a box: scaled to cover it, cropping what spills past the box
 * evenly on both sides, or to stand whole inside it. `left` and `top` are where its corner goes, in the box's pixels.
 */
export function fitOf(
  scene: Size,
  box: Size,
  fit: 'cover' | 'contain',
): { scale: number; left: number; top: number } {
  if (scene.width <= 0 || scene.height <= 0 || box.width <= 0 || box.height <= 0) {
    return { scale: 1, left: 0, top: 0 };
  }
  const across = box.width / scene.width;
  const down = box.height / scene.height;
  const scale = fit === 'cover' ? Math.max(across, down) : Math.min(across, down);
  return {
    scale,
    left: (box.width - scene.width * scale) / 2,
    top: (box.height - scene.height * scale) / 2,
  };
}

/**
 * Where a picture cut from a sheet stands, in scene units, when it is `height` tall with its foot at (x, y): its foot
 * is a share of its frame across and down, so the picture is laid round it rather than hung from its corner.
 */
export function standing(
  frame: Frame,
  foot: { readonly x: number; readonly y: number },
  at: { readonly x: number; readonly y: number },
  height: number,
): { left: number; top: number; width: number; height: number } {
  const width = frame.width * (height / frame.height);
  return { left: at.x - foot.x * width, top: at.y - foot.y * height, width, height };
}
