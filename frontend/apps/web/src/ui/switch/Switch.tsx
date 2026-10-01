import './switch.css';

import type { CSSProperties, ReactNode } from 'react';

import { pictureIn, sourcesOf, usePictures } from '../art/pictures';
import { FaceLayer } from '../button/Button';
import type { Showing } from '../button/Button';

/**
 * A switch: a thing that is on or off, its name in words beside it - fog of war, on - and a knob that
 * stands at one end of a slot or the other. The slot is the oval face and the knob the slider's, so it is
 * drawn from pictures already in the folder; on, the slot glows as a chosen button does.
 *
 * A real `<button>` that says it is a switch, pressed by a pointer, a finger, or Space and Enter from the
 * keyboard. A screen reader hears its name and whether it is on; the word after the slot is for the eye.
 * See docs/UI-COMPONENTS.md.
 */

/** How tall a switch's slot is drawn, by the size asked for, in pixels. */
export const SWITCH_HEIGHTS = { small: 20, regular: 26 } as const;
export type SwitchSize = keyof typeof SWITCH_HEIGHTS;

/** The pictures a switch is drawn from, in `world/ui/controls/`. */
const ART = { slot: 'oval', knob: 'slider-knob' } as const;

export function Switch({
  label,
  on,
  onChange,
  say,
  size = 'regular',
  disabled = false,
  showing,
}: {
  /** What it switches, in words: Fog of war. */
  label: ReactNode;
  on: boolean;
  onChange: (on: boolean) => void;
  /** What it says it is, after its slot: on and off unless it says otherwise; null, and it says nothing. */
  say?: { readonly on: string; readonly off: string } | null;
  size?: SwitchSize;
  disabled?: boolean;
  /** Draw it as if hovered, pressed or focused: for the page, never for the game. */
  showing?: Showing;
}) {
  const { list } = usePictures();
  const height = SWITCH_HEIGHTS[size];
  const knob = Math.round(height * 0.86);
  const knobPicture = pictureIn(list, 'controls', ART.knob);
  const words = say === undefined ? { on: 'on', off: 'off' } : say;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`ui-switch ui-switch--${size}`}
      disabled={disabled}
      data-showing={showing}
      onClick={() => onChange(!on)}
    >
      <span className="ui-switch__label">{label}</span>
      <span
        className="ui-switch__slot"
        style={{ width: Math.round(height * 1.9), height, '--ui-knob': `${knob}px` } as CSSProperties}
      >
        <FaceLayer name={ART.slot} height={height} />
        {knobPicture === undefined ? (
          <span className="ui-switch__knob ui-switch__knob--missing" aria-hidden />
        ) : (
          <img
            className="ui-switch__knob"
            {...sourcesOf(knobPicture)}
            width={knob}
            height={knob}
            alt=""
            draggable={false}
          />
        )}
      </span>
      {words !== null && (
        <span className="ui-switch__say" aria-hidden>
          {on ? words.on : words.off}
        </span>
      )}
    </button>
  );
}
