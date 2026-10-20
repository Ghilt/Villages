import { resolve } from 'node:path';

import type { Why } from './kept.ts';

/** The tree the tool runs from: its points are kept here, whatever tree it measures. */
export const HERE = resolve(import.meta.dirname, '..', '..');

/** What a measure was told on its command line: `--name value` options and `--name` flags. */
export function argsOf(args: readonly string[]) {
  const option = (name: string): string | undefined => {
    const at = args.indexOf(`--${name}`);
    return at === -1 ? undefined : args[at + 1];
  };
  const flag = (name: string): boolean => args.includes(`--${name}`);
  const why = option('why') ?? 'by-hand';
  if (!['to-main', 'history', 'by-hand'].includes(why)) {
    throw new Error(`--why is to-main, history or by-hand, not ${why}`);
  }
  return {
    option,
    flag,
    /** The tree measured: another checkout, or this one. */
    tree: resolve(option('tree') ?? HERE),
    why: why as Why,
    /** A name for this run's files in `.logs/perf/`. */
    stamp: new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
  };
}
