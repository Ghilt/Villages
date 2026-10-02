import './hold.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { usePictures } from '../art/pictures';
import { FaceLayer } from '../button/Button';
import { BUTTON_HEIGHTS, faceOf } from '../button/face';
import type { ButtonSize } from '../button/face';
import { HOLD_MS, holdOf, isPressKey } from './hold';

/**
 * Hold to confirm: a button for what cannot be undone - killing a key figure - that does it only when it
 * is held down, a second and a little more, and not when it is merely pressed. While it is held a fuse
 * burns along under its words; let go before the end and it runs back and nothing happens.
 *
 * Held by a pointer, a finger, or Space or Enter from the keyboard. A screen reader is told to hold it.
 * See docs/UI-COMPONENTS.md.
 */
export function HoldButton({
  children,
  onConfirm,
  face = 'primary',
  size = 'regular',
  holdMs = HOLD_MS,
  disabled = false,
  showing,
}: {
  /** What it does, in words: Kill. */
  children: ReactNode;
  /** Called once, when it has been held for the whole of `holdMs`. */
  onConfirm: () => void;
  face?: string;
  size?: ButtonSize;
  holdMs?: number;
  disabled?: boolean;
  /** Draw it as if held this far along, from nought to one: for the page, never for the game. */
  showing?: number;
}) {
  const { list } = usePictures();
  const height = BUTTON_HEIGHTS[size];
  const ends = faceOf(list, face, height)?.ends ?? [height / 2, height / 2];
  const [held, setHeld] = useState(false);
  const [done, setDone] = useState(false);
  const confirm = useRef(onConfirm);
  confirm.current = onConfirm;
  const hold = useMemo(
    () =>
      holdOf(
        holdMs,
        () => {
          setHeld(false);
          setDone(true);
          confirm.current();
        },
        { set: (then, ms) => setTimeout(then, ms), clear: (handle) => clearTimeout(handle as number) },
      ),
    [holdMs],
  );

  const stop = () => {
    hold.stop();
    setHeld(false);
  };
  const start = () => {
    if (disabled || done) {
      return;
    }
    setHeld(true);
    hold.start();
  };

  useEffect(() => () => hold.stop(), [hold]);
  // Done, it says so for a moment and then is ready again.
  useEffect(() => {
    if (!done) {
      return;
    }
    const after = setTimeout(() => setDone(false), 900);
    return () => clearTimeout(after);
  }, [done]);

  const style = {
    height,
    paddingLeft: ends[0],
    paddingRight: ends[1],
    '--ui-hold-left': `${ends[0]}px`,
    '--ui-hold-right': `${ends[1]}px`,
    '--ui-hold-ms': `${holdMs}ms`,
    ...(showing === undefined ? {} : { '--ui-held': showing }),
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`ui-button ui-button--text ui-button--${size} ui-hold`}
      style={style}
      disabled={disabled}
      aria-description="Hold it down to do it"
      data-held={held ? 'true' : undefined}
      data-done={done ? 'true' : undefined}
      data-showing-held={showing === undefined ? undefined : 'true'}
      onPointerDown={(event) => {
        if (event.button === 0) {
          start();
        }
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (isPressKey(event.key)) {
          event.preventDefault();
          if (!event.repeat) {
            start();
          }
        }
      }}
      onKeyUp={(event) => {
        if (isPressKey(event.key)) {
          event.preventDefault();
          stop();
        }
      }}
      onBlur={stop}
    >
      <FaceLayer name={face} height={height} />
      <span className="ui-button__label">{children}</span>
      <span className="ui-hold__fuse" aria-hidden />
    </button>
  );
}
