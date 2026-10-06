import type { ClassRaster } from './raster.ts';

/**
 * How well a placement lays a square of an edited master on plain Earth, two ways.
 *
 * **`exact` is for searching.** Cohen's kappa over the square's pixels: the share that agree with Earth's
 * pixel under them, beyond what chance would give for two squares with these mixes of classes, so that a
 * square of taiga laid on more taiga is not called a match merely because taiga is common. It is quick, and
 * it rises as a placement comes right, which is all a search needs of it.
 *
 * **`judge` is for deciding.** Exact agreement is fragile where a square is nearly one class: a turn that is
 * half a pixel out misses every river a pixel wide, and a river Adam's mending made two pixels wide never
 * agrees at all, so a square of rainforest that is plainly the right one scores half. Judging lets each pixel
 * find its class within a pixel either way, and measures chance the honest way: by how well the same
 * placement scores ten pixels off, which is what this ground looks like laid on the wrong bit of itself.
 *
 * Sea counts as one class and as a pixel to agree on, so a coast's shape is part of the fingerprint.
 */
export class Scorer {
  /** Each class as it is compared: the seas as one, `SEA_AS`. */
  readonly same = new Uint8Array(256);
  /** The raw share of pixels that agreed in the last `exact` or `tolerant`. */
  agree = 0;
  private readonly ours = new Int32Array(258);
  private readonly theirs = new Int32Array(258);
  private readonly edited: ClassRaster;
  private readonly base: ClassRaster;
  private readonly cell: number;
  private readonly columns: number;

  constructor(edited: ClassRaster, base: ClassRaster, cell: number, sea: ReadonlySet<number>) {
    this.edited = edited;
    this.base = base;
    this.cell = cell;
    this.columns = Math.ceil(edited.width / cell);
    for (let id = 0; id < 256; id += 1) this.same[id] = sea.has(id) ? SEA_AS : id;
  }

  /** Whether a point of the edited master is land. */
  isLand(x: number, y: number): boolean {
    const { width, height, cells } = this.edited;
    if (y < 0 || y >= height) return false;
    const column = ((Math.floor(x) % width) + width) % width;
    return this.same[cells[Math.floor(y) * width + column]!] !== SEA_AS;
  }

  exact(k: number, x: number, y: number, a: number, b: number, c: number, d: number, step: number): number {
    const { width, height, cells } = this.edited;
    const { width: bw, height: bh, cells: earth } = this.base;
    const left = (k % this.columns) * this.cell;
    const top = Math.floor(k / this.columns) * this.cell;
    const half = this.cell / 2;
    this.ours.fill(0);
    this.theirs.fill(0);
    let agree = 0;
    let n = 0;
    for (let row = top; row < Math.min(height, top + this.cell); row += step) {
      const dy = row + 0.5 - top - half;
      const rowX = x + b * dy;
      const rowY = y + d * dy;
      for (let column = left; column < Math.min(width, left + this.cell); column += step) {
        const dx = column + 0.5 - left - half;
        const ours = this.same[cells[row * width + column]!]!;
        const v = Math.floor(rowY + c * dx);
        let u = Math.floor(rowX + a * dx);
        if (u < 0) u += bw;
        else if (u >= bw) u -= bw;
        const theirs = v < 0 || v >= bh || u < 0 || u >= bw ? OFF_EARTH : this.same[earth[v * bw + u]!]!;
        this.ours[ours]! += 1;
        this.theirs[theirs]! += 1;
        if (ours === theirs) agree += 1;
        n += 1;
      }
    }
    let chance = 0;
    for (let id = 0; id < this.ours.length; id += 1) chance += this.ours[id]! * this.theirs[id]!;
    chance /= n * n;
    this.agree = agree / n;
    return chance >= 0.999 ? 0 : (agree / n - chance) / (1 - chance);
  }

  judge(k: number, x: number, y: number, a: number, b: number, c: number, d: number, step: number): number {
    const here = this.tolerant(k, x, y, a, b, c, d, step);
    const off =
      (this.tolerant(k, x + 9, y + 4, a, b, c, d, step) + this.tolerant(k, x - 5, y - 9, a, b, c, d, step)) /
      2;
    this.agree = here;
    return off >= 0.999 ? 0 : Math.max(0, (here - off) / (1 - off));
  }

  /** The share of a square's pixels whose class is on Earth within a pixel of where the placement puts them. */
  tolerant(
    k: number,
    x: number,
    y: number,
    a: number,
    b: number,
    c: number,
    d: number,
    step: number,
  ): number {
    const { width, height, cells } = this.edited;
    const { width: bw, height: bh, cells: earth } = this.base;
    const left = (k % this.columns) * this.cell;
    const top = Math.floor(k / this.columns) * this.cell;
    const half = this.cell / 2;
    let agree = 0;
    let n = 0;
    for (let row = top; row < Math.min(height, top + this.cell); row += step) {
      const dy = row + 0.5 - top - half;
      for (let column = left; column < Math.min(width, left + this.cell); column += step) {
        const dx = column + 0.5 - left - half;
        const ours = this.same[cells[row * width + column]!]!;
        const u = Math.floor(x + a * dx + b * dy);
        const v = Math.floor(y + c * dx + d * dy);
        n += 1;
        search: for (let i = 0; i < 3; i += 1) {
          const vv = v + NEAREST_FIRST[i]!;
          if (vv < 0 || vv >= bh) continue;
          for (let j = 0; j < 3; j += 1) {
            let uu = u + NEAREST_FIRST[j]!;
            if (uu < 0) uu += bw;
            else if (uu >= bw) uu -= bw;
            if (this.same[earth[vv * bw + uu]!] === ours) {
              agree += 1;
              break search;
            }
          }
        }
      }
    }
    return agree / n;
  }
}

/** What the seas are compared as. */
export const SEA_AS = 255;
/** What lies beyond the poles. */
const OFF_EARTH = 256;
const NEAREST_FIRST = [0, -1, 1];
