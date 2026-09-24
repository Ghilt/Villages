import { ageOn } from '@villages/client-core';
import type { KeyFigureView, StatName } from '@villages/protocol';

/**
 * Saying who a key figure is, in the words the interface uses for them, and what changed about them.
 *
 * One copy, for the debug panel's Characters section now and the key figures pane after it, so the two
 * never quietly stop being the same words. See `house/describe.ts`, which is the same rule for a house.
 */

/**
 * What a player calls each stat.
 *
 * Piety and Reason are the resources' own words on purpose: a key figure's piety and the house's piety
 * are to be joined, and until then they are at least spelled the same. See decision record 0055.
 */
export const STAT_WORDS: Record<StatName, string> = {
  piety: 'Piety',
  reason: 'Reason',
  kindness: 'Kindness',
  physical: 'Physical',
};

/** The order they are shown in, which is the order Adam named them in. */
export const STATS_IN_ORDER: readonly StatName[] = ['piety', 'reason', 'kindness', 'physical'];

/** The given name and the family name, as a person is introduced. */
export function fullName(figure: KeyFigureView): string {
  return `${figure.givenName} ${figure.familyName}`;
}

/** Who they are at a glance: the name, the sex and the age, or the name and the sex before today is known. */
export function introduce(figure: KeyFigureView, today: number | null): string {
  const who = `${fullName(figure)}, a ${figure.sex}`;
  return today === null ? who : `${who} of ${ageOn(figure.bornOn, figure.agedYears, today)}`;
}

function years(count: number): string {
  return `${count} ${Math.abs(count) === 1 ? 'year' : 'years'}`;
}

/**
 * What one figure's record did between two views of it, a phrase each, in the order a reader would ask.
 *
 * Only what the view carries, so a death is not here: a dead figure leaves the list, and the kill that
 * did it has its own line where it was asked for.
 */
function whatMoved(before: KeyFigureView, after: KeyFigureView, today: number | null): string[] {
  const said: string[] = [];
  for (const stat of STATS_IN_ORDER) {
    if (before.stats[stat] !== after.stats[stat]) {
      said.push(`${STAT_WORDS[stat].toLowerCase()} went from ${before.stats[stat]} to ${after.stats[stat]}`);
    }
  }
  const aged = after.agedYears - before.agedYears;
  if (aged !== 0) {
    const way = aged > 0 ? `was aged ${years(aged)}` : `was made ${years(-aged)} younger`;
    said.push(today === null ? way : `${way}, and is ${ageOn(after.bornOn, after.agedYears, today)}`);
  }
  if (before.place?.lat !== after.place?.lat || before.place?.lon !== after.place?.lon) {
    said.push(
      after.place === undefined
        ? 'is on no map now'
        : `now stands at ${after.place.lat.toFixed(3)}, ${after.place.lon.toFixed(3)}`,
    );
  }
  if (before.portrait !== after.portrait) {
    said.push(
      after.portrait === undefined ? 'has no portrait now' : `has another portrait, ${after.portrait}`,
    );
  }
  const holdersBefore = before.keyFigureOf.map((house) => house.name).join(', ');
  const holdersAfter = after.keyFigureOf.map((house) => house.name).join(', ');
  if (holdersBefore !== holdersAfter) {
    said.push(`is now a key figure of ${holdersAfter}`);
  }
  return said;
}

/**
 * The log lines a new list of the player's key figures is worth, against the list heard before it.
 *
 * The first list a connection hears is said whole, because it is what the player arrived to; after that
 * only what changed is said, a line a figure, because the whole list again after every stat changed would
 * bury the one change in eight lines that did not. Nothing changed says nothing at all.
 */
export function whatChanged(
  before: readonly KeyFigureView[] | null,
  after: readonly KeyFigureView[],
  today: number | null,
): string[] {
  if (before === null) {
    if (after.length === 0) {
      return ['no key figures yet'];
    }
    const who = after.map((figure) => introduce(figure, today)).join('; ');
    return [`${after.length} key ${after.length === 1 ? 'figure' : 'figures'}: ${who}`];
  }

  const earlier = new Map(before.map((figure) => [figure.id, figure]));
  const later = new Set(after.map((figure) => figure.id));
  const said: string[] = [];
  for (const figure of after) {
    const was = earlier.get(figure.id);
    if (was === undefined) {
      said.push(`${introduce(figure, today)}, is a key figure of your house now`);
      continue;
    }
    const moved = whatMoved(was, figure, today);
    if (moved.length > 0) {
      said.push(`${fullName(figure)}: ${moved.join('; ')}`);
    }
  }
  for (const figure of before) {
    if (!later.has(figure.id)) {
      said.push(`${fullName(figure)} is no longer a key figure of your house`);
    }
  }
  return said;
}
