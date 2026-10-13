/** The shapes the architecture page's data is in. See `world.ts`. */

/** Who makes a file: Adam's hand, a download, or a tool. */
export type Origin = 'authored' | 'fetched' | 'baked';

export interface Artifact {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly origin: Origin;
  /** One file, a few files that go together, or a folder of many. */
  readonly form: 'file' | 'files' | 'folder';
  readonly what: string;
  readonly size?: string;
  /**
   * What an agent at work on the world does with a file the running game never reads: looks at it to see what it
   * cannot open, or to judge a look and show Adam. Drawn with the robot, for development.
   */
  readonly development?: string;
}

export interface Tool {
  /** The npm script, run as `npm run <script> --prefix frontend`, or a script of Adam's in `scripts/`. */
  readonly script: string;
  readonly entry: string;
  readonly reads: readonly string[];
  readonly writes: readonly string[];
  /**
   * Seconds it takes for one master, the figure the bars are drawn from: measured on Adam's machine on
   * 2026-10-11 for every tool the quick-start runs, the documents' figure for the rest.
   */
  readonly seconds: number;
  /** What it takes, said, when one figure would mislead. */
  readonly time?: string;
  readonly perMaster: boolean;
  /** What runs it without anyone asking. */
  readonly ranBy: string;
  readonly what: string;
  readonly group: 'master' | 'pictures' | 'once' | 'adam' | 'cache';
  /** What an agent does with what it makes, when nothing of the game reads any of it. Drawn with the robot. */
  readonly development?: string;
}

/** A part of the running game that reads baked files. */
export interface Reader {
  readonly id: string;
  readonly program: 'page' | 'server';
  /** The part of the page that reads it, from `running.ts`; the game server reads as one process, and has none. */
  readonly piece?: string;
  readonly name: string;
  readonly where: string;
  readonly reads: readonly string[];
}
