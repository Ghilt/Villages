/**
 * The points `npm run perf:zoom` keeps, one line of `docs/experiments/performance/zoom.jsonl` each: how smoothly the
 * camera comes in from far out over ground thick with sprites and over bare ground, and where the time went while it
 * did. What the sprites cost a zoom is the forest's against the bare ground's. Read by the performance page; the tool
 * writes them by these types; which points compare is the shaders' reader's (`shaderPoints.ts`). See decision record
 * 0106.
 */

import { readLines } from './shaderPoints';
import type { Measured, Why } from './shaderPoints';
import type { Compiled, Span, Spent } from './startupPoints';

/** How the frames came over a stretch: a span of the start's, and the frames a second and the slow twentieth's gap. */
export interface Pacing extends Span {
  readonly fps: number;
  readonly p95Gap: number;
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
}

export function readZoomPoints(text: string): { points: ZoomPoint[]; unreadable: number } {
  return readLines<ZoomPoint>(text, (value) => {
    const point = value as Partial<ZoomPoint> | null;
    return typeof point?.method === 'number' && Array.isArray(point.zooms);
  });
}
