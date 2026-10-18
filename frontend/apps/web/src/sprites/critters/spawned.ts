import { CASTS, RUINS_CAST } from './casts';
import type { CastMember } from './casts';
import { coverNear, critterHash, openAnimals } from './critterClock';
import { flockOf } from './flush';
import { hopper, waterNear } from './hop';
import { CRITTERS_LOOK } from './look';
import { slitherer } from './slither';
import { soarersOf } from './soar';
import type { CritterEvent, Ground, SpawnAsk } from './types';

const L = CRITTERS_LOOK;
const F = L.flush;

/** The first member of any cast that is of this kind: how it moves and what it comes out of. */
function memberNamed(kind: string): CastMember | null {
  return [...Object.values(CASTS).flat(), ...RUINS_CAST].find((member) => member.kind === kind) ?? null;
}

/**
 * A critter put where a click asked for one (`critterSpawn.ts`), beginning at `seconds`: what the world would bring
 * there, made up from the ground there and seen or not - a flock bursting out of the tree or bush nearest the click, a
 * squirrel or a hare bounding from the cover of its own nearest the click to more near it, a fish leaping from the
 * water clicked, a hawk or gulls circling over the open ground or the sea clicked, a covey or a lark bursting up off the open
 * ground clicked, dolphins leaping or a whale blowing out of the sea clicked; a frog from the reeds or the grass nearest the click
 * into the water beside them, or to the next tuft with no water near, and a snake gliding from them to the next; out
 * of the piece of the ruins nearest the click, crows bursting out or circling over it, or a rat scurrying to the next. Null while the ground there is not yet known; in a few
 * words why not, when nothing of its kind could come there.
 */
export function spawnedAt(ask: SpawnAsk, seconds: number, ground: Ground): CritterEvent | string | null {
  const member = memberNamed(ask.kind);
  if (member === null) return `no ground has ${ask.kind}s`;
  const anywhere: Ground = { ...ground, sees: () => true };
  const draw = (salt: number) => critterHash(ask.id, 0x5eed, Math.floor(ask.at), salt);
  const key = `spawn/${ask.id}`;
  const event = { key, kind: member.kind, behaviour: member.behaviour, startsAt: seconds };
  if (member.from.length === 0) {
    const open = ground.classAt(ask.x, ask.y);
    if (open === null) return null;
    if (!CASTS[open]?.some((one) => one.kind === member.kind)) {
      return member.behaviour === 'leap'
        ? `a ${ask.kind} leaps only from water it lives in`
        : member.behaviour === 'soar'
          ? `a ${ask.kind} circles only over the open ground it lives over`
          : `a ${ask.kind} comes only out of the open ground it lives on`;
    }
    const from = { x: ask.x, y: ask.y, kind: open, height: 0 };
    const animals = openAnimals(member, from, draw, anywhere);
    return animals.length === 0 ? 'nowhere near on the same ground to run to' : { ...event, from, animals };
  }
  const reach = 4;
  const around = ground.coverIn(ask.x - reach, ask.y - reach, ask.x + reach, ask.y + reach);
  if (around === null) return null;
  const from = around
    .filter((one) => member.from.includes(one.kind))
    .sort(
      (one, other) => Math.hypot(one.x - ask.x, one.y - ask.y) - Math.hypot(other.x - ask.x, other.y - ask.y),
    )[0];
  if (from === undefined) return `nothing it comes out of within ${reach} world units of the click`;
  if (member.behaviour === 'soar') return { ...event, from, animals: soarersOf(member.kind, draw) };
  const shore = L.hop[member.kind]?.water;
  const water = shore === undefined ? null : waterNear(from, ground, shore);
  const range =
    member.behaviour === 'hop'
      ? (L.hop[member.kind]?.reach ?? [0, 0])
      : member.behaviour === 'slither'
        ? L.slither.reach
        : F.shelter;
  const near = water !== null ? [water] : coverNear(from, member.from, anywhere, range);
  if (near === null) return null;
  if (member.behaviour === 'hop' || member.behaviour === 'slither') {
    const animal =
      member.behaviour === 'hop' ? hopper(member.kind, from, near, draw) : slitherer(from, near, draw);
    return animal === null ? 'no cover near enough to run to' : { ...event, from, animals: [animal] };
  }
  return { ...event, from, animals: flockOf(from, near, false, draw, L.kinds[member.kind]?.together) };
}
