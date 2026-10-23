import './podium.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';

import { pictureIn, sourcesOf, usePictures } from '../art/pictures';
import { holdOf } from '../hold/hold';
import { LIFT_MS, over, wandered } from './lift';
import type { Spot } from './lift';

/** Where the die was lifted, in the window's pixels, whether by a finger, and when, on the page's clock. */
export interface Lifted extends Spot {
  readonly byTouch: boolean;
  readonly at: number;
}

/** Where the hand holding the die was, and when: every place it passed, so a flick is read whole. */
export interface Moved extends Spot {
  readonly at: number;
}

/** How far out the ring of light stands from the dish's middle, as a share of the dish's width: past its gilt. */
const RING = 0.5;
/** The ring's radius in its own drawing, which is a hundred across. */
const DRAWN = 46;
/** Where the middle of the dish's ring is in its picture, as shares across and down: below the fleur on top. */
const MIDDLE = { x: 0.49, y: 0.57 } as const;

interface Press {
  readonly from: Spot;
  readonly byTouch: boolean;
  held: boolean;
}

/**
 * The die on its little podium: the choice roll's Take action, Adam's word of 2026-10-22, "it should be there on a
 * little podium". A long press lifts the die, a ring of light filling round the dish as it is held, so a tap meant for
 * something else never does; lifted, it leaves an empty slot that says without a word where it goes back. The hand's
 * path is told as it moves until it lets go, over the map or back over the slot. Enter drops it at once, with no hand.
 * Greyed, it cannot be lifted, and says why. It knows nothing of a map: what is done with the die is the caller's.
 *
 * The dish is a picture, `embellishments/podium`; the die is drawn, five pips up. See docs/UI-COMPONENTS.md and
 * `docs/plans/choice-roll-podium.md`.
 */
export function Podium({
  words,
  aside,
  out = false,
  disabled = false,
  size = 'regular',
  showing,
  onLift,
  onMove,
  onLetGo,
  onPutBack,
  onDrop,
}: {
  /** What it does, in words: Take action. */
  words: ReactNode;
  /** A line under them: what it costs, or why it cannot be lifted. */
  aside?: ReactNode;
  /** The die is out of its slot, in the hand or on the map. */
  out?: boolean;
  disabled?: boolean;
  /** Regular in an opened pane, small in a strip or a chip. */
  size?: 'regular' | 'small';
  /** Draw the long press this far along, from nought to one: for the page, never for the game. */
  showing?: number;
  /** A long press lifted the die. */
  onLift?: (lifted: Lifted) => void;
  /** The hand holding it moved, through each of these places. */
  onMove?: (moved: readonly Moved[]) => void;
  /** It was let go here, not over its slot. */
  onLetGo?: (at: Moved) => void;
  /** It was let go over its slot, or the press was taken away, or Escape: back, and nothing happens. */
  onPutBack?: () => void;
  /** Enter: drop it at once, where the caller says, with no hand. */
  onDrop?: () => void;
}) {
  const { list } = usePictures();
  const dish = pictureIn(list, 'embellishments', 'podium');
  const slot = useRef<HTMLButtonElement>(null);
  const press = useRef<Press | null>(null);
  const [pressing, setPressing] = useState(false);
  const told = useRef({ onLift, onPutBack });
  told.current = { onLift, onPutBack };

  const lift = useMemo(
    () =>
      holdOf(
        LIFT_MS,
        () => {
          const now = press.current;
          if (now === null) return;
          now.held = true;
          setPressing(false);
          told.current.onLift?.({ ...now.from, byTouch: now.byTouch, at: performance.now() });
        },
        { set: (then, ms) => setTimeout(then, ms), clear: (handle) => clearTimeout(handle as number) },
      ),
    [],
  );

  const forget = () => {
    lift.stop();
    press.current = null;
    setPressing(false);
  };
  const putBack = () => {
    forget();
    told.current.onPutBack?.();
  };

  // Escape puts a held die back, wherever the pointer is.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && press.current?.held === true) putBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => () => lift.stop(), [lift]);

  const placesOf = (event: PointerEvent): Moved[] => {
    // Every place the pointer passed since the last event, each at its own moment; a browser with none to give, as
    // for an event a script sent, gives the one event itself.
    const passed = event.nativeEvent.getCoalescedEvents?.() ?? [];
    return (passed.length > 0 ? passed : [event.nativeEvent]).map((step) => ({
      x: step.clientX,
      y: step.clientY,
      at: step.timeStamp,
    }));
  };

  const held = showing ?? (pressing ? 1 : 0);
  const style = { '--ui-podium-held': held, '--ui-podium-lift': `${LIFT_MS}ms` } as CSSProperties;

  return (
    <div
      className={`ui-podium ui-podium--${size}`}
      data-out={out}
      data-disabled={disabled}
      data-pressing={pressing || (showing !== undefined && showing > 0)}
      style={style}
    >
      <button
        ref={slot}
        type="button"
        className="ui-podium__slot"
        aria-disabled={disabled}
        aria-label={
          disabled
            ? 'Take action, not now'
            : out
              ? 'The die is out; let it go here to put it back'
              : 'Take action: press and hold to lift the die, or Enter to drop it'
        }
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || out || disabled) return;
          event.preventDefault();
          onDrop?.();
        }}
        onPointerDown={(event) => {
          if (out || disabled || !event.isPrimary) return;
          event.preventDefault();
          // So the die follows the hand off the podium and over the map. A pointer the browser has already let go of
          // cannot be captured, and the press goes on without it.
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Nothing to capture.
          }
          press.current = {
            from: { x: event.clientX, y: event.clientY },
            byTouch: event.pointerType === 'touch',
            held: false,
          };
          setPressing(true);
          lift.start();
        }}
        onPointerMove={(event) => {
          const now = press.current;
          if (now === null) return;
          if (now.held) onMove?.(placesOf(event));
          else if (wandered(now.from, { x: event.clientX, y: event.clientY })) forget();
        }}
        onPointerUp={(event) => {
          const now = press.current;
          if (now === null) return;
          if (!now.held) {
            forget();
          } else if (over(slot.current!.getBoundingClientRect(), { x: event.clientX, y: event.clientY })) {
            putBack();
          } else {
            forget();
            onLetGo?.({ x: event.clientX, y: event.clientY, at: event.timeStamp });
          }
        }}
        onPointerCancel={() => {
          if (press.current?.held === true) putBack();
          else forget();
        }}
      >
        {dish === undefined ? (
          <span className="ui-podium__dish ui-podium__dish--missing" title="no picture called podium" />
        ) : (
          <img className="ui-podium__dish" {...sourcesOf(dish)} alt="" draggable={false} />
        )}
        <svg
          className="ui-podium__ring"
          viewBox="-50 -50 100 100"
          aria-hidden="true"
          style={{
            left: `${MIDDLE.x * 100}%`,
            top: `${MIDDLE.y * 100}%`,
            width: `${(RING / DRAWN) * 10000}%`,
          }}
        >
          <circle r={DRAWN} pathLength="1" />
        </svg>
        {!out && (
          <span
            className="ui-podium__die"
            aria-hidden="true"
            style={{ left: `${MIDDLE.x * 100}%`, top: `${MIDDLE.y * 100}%` }}
          >
            {[0, 1, 2, 3, 4].map((pip) => (
              <i key={pip} className={`ui-podium__pip ui-podium__pip--${pip}`} />
            ))}
          </span>
        )}
      </button>
      <span className="ui-podium__words">{words}</span>
      {aside !== undefined && <span className="ui-podium__aside">{aside}</span>}
    </div>
  );
}
