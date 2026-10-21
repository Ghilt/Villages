import './button.css';

import type { CSSProperties, ReactNode } from 'react';

import { usePictures } from '../art/pictures';
import { Mark } from '../mark/Mark';
import type { MarkName } from '../mark/Mark';
import { Tooltip } from '../tooltip/Tooltip';
import { BUTTON_HEIGHTS, faceOf } from './face';
import type { ButtonSize } from './face';

/**
 * The buttons: **words** on a face, a **mark** on one, a mark that is **on or off**, and the window's
 * three. Whether a button is a mark or words is Adam's call for each one, so both are built properly.
 *
 * Every one is a real `<button>`, pressed by a pointer, a finger or the keyboard, and every one has the
 * same states, drawn the same way whatever the face: lighter under the pointer, darker and a pixel lower
 * pressed, a gilt ring focused, a glow chosen, grey disabled. See docs/UI-COMPONENTS.md.
 */

/** A state to draw a button in without anyone pointing at it, so the page can show every state at once. */
export type Showing = 'hover' | 'pressed' | 'focus';

interface Common {
  onClick?: () => void;
  disabled?: boolean;
  size?: ButtonSize;
  /** Draw it as if hovered, pressed or focused: for the page, never for the game. */
  showing?: Showing;
}

/** A button's face, under its words or its mark: for a component of the library's that is drawn as one. */
export function FaceLayer({ name, height }: { name: string; height: number }) {
  const { list } = usePictures();
  const face = faceOf(list, name, height);
  if (face === undefined) {
    return (
      <span
        className="ui-button__face ui-button__face--missing"
        title={`no face called ${name}`}
        aria-hidden
      />
    );
  }
  return (
    <span
      className={`ui-button__face ${face.sliced ? 'ui-button__face--sliced' : 'ui-button__face--whole'}`}
      style={face.style as CSSProperties}
      data-painted={face.painted.join(' ')}
      aria-hidden
    />
  );
}

/** Words on a face that stretches to fit them. With `sends`, it is the one that sends the form it stands in. */
export function TextButton({
  children,
  face = 'primary',
  size = 'regular',
  onClick,
  disabled = false,
  showing,
  sends = false,
}: Common & { children: ReactNode; face?: string; sends?: boolean }) {
  const { list } = usePictures();
  const height = BUTTON_HEIGHTS[size];
  const ends = faceOf(list, face, height)?.ends ?? [height / 2, height / 2];
  return (
    <button
      type={sends ? 'submit' : 'button'}
      className={`ui-button ui-button--text ui-button--${size}`}
      style={{ height, paddingLeft: ends[0], paddingRight: ends[1] }}
      onClick={onClick}
      disabled={disabled}
      data-showing={showing}
    >
      <FaceLayer name={face} height={height} />
      <span className="ui-button__label">{children}</span>
    </button>
  );
}

/**
 * A mark on a face, one size whatever it says. `label` is what it does, in words, for its tooltip and for a
 * screen reader, because a mark is learnt and words are not. Leave `mark` out for a face that has its mark
 * painted in, as the moodboard's close and minimise have.
 */
export function MarkButton({
  label,
  mark,
  face = 'round-plain',
  size = 'regular',
  onClick,
  disabled = false,
  showing,
  pressed,
}: Common & { label: string; mark?: MarkName; face?: string; pressed?: boolean }) {
  const { list } = usePictures();
  const height = BUTTON_HEIGHTS[size];
  const width = faceOf(list, face, height)?.width ?? height;
  return (
    <Tooltip text={label} describes={false}>
      <button
        type="button"
        className={`ui-button ui-button--mark ui-button--${size}`}
        style={{ width, height }}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        data-showing={showing}
        {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      >
        <FaceLayer name={face} height={height} />
        {mark !== undefined && (
          <span className="ui-button__mark">
            <Mark name={mark} size={Math.round(height * 0.5)} />
          </span>
        )}
      </button>
    </Tooltip>
  );
}

/**
 * A mark that is on or off, like the eye: pressing it changes what it is doing rather than which button it
 * is. It says which it is in two ways, the mark itself and the glow of being chosen, and in words for the
 * pointer and the screen reader, what pressing it would do.
 */
export function StateButton({
  on,
  onChange,
  marks,
  labels,
  face = 'round-plain',
  size = 'regular',
  disabled = false,
  showing,
}: Omit<Common, 'onClick'> & {
  on: boolean;
  onChange: (on: boolean) => void;
  marks: { readonly on: MarkName; readonly off: MarkName };
  labels: { readonly on: string; readonly off: string };
  face?: string;
}) {
  return (
    <MarkButton
      label={on ? labels.on : labels.off}
      mark={on ? marks.on : marks.off}
      face={face}
      size={size}
      disabled={disabled}
      pressed={on}
      onClick={() => onChange(!on)}
      {...(showing === undefined ? {} : { showing })}
    />
  );
}

/** The window's three, in the order a window has them: put away, opened out, shut. */
export function WindowControls({
  onMinimise,
  onMaximise,
  onClose,
  size = 'small',
  disabled = false,
}: {
  onMinimise?: () => void;
  onMaximise?: () => void;
  onClose?: () => void;
  size?: ButtonSize;
  disabled?: boolean;
}) {
  return (
    <span className="ui-window-controls" role="group" aria-label="The window">
      <MarkButton label="Put it away" face="minimise" size={size} disabled={disabled} onClick={onMinimise} />
      <MarkButton label="Open it out" face="maximise" size={size} disabled={disabled} onClick={onMaximise} />
      <MarkButton label="Close it" face="close" size={size} disabled={disabled} onClick={onClose} />
    </span>
  );
}
