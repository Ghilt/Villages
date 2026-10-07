import type { Description } from './describe';
import type { Subject } from './subjects';

/**
 * What each window last said, for the life of the page.
 *
 * A window is for reading about a thing and going on from it, wherever the map happens to be, so one whose subject
 * the camera has left goes on saying what it last knew rather than asking the player to pan back: Adam's word of
 * 2026-10-07. A window is fed from the cells the camera holds, so until the server answers a window whatever the
 * camera holds - the roadmap's "an inspect window that stays up to date" - this is all it has of a house panned
 * away from. What ticks is remembered as still: a number frozen when it was last seen is not living.
 */
const lastSaid = new Map<string, Description>();

const keyOf = (subject: Subject): string => `${subject.kind}:${subject.id}`;

/**
 * What a window says: what it can say now, which is remembered, or when it can say nothing now, what it last said;
 * null only for a subject this page has never been able to say anything of.
 */
export function sayingOrLastSaid(subject: Subject, now: Description | null): Description | null {
  if (now !== null) {
    lastSaid.set(keyOf(subject), now);
    return now;
  }
  const last = lastSaid.get(keyOf(subject));
  return last === undefined
    ? null
    : { ...last, facts: last.facts.map((fact) => ({ what: fact.what, said: fact.said })) };
}
