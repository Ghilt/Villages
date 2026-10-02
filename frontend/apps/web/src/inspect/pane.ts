import type { IconName } from '../stage/Icons';
import type { Pane } from '../stage/panes';
import { paneIdOf, type Subject } from './subjects';

/**
 * The pane that holds a window on one subject.
 *
 * On a phone it arrives at **half the stage**, which is what makes Adam's example come out right: the
 * thing that was clicked is still on the map above it. That is the arrival's doing rather than the pane's
 * - see `roomToRead` in `bays.ts` - because since 0046 a pane has nothing to say about how much of a bay
 * it gets.
 */
export function inspectPane(subject: Subject): Pane {
  return {
    id: paneIdOf(subject),
    title: subject.kind === 'house' ? 'a house' : subject.kind === 'area' ? 'an area' : 'a key figure',
    // Down the column, where up to three of them stack. The rail inside that one tile is what limits how
    // many, so a window asks the column for no height of its own.
    spread: 'left',
    tall: null,
    icon: SUBJECT_MARKS[subject.kind],
    needs: null,
  };
}

/**
 * The mark each kind of subject is known by, at the head of its window where the word for it used to be.
 *
 * The same marks the corner's tabs carry, so a house is a shield and a person a bust wherever either is
 * named; an area is a fence stepping along square corners, which no tab has.
 */
export const SUBJECT_MARKS: Readonly<Record<Subject['kind'], IconName>> = {
  house: 'shield',
  character: 'figure',
  area: 'area',
};
