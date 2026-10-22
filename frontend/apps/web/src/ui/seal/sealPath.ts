import type { SealState } from './HappeningSeal';

/** A place in a scene, in its units. */
export interface Spot {
  readonly x: number;
  readonly y: number;
}

/** How a seal keeps time: the seconds it forms in the mist, and the seconds it takes along its path. */
export interface SealTiming {
  readonly form: number;
  readonly lead: number;
}

/** A seal as it is at a second: whose it is, where in its life, and how far along its path, from 0 to 1. */
export interface SealNow {
  readonly index: number;
  readonly state: SealState;
  readonly along: number;
}

/**
 * Every seal there is at a second, when happenings arrive at `arrivals`: each waits in the mist, faded, from the moment
 * the one before it sets out - the first from the beginning - so the next is always seen coming; it forms there `form`
 * seconds before it sets out, comes along its path for `lead` seconds to arrive on its second, stays arrived until the
 * next arrives, and is spent for a second after. A pure function of the second, whole or not, so a second scrubbed back
 * to shows each where it was and a second played smoothly moves each smoothly.
 */
export function sealsAt(second: number, arrivals: readonly number[], timing: SealTiming): SealNow[] {
  return arrivals.flatMap((at, index): SealNow[] => {
    const next = arrivals[index + 1] ?? Infinity;
    const leaves = at - timing.lead;
    const born = leaves - timing.form;
    const before = arrivals[index - 1];
    const waits = before === undefined ? -Infinity : before - timing.lead;
    if (second < Math.min(born, waits)) return [];
    if (second < born) return [{ index, state: 'waiting', along: 0 }];
    if (second < leaves) return [{ index, state: 'forming', along: 0 }];
    if (second < at) return [{ index, state: 'coming', along: (second - leaves) / timing.lead }];
    if (second < next) return [{ index, state: 'arrived', along: 1 }];
    if (second < next + 1) return [{ index, state: 'spent', along: 1 }];
    return [];
  });
}

/** The spot a share of the way along a path of straight runs, measured by their lengths. */
export function spotAlong(path: readonly Spot[], along: number): Spot {
  const first = path[0];
  if (first === undefined) {
    return { x: 0, y: 0 };
  }
  const runs = path.slice(1).map((to, at) => {
    const from = path[at]!;
    return { from, to, length: Math.hypot(to.x - from.x, to.y - from.y) };
  });
  const whole = runs.reduce((sum, run) => sum + run.length, 0);
  let left = Math.max(0, Math.min(1, along)) * whole;
  for (const run of runs) {
    if (left <= run.length) {
      const share = run.length === 0 ? 0 : left / run.length;
      return {
        x: run.from.x + (run.to.x - run.from.x) * share,
        y: run.from.y + (run.to.y - run.from.y) * share,
      };
    }
    left -= run.length;
  }
  return path[path.length - 1] ?? first;
}
