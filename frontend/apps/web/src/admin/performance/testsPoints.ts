/**
 * The points `node scripts/check.ts --record` keeps, one line of `docs/experiments/performance/tests.jsonl` each: how
 * long each part of the checks took and each of its steps, how many tests it ran, and where their time went. The tool
 * writes them by the same shape in `scripts/lib/record.ts`, which may import nothing of the frontend (decision record
 * 0082), so the two are kept alike by hand. Which points compare is the shaders' reader's: by one method, on one
 * machine, here its CPU. See decision record 0106.
 */

import { readLines } from './shaderPoints';
import type { Measured, Why } from './shaderPoints';

export interface Took {
  readonly name: string;
  readonly ms: number;
}

/** One part of the checks: the backend, the frontend, the scripts' own, the end-to-end test. */
export interface KeptPart {
  readonly name: string;
  readonly passed: boolean;
  /** Why it was not run, when it was not: not in the tree checked, or something it needs was missing. */
  readonly notRun?: string;
  readonly ms: number;
  /** Each step it ran, in order, and how long it took: the backend's compile and its check, the frontend's four. */
  readonly steps: readonly Took[];
  readonly tests: number | null;
  readonly failed: number;
  readonly skipped: number;
  /** Vitest's own account of where its time went, each stage summed over its workers. */
  readonly vitest?: Readonly<Record<string, number>>;
  /** The backend's modules by the time their specs took, summed; they run side by side. */
  readonly modules?: readonly (Took & { readonly tests: number })[];
  /** The slowest test files or specs, the slowest first. */
  readonly slowest?: readonly Took[];
}

export interface TestsPoint extends Measured {
  readonly why: Why;
  readonly machine: { readonly cpu: string; readonly memory: string; readonly os: string };
  /** Whether Docker answered: the backend's tests that need it ran, and the end-to-end test's restart. */
  readonly docker: boolean;
  readonly ms: number;
  readonly parts: readonly KeptPart[];
}

/** The parts, in the order the checks run them. */
export const PARTS = ['backend', 'frontend', 'scripts', 'e2e'] as const;

export function readTestsPoints(text: string): { points: TestsPoint[]; unreadable: number } {
  return readLines<TestsPoint>(text, (value) => {
    const point = value as Partial<TestsPoint> | null;
    return typeof point?.method === 'number' && Array.isArray(point.parts);
  });
}

/** A part's step by name, or none: the time of one step, point by point. */
export function stepOf(part: KeptPart | undefined, step: string): number | null {
  return part?.steps.find((each) => each.name === step)?.ms ?? null;
}
