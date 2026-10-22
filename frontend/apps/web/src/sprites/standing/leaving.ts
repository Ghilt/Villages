/**
 * Takes every one of `gone` out of `list` in one pass, keeping the rest in their order, and changes the list in place
 * so whatever holds it sees the change. Taken out one at a time, each searched the whole list for itself: ten thousand
 * trees leaving took 80 ms (2026-10-22, `docs/plans/smooth-crossing-into-the-real-world.md`).
 */
export function removeAll<T>(list: T[], gone: ReadonlySet<T>): void {
  if (gone.size === 0) return;
  let kept = 0;
  for (const one of list) {
    if (!gone.has(one)) list[kept++] = one;
  }
  list.length = kept;
}
