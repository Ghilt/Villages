import type { Sex } from '@villages/protocol';

/**
 * Where a portrait is drawn from, and which ones there are.
 *
 * The dev server serves `world/portraits/`, Adam's folder, without a cache, so a picture he saves over
 * another is the one drawn on the next reload. See `vite/portraitsApi.ts`: development only, until there
 * is a deployment to publish the portraits with.
 */

/** The picture a portrait's key names. */
export function portraitUrl(key: string): string {
  return `/portraits/${encodeURIComponent(key)}.png`;
}

/** Every portrait in the folder by its key, asked afresh each time so that a new one is found. */
export async function portraitsNow(): Promise<string[]> {
  const answer = await fetch('/portraits/', { cache: 'no-store' });
  if (!answer.ok) {
    throw new Error(`the portraits folder answered ${answer.status}`);
  }
  return ((await answer.json()) as { portraits: string[] }).portraits;
}

/** Whether a portrait suits someone of this sex, which its name says first: `woman-01`, `man-01`. */
export function suits(key: string, sex: Sex): boolean {
  return key.startsWith(`${sex}-`);
}

/**
 * Another portrait for somebody: one that suits them and is not the one they have, picked by `pick`, or
 * null when the folder holds no other. The server picks a newcomer's the same way, by what suits them.
 */
export function anotherPortrait(
  keys: readonly string[],
  sex: Sex,
  current: string | undefined,
  pick: (count: number) => number,
): string | null {
  const others = keys.filter((key) => suits(key, sex) && key !== current);
  return others.length === 0 ? null : others[pick(others.length)]!;
}
