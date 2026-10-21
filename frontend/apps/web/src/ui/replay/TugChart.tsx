import './replay.css';

import { linePoints, shareAlong } from './replayClock';

const WIDTH = 600;
const HEIGHT = 160;

/**
 * The tug of a challenge second by second, larger than the replay draws it: the first side's end at the top and the
 * other's at the bottom, each named in its colour, even through the middle, and a hairline at the second shown. What
 * a challenge's history opens with. See docs/UI-COMPONENTS.md and decision record 0116.
 */
export function TugChart({
  tug,
  second,
  first,
  other,
}: {
  /** The tug at the end of each second, from the first. */
  tug: readonly number[];
  second: number;
  first: { readonly name: string; readonly colour: string };
  other: { readonly name: string; readonly colour: string };
}) {
  const last = Math.max(0, tug.length - 1);
  return (
    <figure className="ui-tug-chart" aria-label={`The tug second by second, second ${second} marked`}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1={HEIGHT / 2} x2={WIDTH} y2={HEIGHT / 2} className="ui-replay__even" />
        <polyline points={linePoints(tug, WIDTH, HEIGHT)} className="ui-replay__tug" />
      </svg>
      <span className="ui-tug-chart__at" style={{ left: `${shareAlong(second, last)}%` }} />
      <span className="ui-tug-chart__end ui-tug-chart__end--first" style={{ color: first.colour }}>
        {first.name}
      </span>
      <span className="ui-tug-chart__end ui-tug-chart__end--other" style={{ color: other.colour }}>
        {other.name}
      </span>
    </figure>
  );
}
