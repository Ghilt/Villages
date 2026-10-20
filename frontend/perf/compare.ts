import type { KeptPlace } from './kept.ts';

/**
 * What moved between a run and the point it is compared with, place by place: a frame that changed by more than a
 * share of itself or a least amount, whichever is more, or a part within it that did. Runs of the same tree mostly
 * agree within two in a hundred, but a light place's whole run can come out up to nine in a hundred slower on another
 * day with nothing changed (2026-10-20: the coast and the sky, morning against evening), so under ten in a hundred -
 * or under 0.1 ms for a frame, 0.05 ms for a part - is not called a move. The fog's frame is whatever ground the
 * founded seat stands on, which changes from run to run, so there only the fog's own parts are compared, as a part.
 */
export interface Moved {
  readonly place: string;
  readonly then: number;
  readonly now: number;
  readonly parts: readonly { key: string; then: number; now: number }[];
}

export interface Comparison {
  readonly moved: readonly Moved[];
  /** Places measured both times that did not move. */
  readonly held: readonly string[];
  /** Places measured now and not then, and then and not now. */
  readonly added: readonly string[];
  readonly gone: readonly string[];
}

export const MOVE = { share: 0.1, least: 0.1, leastPart: 0.05 } as const;

const fogParts = (place: KeptPlace) =>
  Object.entries(place.keys)
    .filter(([key]) => key.includes('fog-of-war'))
    .reduce((sum, [, ms]) => sum + ms, 0);

/** What a place is compared by: its frame, or at the fog its fog's own parts. */
export function measureOf(place: KeptPlace): number {
  return place.name === 'fog' ? fogParts(place) : place.frame;
}

const movedBy = (then: number, now: number, share: number, least: number) =>
  Math.abs(now - then) > Math.max(least, share * then);

export function whatMoved(
  now: readonly KeptPlace[],
  then: readonly KeptPlace[],
  rule: typeof MOVE = MOVE,
): Comparison {
  const moved: Moved[] = [];
  const held: string[] = [];
  for (const place of now) {
    const was = then.find((each) => each.name === place.name);
    if (was === undefined) continue;
    const keys = [...new Set([...Object.keys(place.keys), ...Object.keys(was.keys)])].filter(
      (key) => place.name !== 'fog' || key.includes('fog-of-war'),
    );
    const parts = keys
      .map((key) => ({ key, then: was.keys[key] ?? 0, now: place.keys[key] ?? 0 }))
      .filter((part) => movedBy(part.then, part.now, rule.share, rule.leastPart))
      .sort((a, b) => Math.abs(b.now - b.then) - Math.abs(a.now - a.then))
      .slice(0, 4);
    const least = place.name === 'fog' ? rule.leastPart : rule.least;
    if (!movedBy(measureOf(was), measureOf(place), rule.share, least) && parts.length === 0) {
      held.push(place.name);
      continue;
    }
    moved.push({ place: place.name, then: measureOf(was), now: measureOf(place), parts });
  }
  return {
    moved,
    held,
    added: now.filter((place) => !then.some((each) => each.name === place.name)).map((place) => place.name),
    gone: then.filter((place) => !now.some((each) => each.name === place.name)).map((place) => place.name),
  };
}

/** The comparison in words, a line a place that moved. */
export function said(comparison: Comparison): string[] {
  const ms = (value: number) => value.toFixed(2);
  const lines = comparison.moved.map((move) => {
    const percent = ((move.now - move.then) / move.then) * 100;
    const parts = move.parts.map((part) => `${part.key} ${ms(part.then)} → ${ms(part.now)}`).join(', ');
    return `${move.place} ${ms(move.then)} → ${ms(move.now)} ms (${percent > 0 ? '+' : ''}${percent.toFixed(0)}%)${parts === '' ? '' : `: ${parts}`}`;
  });
  if (comparison.moved.length === 0) {
    lines.push(
      `nothing moved beyond ${MOVE.share * 100}%, ${MOVE.least} ms a frame or ${MOVE.leastPart} ms a part, at ${comparison.held.length} places`,
    );
  }
  if (comparison.added.length > 0) lines.push(`measured now and not then: ${comparison.added.join(', ')}`);
  if (comparison.gone.length > 0) lines.push(`measured then and not now: ${comparison.gone.join(', ')}`);
  return lines;
}

/** One number of a run beside the last point's: a start's or a zoom's, which are timed on the CPU and the network. */
export interface Beside {
  readonly name: string;
  readonly then: number | null;
  readonly now: number | null;
  /** The least change called a move, in the number's own unit. */
  readonly least: number;
  readonly unit: string;
}

/**
 * Numbers of a run beside the last point's, a line each, and `moved` on those that changed by more than a fifth of
 * themselves and their least amount. The start and the zoom are timed on the CPU, the network and the dev server, and
 * spread wider from run to run than the card's frames do: three runs of one tree's start agreed within a tenth
 * (2026-10-20).
 */
export function besideSaid(rows: readonly Beside[], share = 0.2): string[] {
  const shown = (value: number | null, unit: string) =>
    value === null ? '-' : unit === 's' ? (value / 1000).toFixed(1) : String(Math.round(value));
  return rows.map(({ name, then, now, least, unit }) => {
    const moved =
      then !== null && now !== null && Math.abs(now - then) > Math.max(least, share * Math.abs(then));
    return `${moved ? 'moved ' : '      '}${name.padEnd(40)} ${shown(then, unit).padStart(7)} → ${shown(now, unit).padStart(7)} ${unit}`.trimEnd();
  });
}
