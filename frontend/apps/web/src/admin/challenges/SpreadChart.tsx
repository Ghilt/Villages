import { useState } from 'react';

import type { ProgressionView } from '@villages/protocol';

import { numberSaid, startsOf } from './setup';

/** How the runs of a batch spread, as the server sums them: a count per band for every second, and where each ended. */
export interface Spread {
  readonly runs: number;
  readonly tugEnds: number;
  readonly spread: readonly (readonly number[])[];
  readonly ends: readonly number[];
}

/** The bands of the tug, bottom to top: pulled to B's end, twenty between the ends, pulled to A's end. */
const ROWS = 22;
const BANDS = 20;

/**
 * The classes a cell is coloured by: the share of the runs standing then that stood in its band, each class a step of
 * one blue ramp, light to dark - the reference palette's sequential hue, and seven steps of it a legend can name.
 */
export const CLASSES: readonly { readonly upTo: number; readonly colour: string; readonly said: string }[] = [
  { upTo: 0.02, colour: '#cde2fb', said: 'under 2%' },
  { upTo: 0.05, colour: '#9ec5f4', said: '2 to 5%' },
  { upTo: 0.1, colour: '#6da7ec', said: '5 to 10%' },
  { upTo: 0.2, colour: '#3987e5', said: '10 to 20%' },
  { upTo: 0.4, colour: '#256abf', said: '20 to 40%' },
  { upTo: 0.7, colour: '#184f95', said: '40 to 70%' },
  { upTo: 1, colour: '#0d366b', said: 'over 70%' },
];

/** The colour of a share of the runs: its class's step of the ramp. */
export const colourOf = (share: number) =>
  (CLASSES.find((one) => share <= one.upTo) ?? CLASSES.at(-1)!).colour;

const WIDTH = 760;
const HEIGHT = 300;
const LEFT = 64;
const MAIN_RIGHT = 640;
const MARGIN_LEFT = 656;
const MARGIN_WIDTH = 92;
const TOP = 24;
const BOTTOM = 26;
/** The gap that sets each end's row apart from the bands between. */
const GAP = 4;

/** What a band of the tug is, in words: `pulled to A's end`, `between 20 and 30 toward A`. */
export function bandSaid(row: number, tugEnds: number): string {
  if (row === 0) return "pulled to B's end";
  if (row === ROWS - 1) return "pulled to A's end";
  const width = (2 * tugEnds) / BANDS;
  const low = -tugEnds + (row - 1) * width;
  const high = low + width;
  return high <= 0
    ? `between ${numberSaid(-high)} and ${numberSaid(-low)} toward B`
    : `between ${numberSaid(low)} and ${numberSaid(high)} toward A`;
}

/**
 * Every run of a batch at once, as a heatmap - a density of lines, the way many runs of a simulation are drawn when a
 * line apiece would be a tangle and a median band would sit where few runs are: a column a second, a row a band of the
 * tug, side A up, each cell as dark as the share of the runs standing then that stood in that band. The two ends are
 * rows of their own, set apart, so the runs pulled there pile up where they can be seen. Beside it, where the runs
 * ended; over it, the seed's own run as a line. Hovering a cell or a bar says what it holds.
 */
