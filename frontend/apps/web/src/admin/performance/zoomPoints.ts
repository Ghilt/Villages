/**
 * The points `npm run perf:zoom` keeps, one line of `docs/experiments/performance/zoom.jsonl` each: how smoothly the
 * camera comes in from far out over ground thick with sprites and over bare ground, and crosses into the real world
 * over the busiest ground, and where the time went while it did. What the sprites cost a zoom is the forest's against
 * the bare ground's. Read by the performance page; the tool writes them by these types; which points compare is the
 * shaders' reader's (`shaderPoints.ts`). See decision record 0106 and `docs/plans/smooth-crossing-into-the-real-world.md`.
 */

// With its extension, because the performance tools in `frontend/perf/` run this on Node, which looks for no other.
import { readLines } from './shaderPoints.ts';
import type { Measured, Why } from './shaderPoints';
import type { Compiled, Span, Spent } from './startupPoints';

/** How the frames came over a stretch: a span of the start's, and the frames a second and the slow twentieth's gap. */
export interface Pacing extends Span {
  readonly fps: number;
  readonly p95Gap: number;
  /** Gaps between frames of 25 ms or more, each a frame lost at sixty a second; absent from points before 2026-10-22. */
  readonly late?: number;
}

/** A frame that came late, and what the CPU was doing while the page waited for it. */
export interface SlowFrame {
  /** When the gap began, in milliseconds after the camera began to move, and how long it was. */
  readonly at: number;
  readonly ms: number;
  /**
   * What ran in it, the most first: the game's own function nearest the top of the stack with whatever it called in
   * the libraries, or a library's name where none of the game's was running.
   */
  readonly ran: readonly Spent[];
}

/** One zoom in over one place, from a fresh page settled far out. */
export interface Zoomed {
  readonly place: string;
  readonly lat: number;
  readonly lon: number;
  readonly from: number;
  readonly to: number;
  /** How long the camera took to come in, and the frames while it did; then the seconds after, while what came settles. */
  readonly ms: number;
  readonly during: Pacing;
  readonly after: Pacing;
  /** The CPU over the zoom and the seconds after: busy, and the part of that collecting garbage. */
  readonly cpu: { readonly busy: number; readonly gc: number };
  readonly modules: readonly Spent[];
  readonly functions: readonly Spent[];
  /** The sprites of the scenery drawn once it had settled, where the page says. */
  readonly sprites: number | null;
  /** The stretches of road and the things of the roadside held once it had settled; absent before 2026-10-22. */
  readonly roads?: { readonly strips: number; readonly roadside: number } | null;
  /** The slowest frames over the zoom and the seconds after, and what ran in each; absent before 2026-10-22. */
  readonly slowest?: readonly SlowFrame[];
  /** How far the camera was panned east, in screen pixels, for a pan rather than a zoom. */
  readonly east?: number;
  /** The programs the page waited on the graphics driver to compile while it came in, the longest first. */
  readonly compiles: readonly Compiled[];
}

export interface ZoomPoint extends Measured {
  readonly why: Why;
  readonly machine: {
    readonly gpu: string;
    readonly cpu: string;
    readonly chrome: string;
    readonly viewport: string;
  };
  /** The shaders' levels as a player has them, which the zoom is measured at. */
  readonly levels: Readonly<Record<string, string>>;
  /**
   * The run's first zoom, over the first place, in a browser that has compiled none of the game's programs yet: what a
   * player's first visit meets, and every visit after a shader changes. The land's program is first compiled here,
   * once the camera comes inside zoom 8.5.
   */
  readonly firstZoom: Zoomed | null;
  /** Each place's zoom once the browser has compiled the programs, the middle of `of` by how long the page stalled. */
  readonly zooms: readonly Zoomed[];
  readonly of: number;
  /**
   * The crossing into the real world at zoom 7.5 over the busiest place: settled at 7, flown to 8.2. The run's first,
   * waiting on whatever programs only the real world needs, and the middle of `of` by how many frames came late.
   * Absent from points before 2026-10-22.
   */
  readonly firstCrossing?: Zoomed | null;
  readonly crossing?: Zoomed | null;
  /**
   * The pan across the same ground with the real world in: settled at zoom 8.5 and panned two screens east over four
   * seconds. The run's first, and the middle of `of` by how many frames came late. Absent before 2026-10-23.
   */
  readonly firstPan?: Zoomed | null;
  readonly pan?: Zoomed | null;
}

export function readZoomPoints(text: string): { points: ZoomPoint[]; unreadable: number } {
  return readLines<ZoomPoint>(text, (value) => {
    const point = value as Partial<ZoomPoint> | null;
    return typeof point?.method === 'number' && Array.isArray(point.zooms);
  });
}
