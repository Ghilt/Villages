import type { LaidOut } from '@villages/world';

import type { Entry } from '../markEntry';
import { footprintAt } from '../standing/footprint';
import { standingOf } from '../standing/standingOf';
import type { StandingThing } from '../standing/StandingLayer';
import { squareCorner } from './settlementDress';

/*
 * The marks as they stand among the trees, a settlement and every structure inside it as one thing: its houses, its
 * mill and its market, its jetties and boats, ordered among themselves farther first, on the settlement's square. Each
 * thing standing cuts the trees into one more slice, a draw each, so a village of a dozen houses costs one, as it did
 * when it was one structure (decision records 0110 and 0117). A settlement not laid out yet leaves its structures to
 * stand alone.
 */

/** How much the camera squashes the ground: what a step south is on the screen against a step east. */
const LEAN = Math.SQRT1_2;

export function standTogether(entries: Iterable<Entry>): StandingThing[] {
  const out: StandingThing[] = [];
  const groups = new Map<string, { square: LaidOut['square'] | null; members: StandingThing[] }>();
  for (const entry of entries) {
    const thing = standingOf(entry);
    const { spec } = entry;
    const key = spec.partOf?.id ?? (spec.structure?.settlement !== undefined ? spec.id : null);
    if (key === null) {
      if (thing !== null) out.push(thing);
      continue;
    }
    const group = groups.get(key) ?? { square: null, members: [] };
    if (spec.id === key) group.square = spec.structure?.laid?.square ?? null;
    if (thing !== null) group.members.push(thing);
    groups.set(key, group);
  }
  for (const [id, { square, members }] of groups) {
    if (square === null) {
      out.push(...members);
      continue;
    }
    if (members.length > 0) out.push(together(id, square, members));
  }
  return out;
}

/** The members as one thing on the square, its picture's reach worked out from theirs. */
function together(id: string, square: LaidOut['square'], members: readonly StandingThing[]): StandingThing {
  const place = squareCorner(square);
  const ordered = [...members].sort((a, b) => a.place.y - b.place.y || a.place.x - b.place.x);
  let left = 0;
  let right = 0;
  let top = 0;
  for (const member of ordered) {
    const off = { x: member.place.x - place.x, y: (member.place.y - place.y) * LEAN };
    const from = off.x - member.anchor * member.wide;
    left = Math.min(left, from);
    right = Math.max(right, from + member.wide);
    top = Math.min(top, off.y - member.tall);
  }
  const wide = Math.max(0.1, right - left);
  return {
    id,
    sprites: ordered.flatMap((member) => member.sprites),
    place,
    anchor: -left / wide,
    footprint: footprintAt(place, square.side),
    tall: Math.max(0.1, -top),
    wide,
    shown: ordered.some((member) => member.shown),
  };
}