export function SpreadChart({
  batch,
  seedTugs,
  progression,
  happenings,
}: {
  batch: Spread;
  seedTugs: readonly number[];
  progression: ProgressionView;
  /** Whether every run had this progression, so its happenings can be marked: not when each drew its own. */
  happenings: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const { spread, ends, runs, tugEnds } = batch;
  const columns = Math.max(1, spread.length);
  const band = (HEIGHT - TOP - BOTTOM - 2 * GAP) / ROWS;
  const top = (row: number) =>
    TOP + (ROWS - 1 - row) * band + (row < ROWS - 1 ? GAP : 0) + (row === 0 ? GAP : 0);
  const cell = (MAIN_RIGHT - LEFT) / columns;
  const x = (second: number) => LEFT + second * cell;
  const inside = { top: top(BANDS), bottom: top(1) + band };
  const y = (tug: number) => {
    if (tug >= tugEnds) return top(ROWS - 1) + band / 2;
    if (tug <= -tugEnds) return top(0) + band / 2;
    return inside.top + ((tugEnds - tug) / (2 * tugEnds)) * (inside.bottom - inside.top);
  };
  const line = seedTugs
    .map(
      (tug, second) => `${second === 0 ? 'M' : 'L'}${(x(second) + cell / 2).toFixed(1)},${y(tug).toFixed(1)}`,
    )
    .join(' ');
  const most = Math.max(1, ...ends);

  return (
    <figure className="challenges-chart challenges-spread">
      <figcaption className="inspect-group__subtitle">
        where the {runs} runs stood, second by second, and where they ended
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`a heatmap of where the tug stood in each of ${runs} runs, side A up`}
      >
        {spread.map((counts, second) => {
          const standing = counts.reduce((sum, count) => sum + count, 0);
          return counts.map((count, row) =>
            count === 0 ? null : (
              <rect
                key={`${second}-${row}`}
                x={x(second)}
                y={top(row)}
                width={cell}
                height={band}
                fill={colourOf(count / standing)}
                onMouseEnter={() =>
                  setHover(
                    `second ${second}, ${bandSaid(row, tugEnds)}: ${count} of the ${standing} runs standing then (${Math.round((100 * count) / standing)}%)`,
                  )
                }
                onMouseLeave={() => setHover(null)}
              />
            ),
          );
        })}
        <line x1={LEFT} x2={MAIN_RIGHT} y1={y(0)} y2={y(0)} className="challenges-chart__middle" />
        {[
          [ROWS - 1, "A's end"],
          [0, "B's end"],
        ].map(([row, words]) => (
          <text
            key={row}
            x={LEFT - 6}
            y={top(row as number) + band / 2 + 4}
            className="challenges-chart__axis"
            textAnchor="end"
          >
            {words}
          </text>
        ))}
        {[tugEnds / 2, 0, -tugEnds / 2].map((tug) => (
          <text key={tug} x={LEFT - 6} y={y(tug) + 4} className="challenges-chart__axis" textAnchor="end">
            {tug === 0 ? 'even' : tug > 0 ? `A ${numberSaid(tug)}` : `B ${numberSaid(-tug)}`}
          </text>
        ))}
        {happenings &&
          startsOf(progression).map((start, at) => (
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
        <path d={line} className="challenges-spread__halo" />
        <path d={line} className="challenges-chart__line" />
        <text x={MARGIN_LEFT} y={TOP - 8} className="challenges-chart__axis">
          ended
        </text>
        {ends.map((count, row) =>
          count === 0 ? null : (
            <rect
              key={row}
              x={MARGIN_LEFT}
              y={top(row) + 1}
              width={Math.max(2, (count / most) * MARGIN_WIDTH)}
              height={Math.max(1, band - 2)}
              rx={2}
              className="challenges-spread__ended"
              onMouseEnter={() =>
                setHover(
                  `ended ${bandSaid(row, tugEnds)}: ${count} of ${runs} runs (${Math.round((100 * count) / runs)}%)`,
                )
              }
              onMouseLeave={() => setHover(null)}
            />
          ),
        )}
        <text x={LEFT} y={HEIGHT - 6} className="challenges-chart__axis">
          second 0
        </text>
        <text x={MAIN_RIGHT} y={HEIGHT - 6} className="challenges-chart__axis" textAnchor="end">
          {columns - 1}
        </text>
      </svg>
      <div className="challenges-spread__legend inspect-each">
        <span className="inspect-key">share of the runs standing then</span>
        {CLASSES.map((one) => (
          <span key={one.said} className="challenges-spread__class">
            <span className="challenges-spread__swatch" style={{ background: one.colour }} /> {one.said}
          </span>
        ))}
        <span className="challenges-spread__class">
          <span className="challenges-spread__seed" /> the seed&apos;s run
        </span>
      </div>
      <p className="inspect-note challenges-chart__said">
        {hover ?? 'point at a cell, or at a bar of where they ended, to read what it holds'}
      </p>
    </figure>
  );
}
