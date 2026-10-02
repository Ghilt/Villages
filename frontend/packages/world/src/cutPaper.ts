/**
 * Cut paper: the shapes the placeholder portraits and scenes are drawn in, and the one way they are filled.
 *
 * A placeholder is a few flat shapes cut from coloured paper and laid one over another, which is a look the
 * period had - the silhouette - and a look nobody mistakes for the finished art. Everything is in the unit
 * square of the picture and drawn from a seed, so the same placeholder is the same picture on every machine.
 */

/** A point in the unit square of a picture, x across and y down. */
export type Point = readonly [number, number];

/** A small seeded random: the same seed gives the same sitter, and nothing here reaches for a clock. */
export function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth closed curve through the points, as a polygon: Catmull-Rom, a few steps a span. */
export function smooth(points: readonly Point[], steps = 8): Point[] {
  const out: Point[] = [];
  const count = points.length;
  for (let index = 0; index < count; index += 1) {
    const p0 = points[(index - 1 + count) % count]!;
    const p1 = points[index]!;
    const p2 = points[(index + 1) % count]!;
    const p3 = points[(index + 2) % count]!;
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const along = (a: number, b: number, c: number, d: number): number =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([along(p0[0], p1[0], p2[0], p3[0]), along(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, steps = 48): Point[] {
  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] as const;
  });
}

/**
 * Every shape filled into a coverage mask, supersampled so the edges are soft: the even-odd rule within a
 * shape, and the shapes laid over one another.
 */
export function coverage(
  shapes: readonly (readonly Point[])[],
  width: number,
  height: number,
  fineness = 3,
): Float32Array {
  const fineWidth = width * fineness;
  const fineHeight = height * fineness;
  const fine = new Uint8Array(fineWidth * fineHeight);
  const crossings: number[] = [];
  for (const shape of shapes) {
    const scaled = shape.map(([x, y]) => [x * fineWidth, y * fineHeight] as const);
    for (let row = 0; row < fineHeight; row += 1) {
      const y = row + 0.5;
      crossings.length = 0;
      for (let index = 0; index < scaled.length; index += 1) {
        const [ax, ay] = scaled[index]!;
        const [bx, by] = scaled[(index + 1) % scaled.length]!;
        if (ay <= y !== by <= y) {
          crossings.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
        const from = Math.max(0, Math.ceil(crossings[pair]! - 0.5));
        const to = Math.min(fineWidth - 1, Math.floor(crossings[pair + 1]! - 0.5));
        fine.fill(1, row * fineWidth + from, row * fineWidth + to + 1);
      }
    }
  }

  const out = new Float32Array(width * height);
  const samples = fineness * fineness;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      let covered = 0;
      for (let dy = 0; dy < fineness; dy += 1) {
        const at = (row * fineness + dy) * fineWidth + column * fineness;
        for (let dx = 0; dx < fineness; dx += 1) {
          covered += fine[at + dx]!;
        }
      }
      out[row * width + column] = covered / samples;
    }
  }
  return out;
}
