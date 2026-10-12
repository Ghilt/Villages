import type { Shelf } from './worldCache.ts';
import { isBorrowed, readBorrowed } from './worldCache.ts';
import { fingerprintsOf, whatMoved } from './worldKeys.ts';
import type { Fingerprint, HashMemo } from './worldKeys.ts';
import type { StepName } from './worldSteps.ts';

/**
 * Where each world step of a master stands in a tree, worked out from fingerprints and never from dates: what
 * `world:ready` acts on, and what the debug panel says (decision record 0095).
 *
 * - **current**: the tree serves the entry its inputs name now.
 * - **on the shelf**: the world cache has that entry, and the tree has not borrowed it yet: seconds.
 * - **to make**: nobody has made it from these inputs: its tool runs, once for every tree.
 * - **cannot**: an input it cannot be made without is missing; `why` says which.
 *
 * `why` says what moved since the world the tree has now was made, in plain words.
 */
export type Standing = 'current' | 'on the shelf' | 'to make' | 'cannot';

export interface StepState {
  name: StepName;
  fingerprint: Fingerprint;
  standing: Standing;
  why: string[];
}

export function statesOf(master: string, root: string, shelf: Shelf, memo: HashMemo): StepState[] {
  const record = readBorrowed(root);
  const states: StepState[] = [];
  for (const [name, fingerprint] of fingerprintsOf(master, { root, memo })) {
    const { step, key, parts, missing } = fingerprint;
    const had = record[step.perMaster ? master : '*']?.[name];
    const then = had === undefined ? undefined : shelf.has(name, had)?.parts;
    if (missing.length > 0) {
      states.push({ name, fingerprint, standing: 'cannot', why: [`${missing[0]} is missing`] });
      continue;
    }
    const filed = shelf.has(name, key);
    if (
      filed !== undefined &&
      had === key &&
      isBorrowed(shelf.entryOf(name, key), filed, step, master, root)
    ) {
      states.push({ name, fingerprint, standing: 'current', why: [] });
      continue;
    }
    const why =
      had === key ? ['the tree has made or lost its own since it borrowed it'] : whatMoved(then, parts);
    states.push({ name, fingerprint, standing: filed === undefined ? 'to make' : 'on the shelf', why });
  }
  return states;
}
