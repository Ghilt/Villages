import { useCallback, useEffect, useRef, useState } from 'react';

import { SETTLED, playOf, settledAt } from './timing';
import type { Play } from './timing';

/**
 * A roll playing: where it stands now, redrawn about twenty times a second until it is settled and not after, and
 * the hurry. It starts again whenever `playing` changes to another roll, and a roll it is not told to play - `null`
 * - is drawn settled, as a page reloaded mid-roll draws it. See `timing.ts`.
 */
export function usePlay(
  playing: string | null,
  rows: number,
  cards: number,
): { play: Play; hurry: () => void } {
  const [began, setBegan] = useState<number | null>(null);
  const [hurriedAt, setHurriedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setHurriedAt(null);
    if (playing === null) {
      setBegan(null);
      return;
    }
    const start = performance.now();
    setBegan(start);
    setNow(start);
    tick.current = setInterval(() => setNow(performance.now()), 50);
    return () => {
      if (tick.current !== null) clearInterval(tick.current);
      tick.current = null;
    };
  }, [playing]);

  const elapsed = began === null ? null : now - began;
  const done = elapsed === null || elapsed >= settledAt(rows, cards, hurriedAt);

  useEffect(() => {
    if (done && tick.current !== null) {
      clearInterval(tick.current);
      tick.current = null;
    }
  }, [done]);

  const play = elapsed === null || done ? SETTLED : playOf(elapsed, rows, cards, hurriedAt);

  const hurry = useCallback(() => {
    if (began !== null && hurriedAt === null) setHurriedAt(performance.now() - began);
  }, [began, hurriedAt]);

  return { play, hurry };
}
