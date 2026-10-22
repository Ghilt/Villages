import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';

import type { DieStage } from './dieStage';

/**
 * The die on its little podium, the spike's own drawing of it: Adam's word of 2026-10-22, "it should be there on a
 * little podium", picked up by a long press so that a tap meant for something else never lifts it, and leaving an
 * empty slot that says without a word where it goes back. The game's podium is drawn in the component library, a later
 * step of `docs/plans/choice-roll-podium.md`; this one is only for feeling the throw.
 */

/** How long a press must be held before the die lifts. */
const LONG_PRESS_MS = 380;
/** A press that wanders further than this before the die lifts was not meant for it. */
const WANDERS = 12;

interface Press {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly timer: number;
  held: boolean;
}

export function Podium({
  empty,
  stage,
  onPickUp,
  onPutBack,
}: {
  empty: boolean;
  stage: RefObject<DieStage | null>;
  onPickUp: () => void;
  onPutBack: () => void;
}) {
  const slot = useRef<HTMLButtonElement>(null);
  const press = useRef<Press | null>(null);
  const [pressing, setPressing] = useState(false);

  const onMap = (event: PointerEvent) => {
    const box = slot.current!.closest('.die-spike__map')!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const overSlot = (event: PointerEvent) => {
    const box = slot.current!.getBoundingClientRect();
    return (
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom
    );
  };
  const forget = () => {
    if (press.current !== null) window.clearTimeout(press.current.timer);
    press.current = null;
    setPressing(false);
  };
  const putBack = () => {
    stage.current?.putBack();
    forget();
    onPutBack();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && press.current?.held === true) putBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="die-podium">
      <button
        ref={slot}
        type="button"
        className={`die-podium__slot${empty ? ' is-empty' : ''}${pressing ? ' is-pressing' : ''}`}
        aria-label={
          empty ? 'The die is out' : 'Take action: press and hold to pick the die up, or Enter to drop it'
        }
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || empty || stage.current === null) return;
          event.preventDefault();
          onPickUp();
          stage.current.dropAtCentre(performance.now());
        }}
        onPointerDown={(event) => {
          if (empty || stage.current === null || !event.isPrimary) return;
          event.preventDefault();
          // So the die follows the hand off the podium and over the map. A pointer the browser has already let go of
          // cannot be captured, and then the press simply goes on without it.
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Nothing to capture.
          }
          const at = onMap(event);
          const byTouch = event.pointerType === 'touch';
          const timer = window.setTimeout(() => {
            if (press.current === null) return;
            press.current.held = true;
            setPressing(false);
            onPickUp();
            stage.current?.pickUp(at, byTouch, performance.now());
          }, LONG_PRESS_MS);
          press.current = { id: event.pointerId, x: event.clientX, y: event.clientY, timer, held: false };
          setPressing(true);
        }}
        onPointerMove={(event) => {
          const now = press.current;
          if (now === null || event.pointerId !== now.id) return;
          if (now.held) {
            // Every place the pointer passed since the last frame, each at its own moment, so a flick is read whole.
            // A browser that has none to give, as for an event a script sent, gives the one event itself.
            const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
            const box = slot.current!.closest('.die-spike__map')!.getBoundingClientRect();
            for (const step of coalesced.length > 0 ? coalesced : [event.nativeEvent]) {
              stage.current?.move({ x: step.clientX - box.left, y: step.clientY - box.top }, step.timeStamp);
            }
          } else if (Math.hypot(event.clientX - now.x, event.clientY - now.y) > WANDERS) {
            forget();
          }
        }}
        onPointerUp={(event) => {
          const now = press.current;
          if (now === null || event.pointerId !== now.id) return;
          if (!now.held) {
            forget();
          } else if (overSlot(event)) {
            putBack();
          } else {
            stage.current?.letGo(performance.now());
            forget();
          }
        }}
        onPointerCancel={() => {
          if (press.current?.held === true) putBack();
          else forget();
        }}
      >
        <svg className="die-podium__fill" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="29" />
        </svg>
        {!empty && (
          <span className="die-podium__die" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((pip) => (
              <i key={pip} className={`die-podium__pip die-podium__pip--${pip}`} />
            ))}
          </span>
        )}
      </button>
      <span className="die-podium__plinth" aria-hidden="true" />
      <span className="die-podium__words">Take action</span>
    </div>
  );
}
