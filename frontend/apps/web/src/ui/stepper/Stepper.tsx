import './stepper.css';

import { MarkButton } from '../button/Button';
import type { ButtonSize } from '../button/face';
import { stepped } from '../slider/range';

/**
 * A stepper: a count with a mark either side of it, one less and one more, as a key figure's stats are
 * moved. A button that would take it past either end is disabled there, so the end is seen rather than
 * found by pressing. The count is said again to a screen reader when it changes, and is as wide as its
 * widest so that it does not jump as it counts. See docs/UI-COMPONENTS.md.
 */
export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  less = 'One less',
  more = 'One more',
  size = 'small',
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** What it counts, for a screen reader: Piety. */
  label: string;
  /** What its two buttons do, in words, for their tooltips and a screen reader. */
  less?: string;
  more?: string;
  size?: ButtonSize;
}) {
  const down = stepped(value, -step, min, max);
  const up = stepped(value, step, min, max);
  const widest = Math.max(String(min).length, String(max).length);
  return (
    <span className="ui-stepper" role="group" aria-label={label}>
      <MarkButton
        label={less}
        mark="less"
        size={size}
        disabled={down === value}
        onClick={() => onChange(down)}
      />
      <span className="ui-stepper__count ui-numeral" style={{ minWidth: `${widest}ch` }} aria-live="polite">
        {value}
      </span>
      <MarkButton label={more} mark="more" size={size} disabled={up === value} onClick={() => onChange(up)} />
    </span>
  );
}
