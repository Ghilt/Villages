/**
 * How the hand that held the die was moving as it let go, from where the pointer was over the last moments: a flick
 * throws the die, a hand held still drops it. One gesture with no modes, told apart by speed alone. See
 * `docs/plans/choice-roll-podium.md`, *Picked up, aimed and let go*.
 */

/** Where the pointer was, in pixels, and when, in milliseconds. */
export interface Sample {
  readonly t: number;
  readonly x: number;
  readonly y: number;
}

/** How far back a flick is read: long enough to smooth a shaking hand, short enough to be the flick and not the aim. */
export const WINDOW_MS = 90;
/** A pointer that has not moved for this long before letting go was held still. */
export const STILL_MS = 60;

/** The samples still worth keeping, a little more than the window. */
export function kept(samples: readonly Sample[], now: number): Sample[] {
  return samples.filter((sample) => now - sample.t <= WINDOW_MS * 2);
}

/**
 * How fast the pointer was moving as it let go, in pixels a second: the straight line that best fits the last
 * samples, so one jittery sample does not decide a throw. Nought when it was held still, or there is too little to go on.
 */
export function speedAtRelease(samples: readonly Sample[], now: number): { x: number; y: number } {
  const last = samples[samples.length - 1];
  if (last === undefined || now - last.t > STILL_MS) return { x: 0, y: 0 };
  const recent = samples.filter((sample) => now - sample.t <= WINDOW_MS);
  if (recent.length < 2) return { x: 0, y: 0 };
  const meanT = recent.reduce((sum, s) => sum + s.t, 0) / recent.length;
  const meanX = recent.reduce((sum, s) => sum + s.x, 0) / recent.length;
  const meanY = recent.reduce((sum, s) => sum + s.y, 0) / recent.length;
  const spread = recent.reduce((sum, s) => sum + (s.t - meanT) ** 2, 0);
  if (spread === 0) return { x: 0, y: 0 };
  const slopeX = recent.reduce((sum, s) => sum + (s.t - meanT) * (s.x - meanX), 0) / spread;
  const slopeY = recent.reduce((sum, s) => sum + (s.t - meanT) * (s.y - meanY), 0) / spread;
  return { x: slopeX * 1000, y: slopeY * 1000 };
}

/** Whether letting go at this speed throws the die rather than dropping it. */
export function isThrow(speed: { x: number; y: number }, throwsFrom: number): boolean {
  return Math.hypot(speed.x, speed.y) >= throwsFrom;
}
