import { about, multiply } from './physics';
import type { DieState, Knock, Quat, ThrowPath } from './physics';

/**
 * A throw played back: where the die is at a moment between the frames that were worked out when it was let go, and
 * how it turns in the hand before it is. See `docs/plans/choice-roll-podium.md`, *The physics*.
 */

/** How the die is turned while it is held: slowly round, and rocking a little in the hand. */
export function heldTurn(since: number, now: number): Quat {
  const t = (now - since) / 1000;
  return multiply(
    about({ x: 0, y: 0, z: 1 }, t * 0.9),
    multiply(
      about({ x: 1, y: 0.4, z: 0 }, 0.5 + 0.12 * Math.sin(t * 2.3)),
      about({ x: 0, y: 1, z: 0 }, 0.35),
    ),
  );
}

/** Where the die is so many seconds into its throw, and whether the throw is over. */
export function between(path: ThrowPath, seconds: number): { state: DieState; done: boolean } {
  const last = path.frames.length - 1;
  const at = seconds / path.every;
  if (at >= last) return { state: path.frames[last]!, done: true };
  const i = Math.floor(at);
  const f = at - i;
  const a = path.frames[i]!;
  const b = path.frames[i + 1]!;
  const sign =
    a.turn.x * b.turn.x + a.turn.y * b.turn.y + a.turn.z * b.turn.z + a.turn.w * b.turn.w < 0 ? -1 : 1;
  const turn = {
    x: a.turn.x + (b.turn.x * sign - a.turn.x) * f,
    y: a.turn.y + (b.turn.y * sign - a.turn.y) * f,
    z: a.turn.z + (b.turn.z * sign - a.turn.z) * f,
    w: a.turn.w + (b.turn.w * sign - a.turn.w) * f,
  };
  const size = Math.hypot(turn.x, turn.y, turn.z, turn.w);
  return {
    state: {
      at: {
        x: a.at.x + (b.at.x - a.at.x) * f,
        y: a.at.y + (b.at.y - a.at.y) * f,
        z: a.at.z + (b.at.z - a.at.z) * f,
      },
      turn: { x: turn.x / size, y: turn.y / size, z: turn.z / size, w: turn.w / size },
    },
    done: false,
  };
}

/** How long a die is flattened after it strikes, in seconds. */
const SQUASH_S = 0.09;

/** How flat a die is this far into its time on the ground, from the knocks it took: the juice of a strike. */
export function squashAt(knocks: readonly Knock[], seconds: number): number {
  let squash = 0;
  for (const knock of knocks) {
    if (seconds >= knock.time && seconds < knock.time + SQUASH_S) {
      squash = Math.max(squash, Math.min(1, knock.speed / 30) * (1 - (seconds - knock.time) / SQUASH_S));
    }
  }
  return squash;
}
