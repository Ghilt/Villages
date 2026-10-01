import './meter.css';

import { FaceLayer } from '../button/Button';
import { shareOf } from '../slider/range';

/**
 * A meter: a level shown and not set - the cathedral's faith, how far a pledge has come - where a slider
 * is set. A tube, and the same tube full, shown as far as the level reaches, so the two pictures are all
 * there is to it and a meter of another colour is another pair of them. It has no knob, because a knob
 * says it can be moved. A level that changes glides to where it is going. See docs/UI-COMPONENTS.md.
 */
export function Meter({
  value,
  min = 0,
  max = 100,
  label,
  valueText,
  look = 'meter',
  height = 14,
}: {
  value: number;
  min?: number;
  max?: number;
  /** What it shows, for a screen reader: Faith. */
  label: string;
  /** The level in words, when a number is not how it is said: 62 of 100. */
  valueText?: string;
  /** The picture in `world/ui/controls/` it is drawn in, empty, beside `<look>-full`, full. */
  look?: string;
  /** How tall it is drawn, in pixels. */
  height?: number;
}) {
  const share = shareOf(value, min, max);
  return (
    <span
      className="ui-meter"
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      {...(valueText === undefined ? {} : { 'aria-valuetext': valueText })}
      style={{ height, minWidth: height * 3 }}
    >
      <FaceLayer name={look} height={height} />
      <span className="ui-meter__full" style={{ clipPath: `inset(0 ${(1 - share) * 100}% 0 0)` }} aria-hidden>
        <FaceLayer name={`${look}-full`} height={height} />
      </span>
    </span>
  );
}
