import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { note } from '../debug/log';
import { subjectsNow, watchSubjects } from '../inspect/subjects';
import { Kebab } from './Kebab';
import { bayLayout, type Box } from './bayBox';
import { askingNow, baysNow, stageIs, toggleMinimise, type Which, watchBays } from './bays';
import { FIXED_PANES, panesFor, type Room, sizeOf } from './panes';

/**
 * The stage, and how it divides itself.
 *
 * One box when there is room for everything - the spread - and two bays when there is not. The whole
 * difference between the forms is that the spread shows everything at once and the bays choose, which is
 * what stops the phone from being a second design. See decision record 0040.
 *
 * **Nothing is unmounted to move it.** A pane changes bays by changing which cell of the grid its wrapper
 * sits in, and the wrappers are the same elements in the same order whatever the layout says. That matters
 * for exactly one pane and it matters a lot: `MapView` calls `map.remove()` when it unmounts, and MapLibre
 * holds the camera, the style and a WebGL context, with the sprite overlay's Pixi canvas beside it. It is
 * free, because everything on the stage was already `position: absolute; inset: 0` - a pane only ever needed
 * a positioned box around it, and until now the stage was that box.
 *
 * A pane is handed the room it got and nothing else. It never learns which bay it is in, which is what lets
 * a mechanic be written once and drawn at up to three sizes.
 */

interface StageProps {
  /** How big the stage is, from `stageBox`. */
  stage: Box;
  /**
   * What each pane draws, given the room it got and how the stage is cut.
   *
   * `along` is null in the spread, where there are no bays to choose between and a link is a plain click.
   */
  contents: (id: string, room: Room, along: 'rows' | 'columns' | null) => ReactNode;
  /** Over the top of everything and in no bay: the parchment, and the notice that you were stood down. */
  overlays?: ReactNode;
}

export function Stage({ stage, contents, overlays }: StageProps) {
  const bays = useSyncExternalStore(watchBays, baysNow);
  const asking = useSyncExternalStore(watchBays, askingNow);
  const subjects = useSyncExternalStore(watchSubjects, subjectsNow);
  const box = useMemo(() => bayLayout(stage, asking), [stage, asking]);
  const panes = useMemo(() => panesFor(subjects.open), [subjects.open]);

  // The manager asks this when it needs to know whether putting a window somewhere means anything, and to
  // say "top" rather than "the first bay" in the log.
  stageIs(box.form, box.along);

  // One line when the stage crosses the fold or turns on its side, and none while it is merely being
  // resized: a drag that changes nothing is not news. See decision record 0023.
  const said = useRef('');
  useEffect(() => {
    const now = `${box.form}/${box.along}`;
    if (said.current !== now) {
      said.current = now;
      const cut = box.along === 'rows' ? 'a top and a bottom' : 'a left and a right';
      note(
        'shape',
        box.form === 'bays'
          ? `two bays, ${cut}, stage ${stage.w} by ${stage.h}`
          : `the spread, stage ${stage.w} by ${stage.h}`,
      );
    }
  }, [box.form, box.along, stage.w, stage.h]);

  const style = {
    '--bay-first': `${box.first}px`,
    '--bay-second': `${box.second}px`,
  } as React.CSSProperties;

  const bayFor = (id: string) => {
    const pane = panes.find((one) => one.id === id);
    const at = bays.holding.indexOf(id);
    const shut = bays.minimised.has(id);
    const room: Room = {
      size: sizeOf(box.form, at === -1 ? 'big' : asking[at as Which], shut),
      // Minimise is a property of a pane everywhere, not a feature of the small screen: the same button
      // works in the spread, where collapsing the house gives the room back to the map.
      minimise: pane?.strip == null ? null : () => toggleMinimise(id),
    };

    return (
      <div
        className={`bay bay--${kindOf(id)} bay--${room.size}`}
        key={id}
        data-at={at === -1 ? 'nowhere' : at}
      >
        {contents(id, room, box.form === 'bays' ? box.along : null)}
      </div>
    );
  };

  return (
    <div className="stage" data-form={box.form} data-along={box.along} style={style}>
      {FIXED_PANES.map((pane) => bayFor(pane.id))}

      {/*
       * The rail: where inspect windows stack in the spread, up to three, newest at the top.
       *
       * A wrapper rather than three loose bays, because in the spread they have to sit in a column and a
       * column needs something to be a column. In the bays it is `display: contents`, so the windows are
       * grid items in their own right and nothing is remounted crossing the fold - the same trick that
       * keeps the map alive, for the same reason.
       */}
      <div className="rail">{panes.filter(isWindow).map((pane) => bayFor(pane.id))}</div>

      {box.form === 'bays' && <Kebab along={box.along} />}
      {overlays}
    </div>
  );
}

const isWindow = (pane: { id: string }) => pane.id.startsWith('inspect:');

/** The class a bay gets from what is in it: every inspect window is styled the same way. */
function kindOf(id: string): string {
  return id.startsWith('inspect:') ? 'inspect' : id;
}
