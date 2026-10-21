import './field.css';

import { useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { usePictures } from '../art/pictures';
import { FaceLayer, MarkButton, StateButton } from '../button/Button';
import type { Showing } from '../button/Button';
import { BUTTON_HEIGHTS, faceOf } from '../button/face';
import { Mark } from '../mark/Mark';

/** How tall a field is: a small one and a regular one, as tall as a button of the same size. */
export const FIELD_HEIGHTS = { small: BUTTON_HEIGHTS.small, regular: BUTTON_HEIGHTS.regular } as const;
export type FieldSize = keyof typeof FIELD_HEIGHTS;

/** The face a field is drawn on, and a dropdown too: parchment in a gilt rim, stretched to its width. */
export const FIELD_FACE = 'field';

/** What a field and a dropdown have in common: their name over them, and a line under them. */
export interface FieldParts {
  /** What it is for, in words over it: The house's name. */
  label: string;
  /** Said only to a screen reader, where what it is for is plain from what is round it. */
  hideLabel?: boolean;
  /** A line under it: how it is to be filled. */
  hint?: ReactNode;
  size?: FieldSize;
  disabled?: boolean;
  /** Draw it as if hovered or focused: for the page, never for the game. */
  showing?: Exclude<Showing, 'pressed'>;
}

/** The name over a field and the line under it, round the field itself, which `children` is. */
export function FieldFrame({
  id,
  label,
  hideLabel = false,
  hint,
  problem,
  children,
}: Pick<FieldParts, 'label' | 'hideLabel' | 'hint'> & {
  id: string;
  problem?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ui-field">
      <label
        htmlFor={id}
        className={hideLabel ? 'ui-field__label ui-field__label--unseen' : 'ui-label ui-field__label'}
      >
        {label}
      </label>
      {children}
      {problem !== undefined && problem !== null ? (
        <p id={`${id}-said`} className="ui-field__said ui-field__said--problem">
          <span className="ui-field__warn" aria-hidden>
            <Mark name="warning" size={16} />
          </span>
          {problem}
        </p>
      ) : (
        hint !== undefined && (
          <p id={`${id}-said`} className="ui-label ui-field__said">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** The face a field stands its words on, and how far in from each end they start. */
export function useFieldFace(size: FieldSize): { height: number; ends: readonly [number, number] } {
  const { list } = usePictures();
  const height = FIELD_HEIGHTS[size];
  return { height, ends: faceOf(list, FIELD_FACE, height)?.ends ?? [height / 2, height / 2] };
}

/**
 * A text field: words typed on a strip of parchment in a gilt rim, as the moodboard's "Enter a name…", its
 * name over it and a line under it - how it is to be filled, or what is wrong with what is in it, which a
 * screen reader is told too and the rim says by a glow of velvet.
 *
 * Given `onSearch` it is a search: a mark at its end searches, and so does Enter. Of `kind` email or password it
 * is one a browser's password manager fills and offers to save, as `autoComplete` says - `username`,
 * `current-password`, `new-password` - and a password's has an eye at its end that shows what is typed. Held by
 * whoever uses it, `value` and `onChange`, as every field in a form is. See docs/UI-COMPONENTS.md.
 */
export function TextField({
  value,
  onChange,
  placeholder,
  problem,
  onSearch,
  maxLength,
  kind = 'text',
  autoComplete,
  label,
  hideLabel,
  hint,
  size = 'regular',
  disabled = false,
  showing,
}: FieldParts & {
  value: string;
  onChange: (value: string) => void;
  /** What it says while nothing is in it: Enter a name… */
  placeholder?: string;
  /** What is wrong with what is in it, said under it in place of the hint; nothing when nothing is. */
  problem?: ReactNode;
  /** Searching for what is in it: a field given this is a search. */
  onSearch?: (value: string) => void;
  maxLength?: number;
  /** What is typed in it: words, an email, or a password, which is hidden until its eye is pressed. */
  kind?: 'text' | 'email' | 'password';
  /** What a browser may fill it with, by the web's own names: `username`, `current-password`, `new-password`. */
  autoComplete?: string;
}) {
  const id = useId();
  const [shown, show] = useState(false);
  const { height, ends } = useFieldFace(size);
  const said =
    problem !== undefined && problem !== null ? `${id}-said` : hint === undefined ? undefined : `${id}-said`;
  const markAt = onSearch !== undefined || kind === 'password';
  const searchAt = markAt ? BUTTON_HEIGHTS.small : 0;
  const type = kind === 'password' ? (shown ? 'text' : 'password') : onSearch === undefined ? kind : 'search';
  const style = { height, paddingLeft: ends[0], paddingRight: ends[1] + searchAt } as CSSProperties;
  return (
    <FieldFrame id={id} label={label} hideLabel={hideLabel} hint={hint} problem={problem}>
      <div
        className={`ui-field__box ui-field__box--${size}`}
        style={style}
        {...(showing === undefined ? {} : { 'data-showing': showing })}
        {...(problem === undefined || problem === null ? {} : { 'data-problem': true })}
        {...(disabled ? { 'data-disabled': true } : {})}
      >
        <FaceLayer name={FIELD_FACE} height={height} />
        <input
          id={id}
          className="ui-field__input"
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && onSearch !== undefined) {
              event.preventDefault();
              onSearch(value);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          autoComplete={autoComplete ?? 'off'}
          spellCheck={false}
          {...(kind === 'text' ? {} : { autoCapitalize: 'none' })}
          {...(problem === undefined || problem === null ? {} : { 'aria-invalid': true })}
          {...(said === undefined ? {} : { 'aria-describedby': said })}
        />
        {onSearch !== undefined && (
          <span className="ui-field__search" style={{ right: Math.max(ends[1] - 4, 0) }}>
            <MarkButton
              label="Search"
              mark="search"
              size="small"
              onClick={() => onSearch(value)}
              disabled={disabled}
            />
          </span>
        )}
        {kind === 'password' && (
          <span className="ui-field__search" style={{ right: Math.max(ends[1] - 4, 0) }}>
            <StateButton
              on={shown}
              onChange={show}
              marks={{ on: 'eye-open', off: 'eye-shut' }}
              labels={{ on: 'Hide the password', off: 'Show the password' }}
              size="small"
              disabled={disabled}
            />
          </span>
        )}
      </div>
    </FieldFrame>
  );
}
