import './slider.css';

import type { CSSProperties } from 'react';

import { imageSetOf, pictureIn, sourcesOf, usePictures } from '../art/pictures';
import { FaceLayer } from '../button/Button';
import type { Showing } from '../button/Button';
import { faceOf } from '../button/face';
import { shareOf, SLIDER_HEIGHTS, travelOf } from './range';
import type { SliderSize } from './range';

/**
 * A slider: a value set by dragging a knob along a tube, as the moodboard draws one - its track, the tube
 * lit from its left end as far as the knob, and the knob.
 *
 * Under the painted parts is the browser's own slider, unseen, its thumb exactly as wide as the knob and
 * laid so that the two travel together, so the pointer, a finger, the arrow keys, Page Up and Down, Home
 * and End and a screen reader all work it as they work any slider, and the painting only shows where it
 * is. See docs/UI-COMPONENTS.md.
 */

/** The pictures a slider is drawn from, in `world/ui/controls/`. */
const ART = { track: 'slider', fill: 'slider-fill', knob: 'slider-knob' } as const;

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  valueText,
  size = 'regular',
  disabled = false,
  showing,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  /** What it sets, for a screen reader: Taxes. */
  label: string;
  /** The value in words, when a number is not how it is said: a fifth. */
  valueText?: string;
  size?: SliderSize;
  disabled?: boolean;
  /** Draw it as if hovered, pressed or focused: for the page, never for the game. */
  showing?: Showing;
}) {
  const { list } = usePictures();
  const height = SLIDER_HEIGHTS[size];
  const track = pictureIn(list, 'controls', ART.track);
  const fill = pictureIn(list, 'controls', ART.fill);
  const knobPicture = pictureIn(list, 'controls', ART.knob);
  const scale = track === undefined ? 1 : height / track.height;
  const knob = Math.round((knobPicture?.height ?? height * 0.6) * scale);
  const ends = faceOf(list, ART.track, height)?.ends ?? [height, height];
  const travel = travelOf(ends, knob);
  const share = shareOf(value, min, max);
  const along = `${share} * (100% - ${ends[0] + ends[1]}px)`;
  return (
    <span
      className="ui-slider"
      style={{ height, minWidth: ends[0] + ends[1] + knob * 2, '--ui-knob': `${knob}px` } as CSSProperties}
      data-showing={showing}
      data-disabled={disabled ? 'true' : undefined}
    >
      <FaceLayer name={ART.track} height={height} />
      {fill !== undefined && (
        <span
          className="ui-slider__fill"
          style={{ left: ends[0], width: `calc(${along})`, backgroundImage: imageSetOf(fill) }}
          aria-hidden
        />
      )}
      <input
        type="range"
        className="ui-slider__input"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        {...(valueText === undefined ? {} : { 'aria-valuetext': valueText })}
        style={{ left: travel.left, right: travel.right }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {knobPicture === undefined ? (
        <span
          className="ui-slider__knob ui-slider__knob--missing"
          style={{ width: knob, height: knob, left: `calc(${ends[0]}px + ${along} - ${knob / 2}px)` }}
          title={`no knob called ${ART.knob}`}
          aria-hidden
        />
      ) : (
        <img
          className="ui-slider__knob"
          {...sourcesOf(knobPicture)}
          width={knob}
          height={knob}
          style={{ left: `calc(${ends[0]}px + ${along} - ${knob / 2}px)` }}
          alt=""
          draggable={false}
        />
      )}
    </span>
  );
}
