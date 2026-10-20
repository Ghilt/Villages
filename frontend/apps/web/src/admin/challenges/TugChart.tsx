import { useState } from 'react';

import type { ProgressionView } from '@villages/protocol';

import { startsOf, towardSaid } from './setup';

const WIDTH = 640;
const HEIGHT = 200;
const LEFT = 44;
const RIGHT = 12;
const TOP = 22;
const BOTTOM = 26;

/**
 * The tug over a challenge, second by second: side A's way up, a dashed line at the middle, the two ends, and a faint
 * mark where each happening begins with its aspects over it. One series, so the title names it and there is no legend;
 * hovering a second shows where the tug stood at its end. Kept plain, so the line is what is read.
 */
export function TugChart({
  tugs,
  progression,
  ends,
}: {
  tugs: readonly number[];
  progression: ProgressionView;
  ends: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const across = WIDTH - LEFT - RIGHT;
  const down = HEIGHT - TOP - BOTTOM;
  const x = (second: number) =>
    LEFT + (progression.seconds <= 1 ? across / 2 : (second / (progression.seconds - 1)) * across);
  const y = (tug: number) => TOP + down / 2 - (tug / ends) * (down / 2);
  const line = tugs
    .map((tug, second) => `${second === 0 ? 'M' : 'L'}${x(second).toFixed(1)},${y(tug).toFixed(1)}`)
    .join(' ');
  const starts = startsOf(progression);
  const column = across / Math.max(1, progression.seconds - 1);

  return (
    <figure className="challenges-chart">
      <figcaption className="inspect-group__subtitle">the tug, second by second</figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="the tug over the challenge, side A up">
        {[ends, 0, -ends].map((tug) => (
          <g key={tug}>
            <line
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={y(tug)}
              y2={y(tug)}
              className={tug === 0 ? 'challenges-chart__middle' : 'challenges-chart__grid'}
            />
            <text x={LEFT - 6} y={y(tug) + 4} className="challenges-chart__axis" textAnchor="end">
              {tug === 0 ? 'even' : tug > 0 ? `A ${tug}` : `B ${-tug}`}
            </text>
          </g>
        ))}
        {starts.map((start, at) => (
          <g key={at}>
            <line
              x1={x(start)}
              x2={x(start)}
              y1={TOP}
              y2={HEIGHT - BOTTOM}
              className="challenges-chart__grid"
            />
            <text x={x(start) + 3} y={TOP - 8} className="challenges-chart__axis">
              {progression.happenings[at]!.join(' & ')}
            </text>
          </g>
        ))}
        <path d={line} className="challenges-chart__line" />
        {hover !== null && tugs[hover] !== undefined && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={TOP}
              y2={HEIGHT - BOTTOM}
              className="challenges-chart__crosshair"
            />
            <circle cx={x(hover)} cy={y(tugs[hover]!)} r={4} className="challenges-chart__point" />
          </g>
        )}
        {tugs.map((_, second) => (
          <rect
            key={second}
            x={x(second) - column / 2}
            y={TOP}
            width={column}
            height={down}
            fill="transparent"
            onMouseEnter={() => setHover(second)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x={LEFT} y={HEIGHT - 6} className="challenges-chart__axis">
          second 0
        </text>
        <text x={WIDTH - RIGHT} y={HEIGHT - 6} className="challenges-chart__axis" textAnchor="end">
          {progression.seconds - 1}
        </text>
      </svg>
      <p className="inspect-note challenges-chart__said">
        {hover !== null && tugs[hover] !== undefined
          ? `second ${hover}: ${towardSaid(tugs[hover]!)}`
          : 'point at a second to read the tug at its end'}
      </p>
    </figure>
  );
}
