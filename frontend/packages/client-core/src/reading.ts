import type { DialogueView, LineView } from '@villages/protocol';

/**
 * Where a player is in reading one dialogue: how many lines of the stretch ahead are showing.
 *
 * The server sends the stretch whole, up to the next step, and the page shows it a line at a time; this is the
 * page's place in it, and nothing the server knows or records. It holds while the dialogue's revision holds,
 * and a new revision - a step taken, in this window or another - starts the new stretch from its first line,
 * which is also what a reload does. Pure, so the rules of reading have a test and no component keeps them.
 * See decision record 0071.
 */
export interface Reading {
  readonly dialogueId: string;
  readonly revision: number;
  /** How many lines of the stretch are showing, from its start. */
  readonly shown: number;
}

/** A dialogue opened, or opened again: the first line of its stretch showing, or none when there is none. */
export function startReading(dialogue: DialogueView): Reading {
  return { dialogueId: dialogue.id, revision: dialogue.revision, shown: Math.min(1, dialogue.next.length) };
}

/**
 * The place in a dialogue as it now stands: kept while its revision holds, and started again from the
 * stretch's first line when the dialogue has moved on, or when the place was in another dialogue.
 */
export function keepReading(reading: Reading | null, dialogue: DialogueView): Reading {
  return reading !== null && reading.dialogueId === dialogue.id && reading.revision === dialogue.revision
    ? reading
    : startReading(dialogue);
}

/** What a page shows of a dialogue at a reading place, after everything already said. */
export interface Showing {
  /** The lines of the stretch showing, in order. */
  readonly lines: readonly LineView[];
  /** Whether there is *next* to press: a line of the stretch still hidden, or the step the stretch ends in. */
  readonly next: boolean;
  /** The dialogue choice's options, once the stretch they follow is all showing. */
  readonly options: readonly LineView[];
}

/**
 * What shows at a reading place. A dialogue that has ended shows nothing more, and neither *next* nor
 * options: a lost one ends where it stood.
 */
export function showing(reading: Reading, dialogue: DialogueView): Showing {
  const lines = dialogue.next.slice(0, reading.shown);
  if (dialogue.ending.kind !== 'open') {
    return { lines, next: false, options: [] };
  }
  const allShowing = reading.shown >= dialogue.next.length;
  return {
    lines,
    next: !allShowing || (dialogue.options.length === 0 && dialogue.next.length > 0),
    options: allShowing ? dialogue.options : [],
  };
}

/**
 * What a press does: shows one more line of the stretch, or sends the step that the house writes down - the
 * line the stretch ends in, or an option taken.
 */
export type Press =
  { readonly kind: 'show'; readonly reading: Reading } | { readonly kind: 'step'; readonly line: LineView };

/**
 * Pressing *next*: the next line of the stretch if one is hidden, and once the stretch is all showing and no
 * dialogue choice follows it, the step it ends in. Nothing while a step is out, because the answer to it is a
 * new stretch, and nothing when there is nothing to press.
 */
export function pressNext(reading: Reading, dialogue: DialogueView, stepOut: boolean): Press | null {
  if (stepOut || !showing(reading, dialogue).next) {
    return null;
  }
  if (reading.shown < dialogue.next.length) {
    return { kind: 'show', reading: { ...reading, shown: reading.shown + 1 } };
  }
  const last = dialogue.next[dialogue.next.length - 1];
  return last === undefined ? null : { kind: 'step', line: last };
}

/**
 * Taking an option of the dialogue choice: the step, once the options are showing, and nothing before they
 * are or while a step is out.
 */
export function choose(
  reading: Reading,
  dialogue: DialogueView,
  optionId: string,
  stepOut: boolean,
): Press | null {
  if (stepOut) {
    return null;
  }
  const option = showing(reading, dialogue).options.find((one) => one.id === optionId);
  return option === undefined ? null : { kind: 'step', line: option };
}
