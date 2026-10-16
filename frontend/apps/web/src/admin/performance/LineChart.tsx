import { useState } from 'react';

/** One line: its name, as the legend and the tooltip say it, its colour, and a value at each point of the x axis. */
export interface Series {
  readonly name: string;
  readonly colour: string;
  readonly values: readonly (number | null)[];
}

const WIDTH = 640;
const HEIGHT = 240;
const LEFT = 52;
const RIGHT = 16;
const TOP = 26;
const BOTTOM = 34;

/** A round step for the y axis that gives about four lines across the height. */
function step(most: number): number {
  const rough = most / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((each) => each >= rough) ?? rough;
}

/**
 * A line chart on the paper of an inspect page: points evenly along the x axis, each named by `labels`, one or more
 * series over them, and a dashed line for a threshold. Hovering anywhere over a point's column shows every series'
 * value there. Kept plain on purpose - a recessive grid, two-pixel lines, eight-pixel points - so that the numbers
 * and not the drawing are what is read.
 */
export function LineChart({
  labels,
  series,
  unit,
  threshold,
  label,
}: {
  labels: readonly string[];
  series: readonly Series[];
  unit: string;
  threshold?: { readonly value: number; readonly words: string };
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = series.flatMap((each) => each.values.filter((value): value is number => value !== null));
  const most = Math.max(1, threshold?.value ?? 0, ...values);
  const by = step(most * 1.1);
  const top = Math.ceil((most * 1.05) / by) * by;
  const across = WIDTH - LEFT - RIGHT;
  const down = HEIGHT - TOP - BOTTOM;
  const x = (index: number) =>
    LEFT + (labels.length === 1 ? across / 2 : (index / (labels.length - 1)) * across);
  const y = (value: number) => TOP + down - (value / top) * down;
  const ticks = Array.from({ length: Math.round(top / by) + 1 }, (_, index) => index * by);
  const column = labels.length <= 1 ? across : across / (labels.length - 1);

  return (
    <figure className="perf-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={label}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="perf-chart__grid" x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick)} y2={y(tick)} />
            <text className="perf-chart__tick" x={LEFT - 6} y={y(tick)} dy="0.32em" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        <text className="perf-chart__unit" x={LEFT - 6} y={10} textAnchor="end">
          {unit}
        </text>
        {labels.map((words, index) => (
          <text
            key={words}
            className="perf-chart__tick"
            x={x(index)}
            y={HEIGHT - BOTTOM + 18}
            textAnchor="middle"
          >
            {words}
          </text>
        ))}
        {threshold !== undefined && (
          <g>
            <line
              className="perf-chart__threshold"
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={y(threshold.value)}
              y2={y(threshold.value)}
            />
            <text className="perf-chart__tick" x={WIDTH - RIGHT} y={y(threshold.value) - 5} textAnchor="end">
              {threshold.words}
            </text>
          </g>
        )}
        {hover !== null && (
          <line className="perf-chart__cross" x1={x(hover)} x2={x(hover)} y1={TOP} y2={TOP + down} />
        )}
        {series.map((each) => {
          const points = each.values.flatMap((value, index) =>
            value === null ? [] : [[x(index), y(value)] as const],
          );
          return (
            <g key={each.name}>
              {points.length > 1 && (
                <polyline
                  className="perf-chart__line"
                  stroke={each.colour}
                  points={points.map(([px, py]) => `${px},${py}`).join(' ')}
                />
              )}
              {points.map(([px, py]) => (
                <circle key={px} className="perf-chart__point" cx={px} cy={py} r={4} fill={each.colour} />
              ))}
            </g>
          );
        })}
        {labels.map((words, index) => (
          <rect
            key={words}
            className="perf-chart__hit"
            x={x(index) - column / 2}
            y={TOP}
            width={column}
            height={down}
            onMouseEnter={() => setHover(index)}
          />
        ))}
      </svg>
      {series.length > 1 && (
        <figcaption className="perf-chart__legend">
          {series.map((each) => (
            <span key={each.name}>
              <i style={{ background: each.colour }} /> {each.name}
            </span>
          ))}
        </figcaption>
      )}
      {hover !== null && (
        <div className="perf-chart__tip" style={{ left: `${(x(hover) / WIDTH) * 100}%` }}>
          <strong>{labels[hover]}</strong>
          {series.map((each) => (
            <span key={each.name}>
              {series.length > 1 && <i style={{ background: each.colour }} />} {each.name}{' '}
              {each.values[hover] === null ? '-' : `${each.values[hover]} ${unit}`}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
