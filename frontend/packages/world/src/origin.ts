import { markClones } from './originClones.ts';
import { ORIGIN_EARTH, ORIGIN_INVENTED, ORIGIN_SEA } from './originFile.ts';
import type { OriginGrid } from './originFile.ts';
import { STRETCH, carry, guessesFor, quadIndexOf } from './originQuads.ts';
import type { QuadIndex } from './originQuads.ts';
import { Scorer } from './originScore.ts';
import { starsOf } from './originStars.ts';
import type { StarField } from './originStars.ts';
import type { ClassRaster } from './raster.ts';

/**
 * The origin map: for every square of an edited master, the place on plain Earth it was cut from, or that it
 * was not cut from anywhere. See `docs/plans/real-world-names.md`.
 *
 * Plain Earth is the master the editing began from, in which a pixel is exactly a real longitude and
 * latitude. Adam moves land with Nearest Neighbour, so a piece keeps its pixels, and at a kilometre and a
 * bit a pixel the pattern of thirty-two classes is a fingerprint. Each square of the edited master is
 * given a placement - where its middle lands on Earth, and the turn, stretch and mirror that carry the rest -
 * and the placement is judged by how many of its pixels agree with Earth's beyond what chance would give
 * (`originScore.ts`).
 *
 * Squares are found three ways, cheapest first. Most land never moved, so every square is tried where it
 * is. A square that is found lends its placement to its neighbours, because land is moved in pieces; that
 * finds a whole piece from one square of it. And a square nothing has reached looks its small lakes up among
 * Earth's (`originQuads.ts`), which finds a piece wherever it went. What is still not found is invented, and
 * a piece that came from where a larger one did is a copy (`originClones.ts`).
 */

export interface OriginOptions {
  /** The classes that are sea. Ocean and shallow sea are one thing to this, since a shelf is redrawn freely. */
  readonly sea: ReadonlySet<number>;
  /** The class whose small patches are the landmarks. */
  readonly lake: number;
  readonly cell?: number;
  readonly log?: (line: string) => void;
}

/** A square judged this sure is found, and lends its placement to its neighbours. */
const SETTLED = 0.6;
/** A square judged at least this sure in the end came from Earth. */
const FOUND = 0.4;
/** A square this much of one class has no fingerprint, and is judged by its neighbours. */
const PLAIN = 0.97;
/** A square with fewer pixels of land than this is sea. */
const SOME_LAND = 8;

const TEXTURED = 1;
const FEATURELESS = 2;

export function originOf(edited: ClassRaster, base: ClassRaster, options: OriginOptions): OriginGrid {
  const log = options.log ?? (() => undefined);
  const match = new Matcher(edited, base, options.cell ?? 32, options.sea);
  match.tryWhereTheyAre();
  log(`${match.found()} of ${match.textured()} squares with a pattern found where they were`);

  const editedStars = starsOf(edited, options.lake);
  const index = quadIndexOf(starsOf(base, options.lake));
  log(
    `${editedStars.count} lakes to look up among ${index.field.count} of Earth's, in ${index.keys.length} quads`,
  );
  const looked = match.lookUp(editedStars, index);
  log(`${looked} squares looked up by their lakes; ${match.found()} found after growing from them`);

  match.polish();
  match.polish();
  log(`${match.found()} found after polishing`);
  return match.decide(log);
}

class Matcher {
  readonly cell: number;
  readonly columns: number;
  readonly rows: number;
  readonly earthWidth: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** Four numbers a square: the matrix `a b / c d` that carries a step within it onto Earth. */
  readonly m: Float64Array;
  /** The best exact score each square's placement has: what searching climbs. */
  private readonly kappa: Float64Array;
  /** How sure the placement is, judged: what deciding reads. */
  private readonly sure: Float64Array;
  private readonly kind: Uint8Array;
  private readonly score: Scorer;
  private random = 0x9e3779b9;

  constructor(edited: ClassRaster, base: ClassRaster, cell: number, sea: ReadonlySet<number>) {
    this.cell = cell;
    this.columns = Math.ceil(edited.width / cell);
    this.rows = Math.ceil(edited.height / cell);
    this.earthWidth = base.width;
    const n = this.columns * this.rows;
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.m = new Float64Array(n * 4);
    this.kappa = new Float64Array(n).fill(-1);
    this.sure = new Float64Array(n).fill(-1);
    this.score = new Scorer(edited, base, cell, sea);
    this.kind = this.classify(edited);
  }

  textured(): number {
    return this.kind.filter((kind) => kind === TEXTURED).length;
  }

  found(): number {
    let total = 0;
    for (let k = 0; k < this.kind.length; k += 1)
      if (this.kind[k] === TEXTURED && this.sure[k]! >= SETTLED) total += 1;
    return total;
  }

