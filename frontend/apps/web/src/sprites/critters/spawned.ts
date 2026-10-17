import { CASTS } from './casts';
import type { CastMember } from './casts';
import { coverNear, critterHash, flockOf } from './critterClock';
import { hopper } from './hop';
import { leaper } from './leap';
import { CRITTERS_LOOK } from './look';
import type { CritterEvent, Ground, SpawnAsk } from './types';

const L = CRITTERS_LOOK;
const F = L.flush;

/** The first member of any cast that is of this kind: how it moves and what it comes out of. */
function memberNamed(kind: string): CastMember | null {
  return (
    Object.values(CASTS)
      .flat()
      .find((member) => member.kind === kind) ?? null
  );
}

/**
 * A critter put where a click asked for one (`critterSpawn.ts`), beginning at `seconds`: what the world would bring
 * there, made up from the ground there and seen or not - a flock bursting out of the tree or bush nearest the click, a
 * squirrel or a hare bounding from the cover of its own nearest the click to more near it, a fish leaping from the
 * water clicked. Null while the ground there is not yet known; in a few words why not, when nothing of its kind could
 * come there.
 */
export function spawnedAt(ask: SpawnAsk, seconds: number, ground: Ground): CritterEvent | string | null {
  const member = memberNamed(ask.kind);
  if (member === null) return `no ground has ${ask.kind}s`;
  const anywhere: Ground = { ...ground, sees: () => true };
  const draw = (salt: number) => critterHash(ask.id, 0x5eed, Math.floor(ask.at), salt);
  const key = `spawn/${ask.id}`;
  const event = { key, kind: member.kind, behaviour: member.behaviour, startsAt: seconds };
  if (member.behaviour === 'leap') {
    const water = ground.classAt(ask.x, ask.y);
    if (water === null) return null;
    if (!CASTS[water]?.some((one) => one.kind === member.kind))
      return `a ${ask.kind} leaps only from water it lives in`;
    return { ...event, from: { x: ask.x, y: ask.y, kind: water, height: 0 }, animals: [leaper(draw)] };
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
  const near = coverNear(
    from,
    member.from,
    anywhere,
    member.behaviour === 'hop' ? (L.hop[member.kind]?.reach ?? [0, 0]) : F.shelter,
  );
  if (near === null) return null;
  if (member.behaviour === 'hop') {
    const animal = hopper(member.kind, from, near, draw);
    return animal === null ? 'no cover near enough to run to' : { ...event, from, animals: [animal] };
  }
  return { ...event, from, animals: flockOf(from, near, false, draw) };
}
