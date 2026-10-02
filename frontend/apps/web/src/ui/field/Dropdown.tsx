import { useId } from 'react';
import type { CSSProperties } from 'react';

import { FaceLayer } from '../button/Button';
import { Mark } from '../mark/Mark';
import { FIELD_FACE, FieldFrame, useFieldFace } from './TextField';
import type { FieldParts } from './TextField';

/** One of the things a dropdown picks between. */
export interface DropdownOption {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/**
 * A dropdown: one of many picked, the one picked written on the field's parchment and a fold at its end
 * turned down, the rest opening under it when it is pressed.
 *
 * The browser's own list is under the painting, so a pointer, a finger, the arrow keys and typing the first
 * letters all pick, a phone opens its own picker, and a screen reader hears a list. Where the browser lets
 * its list be drawn, it is drawn on night with a gilt edge; elsewhere it is the browser's. Held by whoever
 * uses it with `chosen` and `onChoose`. See docs/UI-COMPONENTS.md.
 */
export function Dropdown({
  options,
  chosen,
  onChoose,
  label,
  hideLabel,
  hint,
  size = 'regular',
  disabled = false,
  showing,
}: FieldParts & {
  options: readonly DropdownOption[];
  /** The id of the one picked. */
  chosen: string;
  onChoose: (id: string) => void;
}) {
  const id = useId();
  const { height, ends } = useFieldFace(size);
  const style = {
    height,
    '--ui-field-start': `${ends[0]}px`,
    '--ui-field-end': `${ends[1] + height * 0.5}px`,
  } as CSSProperties;
  return (
    <FieldFrame id={id} label={label} hideLabel={hideLabel} hint={hint}>
      <div
        className={`ui-field__box ui-field__box--${size} ui-dropdown`}
        style={style}
        {...(showing === undefined ? {} : { 'data-showing': showing })}
        {...(disabled ? { 'data-disabled': true } : {})}
      >
        <FaceLayer name={FIELD_FACE} height={height} />
        <select
          id={id}
          className="ui-dropdown__select"
          value={chosen}
          onChange={(event) => onChoose(event.target.value)}
          disabled={disabled}
          {...(hint === undefined ? {} : { 'aria-describedby': `${id}-said` })}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id} disabled={option.disabled === true}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="ui-dropdown__fold" style={{ right: ends[1] }} aria-hidden>
          <Mark name="fold" size={Math.round(height * 0.42)} />
        </span>
      </div>
    </FieldFrame>
  );
}