  tryWhereTheyAre(): void {
    const found: number[] = [];
    for (let k = 0; k < this.kind.length; k += 1) {
      if (this.kind[k] !== TEXTURED) continue;
      const [x, y] = this.middle(k);
      this.offer(k, x, y, 1, 0, 0, 1);
      if (this.judge(k) >= SETTLED) found.push(k);
    }
    this.grow(found);
  }

  /** Every square nothing has reached, most lakes first, looked up by its lakes. Returns how many were. */
  lookUp(stars: StarField, index: QuadIndex): number {
    const inSquare: number[][] = Array.from({ length: this.kind.length }, () => []);
    for (let star = 0; star < stars.count; star += 1) {
      inSquare[
        Math.floor(stars.y[star]! / this.cell) * this.columns + Math.floor(stars.x[star]! / this.cell)
      ]!.push(star);
    }
    const waiting = [...inSquare.keys()].filter((k) => this.kind[k] === TEXTURED && inSquare[k]!.length > 0);
    waiting.sort((p, q) => inSquare[q]!.length - inSquare[p]!.length);
    const isLand = (x: number, y: number) => this.score.isLand(x, y);
    let looked = 0;
    for (const k of waiting) {
      if (this.sure[k]! >= SETTLED) continue;
      looked += 1;
      for (const star of inSquare[k]!.slice(0, 3)) {
        for (const guess of guessesFor(stars, index, star, isLand)) {
          const [x, y] = carry(guess, ...this.middle(k));
          this.refine(k, x, y, guess.a, guess.b, guess.c, guess.d, 5);
        }
        if (this.judge(k) >= SETTLED) break;
      }
      if (this.sure[k]! >= SETTLED) this.grow([k]);
    }
    return looked;
  }

  /** Each square tries its found neighbours' placements and a few nearby ones, top left to bottom right and back. */
  polish(): void {
    for (const forward of [true, false]) {
      for (let at = 0; at < this.kind.length; at += 1) {
        const k = forward ? at : this.kind.length - 1 - at;
        if (this.kind[k] !== TEXTURED) continue;
        for (const n of this.neighbours(k)) if (this.sure[n]! >= SETTLED) this.lend(n, k);
        this.refine(k, this.x[k]!, this.y[k]!, ...this.matrix(k), 3);
        this.judge(k);
      }
    }
  }

  /** Every square its final status, and the featureless ones the placement of a neighbour they fit. */
  decide(log: (line: string) => void): OriginGrid {
    const n = this.kind.length;
    const status = new Uint8Array(n);
    const agreement = new Float32Array(n);
    for (let k = 0; k < n; k += 1) {
      if (this.kind[k] !== TEXTURED) continue;
      agreement[k] = this.score.judge(k, this.x[k]!, this.y[k]!, ...this.matrix(k), 1);
      status[k] = agreement[k]! >= FOUND ? ORIGIN_EARTH : ORIGIN_INVENTED;
    }
    // A square of nothing but ice or sand has no pattern of its own, so it is Earth's if a neighbour's
    // placement lays it on the same ice or sand, and invented if nothing does.
    const queue = [...status.keys()].filter((k) => status[k] === ORIGIN_EARTH);
    while (queue.length > 0) {
      const k = queue.pop()!;
      for (const next of this.neighbours(k)) {
        if (this.kind[next] !== FEATURELESS || status[next] !== ORIGIN_SEA) continue;
        this.kappa[next] = -1;
        this.lend(k, next);
        const agree = this.score.tolerant(next, this.x[next]!, this.y[next]!, ...this.matrix(next), 2);
        if (agree >= 0.95) {
          status[next] = ORIGIN_EARTH;
          agreement[next] = agree;
          queue.push(next);
        }
      }
    }
    let plain = 0;
    for (let k = 0; k < n; k += 1) {
      if (this.kind[k] === FEATURELESS && status[k] === ORIGIN_SEA) {
        status[k] = ORIGIN_INVENTED;
        plain += 1;
      }
    }
    const cloned = markClones(status, this);
    const tally = [0, 0, 0, 0];
    for (const one of status) tally[one]! += 1;
    log(
      `${tally[ORIGIN_EARTH]} squares from Earth, ${tally[ORIGIN_INVENTED]} invented (${plain} of them with no ` +
        `pattern at all), ${cloned} copies of somewhere else, ${tally[ORIGIN_SEA]} sea`,
    );
    const column = (at: number) => Float32Array.from({ length: n }, (_, k) => this.m[k * 4 + at]!);
    return {
      cell: this.cell,
      columns: this.columns,
      rows: this.rows,
      x: Float32Array.from(this.x),
      y: Float32Array.from(this.y),
      a: column(0),
      b: column(1),
      c: column(2),
      d: column(3),
      agreement,
      status,
    };
  }

  neighbours(k: number): number[] {
    const column = k % this.columns;
    const row = Math.floor(k / this.columns);
    const out = [
      row * this.columns + ((column + this.columns - 1) % this.columns),
      row * this.columns + ((column + 1) % this.columns),
    ];
    if (row > 0) out.push(k - this.columns);
    if (row < this.rows - 1) out.push(k + this.columns);
    return out;
  }

