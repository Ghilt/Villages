import { DAYS_PER_YEAR, describeDay } from '@villages/protocol';

/**
 * The arithmetic behind the timeline scrubber, kept pure so the words it shows can be tested rather than
 * read off a screen.
 */

/** Where the world's clock stands, as welcome said. */
export interface WorldNow {
  today: number;
  earliest: number;
}

/**
 * How far back the scrubber can go, at the least. Before the seed exists the earliest thing is today, and
 * a scrubber with nowhere to go teaches nothing; fifty years of travel shows the world empty before it
 * began, which is true.
 */
export const LEAST_TRAVEL_YEARS = 50;

/** The days the scrubber runs over: from the earliest anything is known to exist, or further, to today. */
export function scrubberRange(world: WorldNow): { from: number; to: number } {
  return {
    from: Math.max(0, Math.min(world.earliest, world.today - LEAST_TRAVEL_YEARS * DAYS_PER_YEAR)),
    to: world.today,
  };
}

/** What the scrubber says about the day being looked at. Null is live, which is today. */
export function describeViewing(viewingAt: number | null, world: WorldNow): string {
  if (viewingAt === null || viewingAt >= world.today) {
    return `live, ${describeDay(world.today)}`;
  }
  const daysAgo = world.today - viewingAt;
  const ago =
    daysAgo < DAYS_PER_YEAR
      ? `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`
      : `${Math.round(daysAgo / DAYS_PER_YEAR)} years ago`;
  return `${describeDay(viewingAt)}, ${ago}`;
}
