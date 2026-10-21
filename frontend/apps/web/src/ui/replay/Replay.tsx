import './replay.css';

import type { CSSProperties } from 'react';

import { MarkButton } from '../button/Button';
import { Container } from '../container/Container';
import { linePoints, scrubbedTo, shareAlong } from './replayClock';
import type { Pace } from './replayClock';

/** A stretch of the replay a happening runs, from its first second to the next's, and the colours of its aspects. */
export interface Band {
  readonly from: number;
  readonly to: number;
  readonly name: string;
  readonly colours: readonly string[];
}

/** A second worth marking along the replay: something arrived, or fell. */
export interface Tick {
  readonly second: number;
  readonly kind: 'arrived' | 'fell';
  readonly said: string;
}

const PACE_MARKS = { 1: 'pace-1', 2: 'pace-2', 3: 'pace-3' } as const;
const LINE_WIDTH = 600;
const LINE_HEIGHT = 24;

/** A band's fill: its aspects' colours, half seen, run across it. */
function bandFill(colours: readonly string[]): string {
  const mixed = colours.map((colour) => `color-mix(in srgb, ${colour} 55%, transparent)`);
  return `linear-gradient(90deg, ${(mixed.length === 1 ? [mixed[0], mixed[0]] : mixed).join(', ')})`;
}

/**
 * A challenge's replay: play and pause, its pace and to the end, every one a mark; the happenings as bands along it
 * with the tug drawn over them, the first side's end at the top; a tick where something arrived or fell; and the scrub,
 * which goes to any second and which the arrow keys step a second at a time. Held by whoever shows it, as
 * `useReplayClock` holds a replay. In the `bar.replay` recipe. See docs/UI-COMPONENTS.md and decision record 0116.
 */
export function ReplayBar({
  second,
  last,
  playing,
  pace,
  onPlay,
  onPause,
  onQuicken,
  onShow,
  bands,
  tug,
  ticks = [],
}: {
  second: number;
  /** The last second of the challenge. */
  last: number;
  playing: boolean;
  pace: Pace;
  onPlay: () => void;
  onPause: () => void;
  onQuicken: () => void;
  /** Show a second: a scrub let go, or to the end. */
  onShow: (second: number) => void;
  bands: readonly Band[];
  /** The tug at the end of each second, from the first. */
  tug: readonly number[];
  ticks?: readonly Tick[];
}) {
  const along = shareAlong(second, last);
  return (
    <Container recipe="bar.replay" className="ui-replay">
      <div className="ui-replay__row">
        {playing ? (
          <MarkButton label="Pause" mark="pause" onClick={onPause} />
        ) : (
          <MarkButton label={second >= last ? 'Play again' : 'Play'} mark="play" onClick={onPlay} />
        )}
        <MarkButton label={`Pace ${pace} of 3: quicker`} mark={PACE_MARKS[pace]} onClick={onQuicken} />
        <div className="ui-replay__track" style={{ '--ui-replay-along': `${along}%` } as CSSProperties}>
          <svg
            className="ui-replay__line"
            viewBox={`0 0 ${LINE_WIDTH} ${LINE_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              x1="0"
              y1={LINE_HEIGHT / 2}
              x2={LINE_WIDTH}
              y2={LINE_HEIGHT / 2}
              className="ui-replay__even"
            />
            <polyline points={linePoints(tug, LINE_WIDTH, LINE_HEIGHT)} className="ui-replay__tug" />
          </svg>
          {ticks.map((tick) => (
            <span
              key={`${tick.second}-${tick.kind}-${tick.said}`}
              className={`ui-replay__tick ui-replay__tick--${tick.kind}`}
              style={{ left: `${shareAlong(tick.second, last)}%` }}
              title={`${tick.second} s: ${tick.said}`}
            />
          ))}
          <div className="ui-replay__bands" aria-hidden="true">
            {bands.map((band) => (
              <span
                key={`${band.from}-${band.name}`}
                className="ui-replay__band"
                style={{
                  left: `${shareAlong(band.from, last)}%`,
                  width: `${shareAlong(band.to, last) - shareAlong(band.from, last)}%`,
                  background: bandFill(band.colours),
                }}
              >
                {band.name}
              </span>
            ))}
          </div>
          <span className="ui-replay__head" aria-hidden="true" />
          <input
            className="ui-replay__scrub"
            type="range"
            min={0}
            max={last}
            step={1}
            value={second}
            onChange={(event) => onShow(scrubbedTo(Number(event.target.value), last))}
            aria-label="The second shown"
            aria-valuetext={`second ${second} of ${last}`}
          />
        </div>
        <span className="ui-replay__time ui-numeral">
          <span className="ui-replay__second">{second} s</span>
          <span className="ui-replay__of">of {last}</span>
        </span>
        <MarkButton label="To the end" mark="to-end" onClick={() => onShow(last)} disabled={second >= last} />
      </div>
    </Container>
  );
}
