import { useState, useSyncExternalStore } from 'react';

import { ageOn } from '@villages/client-core';
import type { KeyFigureView, Point } from '@villages/protocol';

import { note } from '../debug/log';
import { focusOn } from '../map/focus';
import { Mark } from '../marks/Mark';
import { gatewayState, watchGateway } from '../net/gateway';
import { baysNow, put, watchBays, type Which } from '../stage/bays';
import { Icon } from '../stage/Icons';
import { KEY_FIGURES_PANE, MAP_PANE, type Room } from '../stage/panes';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import { STATS_IN_ORDER, STAT_WORDS, fullName } from './describe';
import { Portrait } from './Portrait';
import { stillOpen, viewOf } from './view';

/**
 * **Key figures**: the few named people the house acts through.
 *
 * A pane of its own in the corner, the tab between the house status and navigation, and a row of *Go to*
 * on a phone. Three sizes and the mechanic owns them all: the **strip** is a name, the pane's or the open
 * figure's, and the **normal** and **opened-out** sizes are the portraits - a grid of them, three by three
 * and never scrolling, in the order they joined, or one figure's details with the nine squares to go back
 * to all of them by. Which of those it is follows `view.ts`, which has the rules and their test.
 *
 * A house starts with none, and a house with none is told so in the words Adam gave it rather than shown
 * an empty frame. See `MECHANICS.md` and decision record 0055.
 *
 * A figure standing on the map has the map's mark beside their name, the inspect window's own *show it on
 * the map*, and one who is on no map has none: a mark that could only ever say "nowhere" is not a way on.
 */
interface KeyFiguresProps {
  room: Room;
  /** How the stage is cut, or null in the spread, where the map is the floor and always in view. */
  along: 'rows' | 'columns' | null;
}

export function KeyFigures({ room, along }: KeyFiguresProps) {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const bays = useSyncExternalStore(watchBays, baysNow);
  const figures = heard.yourKeyFigures ?? [];
  const today = heard.world?.today ?? null;
  const [open, setOpen] = useState<string | null>(null);

  // A lone figure is open whether or not anybody pressed them, and is kept open, so that a second
  // arriving leaves them open with a way back. Settled while rendering rather than in an effect, so the
  // grid never flashes up between the two; `stillOpen` of its own answer is the same answer.
  const kept = stillOpen(figures, open);
  if (kept !== open) {
    setOpen(kept);
  }
  const view = viewOf(figures, kept);

  const show = (figure: KeyFigureView) => {
    setOpen(figure.id);
    note('figures', `showing ${fullName(figure)}`);
  };
  const back = () => {
    setOpen(null);
    note('figures', `back to all ${figures.length} of them`);
  };

  /**
   * The camera on where they stand, and on a phone the map in the bay this pane is not in, so the pane
   * stays beside it - what an inspect window's map link does, for the same reasons. See decision 0049.
   */
  const showOnTheMap = (place: Point) => {
    focusOn(place);
    if (along !== null) {
      const there: Which = bays.holding.indexOf(KEY_FIGURES_PANE.id) === 0 ? 1 : 0;
      put(there, MAP_PANE.id);
    }
  };

  if (room.size === 'strip') {
    return (
      <section className="figures figures--strip" aria-label="Key figures">
        <span className="figures__kind">
          {view.kind === 'details' ? fullName(view.figure) : 'Key figures'}
        </span>
        <PaneSizeControl room={room} />
      </section>
    );
  }

  return (
    <section
      className={`figures figures--${room.size} figures--${view.kind}${view.kind === 'details' && view.back ? ' figures--back' : ''}`}
      aria-label="Key figures"
    >
      <header className="figures__bar">
        {view.kind === 'details' && view.back && (
          <button
            type="button"
            className="figures__back"
            aria-label="all the key figures"
            title="all the key figures"
            onClick={back}
          >
            <Icon name="nine" />
          </button>
        )}
        <h2 className="figures__head">Key figures</h2>
        <PaneSizeControl room={room} />
      </header>

      {view.kind === 'empty' && <p className="figures__empty">Key figures will be shown here.</p>}

      {view.kind === 'grid' && (
        <ol className="figures__grid">
          {view.figures.map((figure) => (
            <li className="figures__cell" key={figure.id}>
              <button
                type="button"
                className="figures__thumb"
                aria-label={fullName(figure)}
                title={fullName(figure)}
                onClick={() => show(figure)}
              >
                <Portrait portrait={figure.portrait} name={fullName(figure)} />
                <span className="figures__caption" aria-hidden="true">
                  {figure.givenName}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {view.kind === 'details' && (
        <article className="figures__one">
          <Portrait portrait={view.figure.portrait} name={fullName(view.figure)} />
          <div className="figures__who">
            <h3 className="figures__name">{fullName(view.figure)}</h3>
            {view.figure.place !== undefined && (
              <MapLink name={fullName(view.figure)} place={view.figure.place} onShow={showOnTheMap} />
            )}
          </div>
          <Stats figure={view.figure} today={today} />
        </article>
      )}
    </section>
  );
}

/** The map's mark, and pressing it shows where they stand. The inspect window's link, beside a name. */
function MapLink({ name, place, onShow }: { name: string; place: Point; onShow: (place: Point) => void }) {
  return (
    <button
      type="button"
      className="figures__map"
      aria-label={`show ${name} on the map`}
      title={`show ${name} on the map`}
      onClick={() => onShow(place)}
    >
      <Icon name="map" />
    </button>
  );
}

/**
 * A key figure's power, which is their stats, and their age: a mark, a word and a number a line.
 *
 * Words beside the marks here, where the house card has only marks, because a key figure's details have
 * the room for five words and the house card's one line has not; the marks are the same drawings, so the
 * words teach them. Age first, because it is what anybody asks first about somebody. Where the room is
 * too little for them, the stylesheet leaves them out rather than this leaving them unsaid.
 */
function Stats({ figure, today }: { figure: KeyFigureView; today: number | null }) {
  const age = today === null ? '—' : String(ageOn(figure.bornOn, figure.agedYears, today));

  return (
    <ul className="figures__stats">
      <li className="figures__stat" aria-label={`Age: ${age}`}>
        <Mark name="age" className="figures__mark" />
        <span className="figures__word">Age</span>
        <span className="figures__figure">{age}</span>
      </li>
      {STATS_IN_ORDER.map((stat) => (
        <li className="figures__stat" key={stat} aria-label={`${STAT_WORDS[stat]}: ${figure.stats[stat]}`}>
          <Mark name={stat} className="figures__mark" />
          <span className="figures__word">{STAT_WORDS[stat]}</span>
          <span className="figures__figure">{figure.stats[stat]}</span>
        </li>
      ))}
    </ul>
  );
}
