/**
 * A tab bar's arithmetic: how tall its tabs are, and where the arrow keys take the keyboard along them.
 * Pure, so that a tab the keys skip is a test. See docs/UI-COMPONENTS.md.
 */

/**
 * How tall a tab is drawn, by the size it is asked for, in pixels. Small is the game's own strip, which a
 * bay is laid out `TAB_BAR` taller for (decision record 0042), so the two cannot disagree by a pixel.
 */
export const TAB_HEIGHTS = { small: 30, regular: 40 } as const;
export type TabSize = keyof typeof TAB_HEIGHTS;

/**
 * The tab the keyboard moves to from the one it is on, for the key pressed, or null for a key that is not
 * a tab bar's. The arrows go to the next tab that can be chosen either way, coming round at the ends;
 * Home and End go to the first and the last. A disabled tab is passed over, as it cannot be chosen.
 */
export function stepTo(from: number, key: string, enabled: readonly boolean[]): number | null {
  const count = enabled.length;
  const open = (at: number) => enabled[at] === true;
  const walk = (start: number, by: number): number | null => {
    for (let step = 0; step < count; step += 1) {
      const at = (((start + by * step) % count) + count) % count;
      if (open(at)) {
        return at;
      }
    }
    return null;
  };
  switch (key) {
    case 'ArrowRight':
      return walk(from + 1, 1);
    case 'ArrowLeft':
      return walk(from - 1, -1);
    case 'Home':
      return walk(0, 1);
    case 'End':
      return walk(count - 1, -1);
    default:
      return null;
  }
}
