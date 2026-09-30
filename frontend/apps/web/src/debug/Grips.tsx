import { useRef } from 'react';

import { setStage } from './stage';
import { STAGE_LEAST, stageFromSideGrip, stageFromTopGrip } from './stageBox';
import type { StageBox } from './stageBox';

/** How far an arrow key moves a grip. Big enough to be felt, small enough to land on a number. */
const NUDGE = 16;

interface GripsProps {
  /** Where the stage is now, so a drag starts from the edge rather than from wherever it was last. */
  box: StageBox;
  /** How wide the panel wants to be, which is where the side grip stops when it is dragged outward. */
  wants: number;
}

/**
 * The two handles that resize the stage.
 *
 * They sit on the stage's edges rather than inside it, so the map does not have to give up a strip of
 * itself to be resizable, and they are the only things above the stage that take a pointer.
 *
 * The drag writes the size to the store on every move. That is a React render per frame, which sounds
 * expensive and is not: the grid is four custom properties and the map redraws from its own observer
 * either way. See decision record 0039.
 */
export function Grips({ box, wants }: GripsProps) {
  const startedAt = useRef<{ w: number; h: number } | null>(null);

  const holdOn = (event: React.PointerEvent<HTMLDivElement>) => {
    startedAt.current = { ...box.stage };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const letGo = (event: React.PointerEvent<HTMLDivElement>) => {
    startedAt.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  // Escape puts it back where the drag began, which is the only way out of a drag that has gone wrong
  // without letting go first and dragging it back by eye.
  const giveUp = (event: React.KeyboardEvent<HTMLDivElement>, was: { w: number; h: number } | null) => {
    if (event.key === 'Escape' && was !== null) {
      setStage(was);
      startedAt.current = null;
    }
  };

  const window = { width: globalThis.innerWidth, height: globalThis.innerHeight };

  return (
    <>
      <div
        className="grip grip--side"
        role="separator"
        aria-orientation="vertical"
        aria-label="How wide the stage is"
        tabIndex={0}
        onPointerDown={holdOn}
        onPointerUp={letGo}
        onPointerCancel={letGo}
        onPointerMove={(event) => {
          if (startedAt.current !== null) {
            setStage(stageFromSideGrip(window, event.clientX, box.stage.h, wants));
          }
        }}
        onDoubleClick={() => setStage('fill')}
        onKeyDown={(event) => {
          giveUp(event, startedAt.current);
          const by = event.key === 'ArrowLeft' ? -NUDGE : event.key === 'ArrowRight' ? NUDGE : 0;
          if (by !== 0) {
            event.preventDefault();
            setStage({ w: Math.max(STAGE_LEAST.w, box.stage.w + by * 2), h: box.stage.h });
          }
        }}
      />
      <div
        className="grip grip--top"
        role="separator"
        aria-orientation="horizontal"
        aria-label="How tall the stage is"
        tabIndex={0}
        onPointerDown={holdOn}
        onPointerUp={letGo}
        onPointerCancel={letGo}
        onPointerMove={(event) => {
          if (startedAt.current !== null) {
            setStage(stageFromTopGrip(window, event.clientY, box.stage.w));
          }
        }}
        onDoubleClick={() => setStage('fill')}
        onKeyDown={(event) => {
          giveUp(event, startedAt.current);
          const by = event.key === 'ArrowUp' ? NUDGE : event.key === 'ArrowDown' ? -NUDGE : 0;
          if (by !== 0) {
            event.preventDefault();
            setStage({ w: box.stage.w, h: Math.max(STAGE_LEAST.h, box.stage.h + by * 2) });
          }
        }}
      />
    </>
  );
}
