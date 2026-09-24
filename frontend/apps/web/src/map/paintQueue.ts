/**
 * Which painted tile to start next, and which to give up on - the decisions, and nothing else.
 *
 * Kept apart from the workers, the promises and MapLibre so that the rules can be tested without any of
 * them, because the rules are the part that breaks quietly. A tile two requests share has to survive one
 * of them giving up. A tile already with a painter must never be dropped, because it is going to be
 * painted whatever happens and throwing away its answer would waste the paint. And the coarsest waiting
 * tile goes first, the newest of those when several are level. See `next` for why. See experiment 0008.
 */

export interface QueuedJob {
  key: string;
  /** The tile's zoom. Lower is coarser, and a coarser tile is painted first. */
  zoom: number;
  /** Waiting for a painter, or with one. Only a waiting job can be given up. */
  state: 'waiting' | 'painting';
  /** How many requests are waiting on this tile. At none, and still waiting, it is dropped. */
  wantedBy: number;
}

/**
 * Whichever painter has least in hand. The first of them, when several are level.
 *
 * Sending neighbouring tiles to the same painter was tried first, so that it would already hold the
 * decoded terrain they share. It measured the same, and it has a fault this does not: past zoom seven
 * every tile on the screen has the same ancestor, so a whole screen would go to one painter.
 */
export function leastLoaded(loads: readonly number[]): number {
  let chosen = 0;
  for (let index = 1; index < loads.length; index += 1) {
    if (loads[index]! < loads[chosen]!) {
      chosen = index;
    }
  }
  return chosen;
}

export class PaintQueue<J extends QueuedJob> {
  /** Every tile being waited on, waiting or painting, so that asking for one twice joins the first. */
  private readonly jobs = new Map<string, J>();
  /** The ones not yet given to a painter, in the order they were asked for. */
  private readonly waiting: J[] = [];

  /** @param depth how many tiles one painter may hold at once, which bounds what cannot be taken back. */
  constructor(private readonly depth: number) {}

  find(key: string): J | undefined {
    return this.jobs.get(key);
  }

  has(key: string): boolean {
    return this.jobs.has(key);
  }

  /** Whether any wanted tile is still waiting for a painter. Speculation waits for this to be false. */
  get anyWaiting(): boolean {
    return this.waiting.length > 0;
  }

  /** A tile somebody wants, which waits its turn for a painter. */
  enqueue(job: J): void {
    this.jobs.set(job.key, job);
    this.waiting.push(job);
  }

  /** A tile going straight to a painter, which is what a speculative one does. */
  track(job: J): void {
    job.state = 'painting';
    this.jobs.set(job.key, job);
  }

  /**
   * One of the requests waiting on a tile gives up. Returns whether that dropped it: the last of them
   * gone, and no painter holding it yet, so it is taken out and never painted.
   */
  giveUp(job: J): boolean {
    job.wantedBy -= 1;
    if (job.wantedBy > 0 || job.state !== 'waiting') {
      return false;
    }
    const at = this.waiting.indexOf(job);
    if (at >= 0) {
      this.waiting.splice(at, 1);
    }
    this.jobs.delete(job.key);
    return true;
  }

  /** A tile is done with, painted or failed. */
  finish(job: J): void {
    if (this.jobs.get(job.key) === job) {
      this.jobs.delete(job.key);
    }
  }

  /**
   * The next wanted tile to start, and the painter to give it to, if the painter with least in hand has
   * room. Null when nothing waits or every painter is full.
   *
   * **The coarsest waiting tile goes first.** Under the sharp painted layer lies a coarse copy of it, two
   * zooms down, so that somewhere not yet painted shows rough ground rather than nothing; see
   * `renderers.ts`. One of its tiles stands in for sixteen sharp ones at the price of one, and painting it
   * first is what fills the screen at once with something that then sharpens. Painted in the order they
   * were asked for, the coarse tiles would arrive with the sharp ones they were meant to stand in for.
   *
   * Among tiles of the same zoom the newest goes first, because on a zoom out the newest is the level
   * being stopped at and the oldest are the levels passed through on the way.
   */
  next(loads: readonly number[]): { job: J; painter: number } | null {
    if (this.waiting.length === 0) {
      return null;
    }
    const painter = leastLoaded(loads);
    if ((loads[painter] ?? 0) >= this.depth) {
      return null;
    }
    let chosen = this.waiting.length - 1;
    for (let index = chosen - 1; index >= 0; index -= 1) {
      if (this.waiting[index]!.zoom < this.waiting[chosen]!.zoom) {
        chosen = index;
      }
    }
    const [job] = this.waiting.splice(chosen, 1);
    job!.state = 'painting';
    return { job: job!, painter };
  }
}