  /** Which squares are sea, which have a pattern to match, and which are too much one thing to have one. */
  private classify(edited: ClassRaster): Uint8Array {
    const { width, height, cells } = edited;
    const kind = new Uint8Array(this.columns * this.rows);
    const tally = new Int32Array(256);
    for (let k = 0; k < kind.length; k += 1) {
      const left = (k % this.columns) * this.cell;
      const top = Math.floor(k / this.columns) * this.cell;
      tally.fill(0);
      let total = 0;
      for (let y = top; y < Math.min(height, top + this.cell); y += 1) {
        for (let x = left; x < Math.min(width, left + this.cell); x += 1) {
          tally[this.score.same[cells[y * width + x]!]!]! += 1;
          total += 1;
        }
      }
      const land = total - tally[255]!;
      kind[k] = land < SOME_LAND ? 0 : Math.max(...tally) >= PLAIN * total ? FEATURELESS : TEXTURED;
    }
    return kind;
  }

  /** Spreads from squares that are found to every neighbour their placement fits. */
  private grow(queue: number[]): void {
    while (queue.length > 0) {
      const k = queue.pop()!;
      for (const n of this.neighbours(k)) {
        if (this.kind[n] !== TEXTURED || this.sure[n]! >= SETTLED) continue;
        this.lend(k, n);
        if (this.judge(n) < SETTLED) {
          this.refine(n, this.x[n]!, this.y[n]!, ...this.matrix(n), 4);
          this.judge(n);
        }
        if (this.sure[n]! >= SETTLED) queue.push(n);
      }
    }
  }

  /** Square `to` tries the placement of square `from`, carried across to where `to` is. */
  private lend(from: number, to: number): void {
    const [a, b, c, d] = this.matrix(from);
    let dx = (to % this.columns) - (from % this.columns);
    if (dx > 1) dx -= this.columns;
    if (dx < -1) dx += this.columns;
    const dy = Math.floor(to / this.columns) - Math.floor(from / this.columns);
    this.offer(
      to,
      this.x[from]! + (a * dx + b * dy) * this.cell,
      this.y[from]! + (c * dx + d * dy) * this.cell,
      a,
      b,
      c,
      d,
    );
  }

  /** A few placements near one, keeping whichever scores best; `rounds` from coarse to fine. */
  private refine(
    k: number,
    x: number,
    y: number,
    a: number,
    b: number,
    c: number,
    d: number,
    rounds: number,
  ): void {
    this.offer(k, x, y, a, b, c, d);
    for (let round = 0; round < rounds; round += 1) {
      const reach = 6 / 2 ** round;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const [ba, bb, bc, bd] = this.matrix(k);
        const mirror = Math.sign(ba * bd - bb * bc) || 1;
        const stretch = Math.min(
          STRETCH,
          Math.max(1 / STRETCH, Math.hypot(bb, bd) * (1 + this.next() * reach * 0.005)),
        );
        const turn = Math.atan2(-bb, bd) + this.next() * reach * 0.01;
        const cos = Math.cos(turn) * stretch;
        const sin = Math.sin(turn) * stretch;
        this.offer(
          k,
          this.x[k]! + this.next() * reach,
          this.y[k]! + this.next() * reach,
          cos * mirror,
          -sin,
          sin * mirror,
          cos,
        );
      }
    }
  }

  /** Takes a placement for a square if it scores better than the one it has. */
  private offer(k: number, x: number, y: number, a: number, b: number, c: number, d: number): void {
    const kappa = this.score.exact(k, x, y, a, b, c, d, 2);
    if (kappa <= this.kappa[k]!) return;
    this.kappa[k] = kappa;
    this.x[k] = ((x % this.earthWidth) + this.earthWidth) % this.earthWidth;
    this.y[k] = y;
    this.m.set([a, b, c, d], k * 4);
  }

  /** Judges a square's placement, keeps the answer, and returns it. */
  private judge(k: number): number {
    this.sure[k] = this.score.judge(k, this.x[k]!, this.y[k]!, ...this.matrix(k), 2);
    return this.sure[k]!;
  }

  private matrix(k: number): [number, number, number, number] {
    return [this.m[k * 4]!, this.m[k * 4 + 1]!, this.m[k * 4 + 2]!, this.m[k * 4 + 3]!];
  }

  private middle(k: number): [number, number] {
    return [
      (k % this.columns) * this.cell + this.cell / 2,
      Math.floor(k / this.columns) * this.cell + this.cell / 2,
    ];
  }

  /** A number from -1 to 1, the same sequence on every run, so that a master always gets the same map. */
  private next(): number {
    this.random = (this.random + 0x6d2b79f5) | 0;
    let t = Math.imul(this.random ^ (this.random >>> 15), 1 | this.random);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1;
  }
}
