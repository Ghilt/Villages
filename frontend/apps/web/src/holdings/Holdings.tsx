import { useState } from 'react';

import type { StructureView } from '@villages/protocol';

import { describeStructure } from '../inspect/describe';
import { note } from '../log/log';
import { focusOn } from '../map/focus';
import { sessionStore } from '../net/gateway';
import { useStructureCatalogue } from '../net/structureCatalogue';
import { Icon } from '../stage/Icons';
import { type Room } from '../stage/panes';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import { useStore } from '../store/useStore';
import { List, ListRow } from '../ui/list/List';
import { StructureFigure } from './StructureFigure';

/**
 * **Holdings**: every structure the house holds, the seat first and the rest in the order it came to hold them.
 *
 * A pane of its own in the corner, the tab beside the key figures. Three sizes and the mechanic owns them all: the
 * **strip** is a name, the pane's or the open holding's; **normal** and **opened out** are the list - each row the
 * structure's picture, its name, and what it is - or, a holding pressed, its details: the same words as its window,
 * the map's mark to show it, and a way back to the list. It scrolls; there is no limit. A house with none is told
 * that holdings will be shown here. What each holding gives joins its row when income does. See `MECHANICS.md`.
 */
interface HoldingsProps {
  room: Room;
}

export function Holdings({ room }: HoldingsProps) {
  const holdings = useStore(sessionStore, (state) => state.yourHoldings) ?? [];
  const catalogue = useStructureCatalogue();
  const [open, setOpen] = useState<string | null>(null);
  const shown = holdings.find((one) => one.id === open) ?? null;
  const specOf = (one: StructureView) => catalogue?.types.find((type) => type.type === one.structureType);

  const show = (one: StructureView) => {
    setOpen(one.id);
    note('holdings', `showing ${one.name}`);
  };
  const back = () => {
    setOpen(null);
    note('holdings', `back to all ${holdings.length} of them`);
  };

  if (room.size === 'strip') {
    return (
      <section className="holdings holdings--strip pane-card pane-strip" aria-label="Holdings">
        <span className="holdings__kind">{shown?.name ?? 'Holdings'}</span>
        <PaneSizeControl room={room} />
      </section>
    );
  }

  return (
    <section className={`holdings pane-card holdings--${room.size}`} aria-label="Holdings">
      <header className="holdings__bar">
        {shown !== null && (
          <button
            type="button"
            className="holdings__back"
            aria-label="all the holdings"
            title="all the holdings"
            onClick={back}
          >
            <Icon name="list" />
          </button>
        )}
        <h2 className="holdings__head">{shown?.name ?? 'Holdings'}</h2>
        <PaneSizeControl room={room} />
      </header>

      {holdings.length === 0 && <p className="holdings__empty">Holdings will be shown here.</p>}

      {shown === null && holdings.length > 0 && (
        <div className="holdings__list">
          <List label="your holdings">
            {holdings.map((one) => {
              const said = describeStructure(one, specOf(one), true);
              return (
                <ListRow
                  key={one.id}
                  lead={<StructureFigure type={one.structureType} />}
                  title={one.name}
                  line={`${said.under ?? ''}, level ${one.level}`}
                  onPress={() => show(one)}
                />
              );
            })}
          </List>
        </div>
      )}

      {shown !== null && (
        <Details holding={shown} said={describeStructure(shown, specOf(shown), true)} room={room} />
      )}
    </section>
  );
}

/** One holding's details: the words its window has, and the map's mark to show it, since it stands somewhere. */
function Details({
  holding,
  said,
  room,
}: {
  holding: StructureView;
  said: ReturnType<typeof describeStructure>;
  room: Room;
}) {
  // The camera on it, and on a phone the map in the bay this pane is not in, as a window's map link does. See 0049.
  const showOnTheMap = () => {
    focusOn(holding.place);
    room.showMap();
    note('holdings', `showing ${holding.name} on the map`);
  };
  return (
    <div className="holdings__details">
      <div className="holdings__title">
        <StructureFigure type={holding.structureType} size={56} />
        <p className="holdings__under">{said.under}</p>
        <button
          type="button"
          className="holdings__map"
          aria-label="show it on the map"
          title="show it on the map"
          onClick={showOnTheMap}
        >
          <Icon name="map" />
        </button>
      </div>
      <dl className="holdings__facts">
        {said.facts.map((fact) => (
          <div className="holdings__fact" key={fact.what}>
            <dt>{fact.what}</dt>
            <dd>{fact.said}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
