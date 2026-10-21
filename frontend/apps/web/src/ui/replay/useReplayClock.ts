import { useCallback, useEffect, useRef, useState } from 'react';

import { nextPace, secondAt } from './replayClock';
import type { Pace } from './replayClock';

/** A replay's clock, as whoever shows one holds it: the second shown, whether it plays, and at what pace. */
export interface ReplayClock {
  readonly second: number;
  readonly playing: boolean;
  readonly pace: Pace;
  play(): void;
  pause(): void;
  /** The next pace, round to the slowest again. */
  quicken(): void;
  /** Show a second, and stop playing. */
  show(second: number): void;
}

/**
 * The clock of a replay `last` seconds long, starting at `start`: playing counts a second on at each step of its pace
 * and stops at the last; played again at the last, it starts from the first. Counted from when it began rather than
 * ticked, so a slow frame does not slow it.
 */
export function useReplayClock(last: number, start = 0): ReplayClock {
  const [second, setSecond] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [pace, setPace] = useState<Pace>(1);
  const began = useRef<{ at: number; from: number } | null>(null);

  useEffect(() => {
    if (!playing) {
      began.current = null;
      return undefined;
    }
    began.current = { at: performance.now(), from: second };
    let frame = 0;
    const step = () => {
      const from = began.current;
      if (from === null) {
        return;
      }
      const now = secondAt(from.from, performance.now() - from.at, pace, last);
      setSecond(now);
      if (now >= last) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // The second it began from is read once, as it starts or changes pace; counting on it is the loop's own.
  }, [playing, pace, last]);

  const play = useCallback(() => {
    setSecond((now) => (now >= last ? 0 : now));
    setPlaying(true);
  }, [last]);
  const pause = useCallback(() => setPlaying(false), []);
  const quicken = useCallback(() => setPace((now) => nextPace(now)), []);
  const show = useCallback(
    (at: number) => {
      setPlaying(false);
      setSecond(Math.max(0, Math.min(last, at)));
    },
    [last],
  );
  return { second, playing, pace, play, pause, quicken, show };
}
