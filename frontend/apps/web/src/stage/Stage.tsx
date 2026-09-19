import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { note } from '../debug/log';
import { subjectsNow, watchSubjects } from '../inspect/subjects';
import { Kebab } from './Kebab';
import { type Box, paneLayout } from './paneBox';
import { askingNow, panesNow, stageIs, toggleMinimise, type Which, watchPanes } from './panes';
import { FIXED_VIEWS, type Room, sizeOf, viewsFor } from './views';

/**
 * The stage, and how it divides itself.
 *
 * One box when there is room for everything - the spread - and two panes when there is not. The whole
 * difference between the forms is that the spread shows everything at once and the panes choose, which is
 * what stops the phone from being a second design. See decision record 0040.
 *
 * **Nothing is unmounted to move it.** A view changes panes by changing which cell of the grid its wrapper
 * sits in, and the wrappers are the same elements in the same order whatever the layout says. That matters
 * for exactly one view and it matters a lot: `MapView` calls `map.remove()` when it unmounts, and MapLibre
 * holds the camera, the style and a WebGL context, with the sprite overlay's Pixi canvas beside it. It is
 * free, because everything on the stage was already `position: absolute; inset: 0` - a view only ever needed
 * a positioned box around it, and until now the stage was that box.
 *
 * A view is handed the room it got and nothing else. It never learns which pane it is in, which is what lets
 * a mechanic be written once and drawn at up to three sizes.
 */

interface StageProps {
  /** How big the stage is, from `stageBox`. */
  stage: Box;
  /**
   * What each view draws, given the room it got and how the stage is cut.
   *
   * `along` is null in the spread, where there are no panes to choose between and a link is a plain click.
   */
  contents: (id: string, room: Room, along: 'rows' | 'columns' | null) => ReactNode;
  /** Over the top of everything and in no pane: the parchment, and the notice that you were stood down. */
  overlays?: ReactNode;
}

export function Stage({ stage, contents, overlays }: StageProps) {
  const panes = useSyncExternalStore(watchPanes, panesNow);
  const asking = useSyncExternalStore(watchPanes, askingNow);
  const subjects = useSyncExternalStore(watchSubjects, subjectsNow);
  const box = useMemo(() => paneLayout(stage, asking), [stage, asking]);
  const views = useMemo(() => viewsFor(subjects.open), [subjects.open]);

  // The manager asks this when it needs to know whether putting a window somewhere means anything, and to
  // say "top" rather than "the first pane" in the log.
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
        box.form === 'panes'
          ? `two panes, ${cut}, stage ${stage.w} by ${stage.h}`
          : `the spread, stage ${stage.w} by ${stage.h}`,
      );
    }
  }, [box.form, box.along, stage.w, stage.h]);

  const style = {
    '--pane-first': `${box.first}px`,
    '--pane-second': `${box.second}px`,
  } as React.CSSProperties;

  const paneFor = (id: string) => {
    const view = views.find((one) => one.id === id);
    const at = panes.holding.indexOf(id);
    const shut = panes.minimised.has(id);
    const room: Room = {
      size: sizeOf(box.form, at === -1 ? 'big' : asking[at as Which], shut),
      // Minimise is a property of a view everywhere, not a feature of the small screen: the same button
      // works in the spread, where collapsing the house gives the room back to the map.
      minimise: view?.strip == null ? null : () => toggleMinimise(id),
    };

    return (
      <div
        className={`pane pane--${kindOf(id)} pane--${room.size}`}
        key={id}
        data-at={at === -1 ? 'nowhere' : at}
      >
        {contents(id, room, box.form === 'panes' ? box.along : null)}
      </div>
    );
  };

  return (
    <div className="stage" data-form={box.form} data-along={box.along} style={style}>
      {FIXED_VIEWS.map((view) => paneFor(view.id))}

      {/*
       * The rail: where inspect windows stack in the spread, up to three, newest at the top.
       *
       * A wrapper rather than three loose panes, because in the spread they have to sit in a column and a
       * column needs something to be a column. In the panes it is `display: contents`, so the windows are
       * grid items in their own right and nothing is remounted crossing the fold - the same trick that
       * keeps the map alive, for the same reason.
       */}
      <div className="rail">{views.filter(isWindow).map((view) => paneFor(view.id))}</div>

      {box.form === 'panes' && <Kebab along={box.along} />}
      {overlays}
    </div>
  );
}

const isWindow = (view: { id: string }) => view.id.startsWith('inspect:');

/** The class a pane gets from what is in it: every inspect window is styled the same way. */
function kindOf(id: string): string {
  return id.startsWith('inspect:') ? 'inspect' : id;
}
