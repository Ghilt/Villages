import { useCallback, useEffect, useRef, useState } from 'react';

import { nextPace, secondAt } from './replayClock';
import type { Pace } from './replayClock';

/**
 * A replay's clock, as whoever shows one holds it: the second shown, the furthest second played to, whether it plays,
 * and at what pace.
 */
export interface ReplayClock {
  readonly second: number;
  /** The furthest second played to: nothing past it has been seen, and the scrub reaches back over it alone. */
  readonly seen: number;
  readonly playing: boolean;
  readonly pace: Pace;
  play(): void;
  pause(): void;
  /** The next pace, round to the slowest again. */
  quicken(): void;
  /** Show a second already seen, and stop playing. */
  show(second: number): void;
  /** Show the last second, and with it everything not yet seen. */
  toEnd(): void;
}

/** Where a replay's clock starts, and whether it plays by itself. */
export interface ClockStart {
  /** The second it shows first. */
  readonly start?: number;
  /** The second it plays from at the beginning and again from the last: before the first, for a moment of approach. */
  readonly first?: number;
  /** Milliseconds after it is first shown that it begins playing by itself; left out, it waits to be played. */
  readonly autoplay?: number;
}

/**
 * The clock of a replay to its `last` second: playing counts a second on at each step of its pace and stops at the
 * last; played again at the last, it starts from `first`. It remembers the furthest second played to, so a replay
 * watched for the first time shows nothing past it, and the scrub reaches back over what has been seen; to the end
 * shows the rest. Counted from when it began rather than ticked, so a slow frame does not slow it.
 */
export function useReplayClock(
  last: number,
  { start = 0, first = start, autoplay }: ClockStart = {},
): ReplayClock {
  const [second, setSecond] = useState(start);
  const [seen, setSeen] = useState(Math.max(0, start));
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
      setSeen((furthest) => Math.max(furthest, now));
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

  useEffect(() => {
    if (autoplay === undefined) {
      return undefined;
    }
    const wait = setTimeout(() => setPlaying(true), autoplay);
    return () => clearTimeout(wait);
  }, [autoplay]);

  const play = useCallback(() => {
    setSecond((now) => (now >= last ? first : now));
    setPlaying(true);
  }, [last, first]);
  const pause = useCallback(() => setPlaying(false), []);
  const quicken = useCallback(() => setPace((now) => nextPace(now)), []);
  const show = useCallback(
    (at: number) => {
      setPlaying(false);
      setSecond(Math.max(0, Math.min(seen, at)));
    },
    [seen],
  );
  const toEnd = useCallback(() => {
    setPlaying(false);
    setSeen(last);
    setSecond(last);
  }, [last]);
  return { second, seen, playing, pace, play, pause, quicken, show, toEnd };
}
