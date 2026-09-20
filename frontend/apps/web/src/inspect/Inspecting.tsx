import { useEffect, useState, useSyncExternalStore } from 'react';

import { housesInView } from '@villages/client-core';
import type { MasterGrid, TerrainClass } from '@villages/world';

import { areasNow, watchAreas } from '../areas/areas';
import { Icon } from '../stage/Icons';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import { TICK_MS } from '../house/describe';
import { terrainPalette } from '../map/terrainClasses';
import { gatewayState, watchGateway } from '../net/gateway';
import type { Room } from '../stage/panes';
import { describeArea, describeHouse, type Legend } from './describe';
import { InspectWindow } from './InspectWindow';
import { forgetSubject, type Subject } from './subjects';
import { forget } from './trail';

/**
 * One inspect window, fed from what the browser already knows.
 *
 * It reads the read models rather than keeping a copy, so a house that changes while it is being looked at
 * changes here, and a house that leaves the cells being held says so rather than freezing: the interface
 * never shows something it can no longer see. That behaviour was the old inspector's and it was hard won.
 *
 * Everything shown is already on the wire. No frame was added and no event, which is why the protocol
 * version did not move; `MECHANICS.md` records what the window is waiting on and it is the world, not the
 * interface.
 */

interface InspectingProps {
  subject: Subject;
  room: Room;
  /** How the stage is cut, or null in the spread, where a link needs no arrows. */
  along: 'rows' | 'columns' | null;
  /** The master grid, for deciding which area a seat falls inside. Null until the palette has loaded. */
  grid: MasterGrid | null;
}

export function Inspecting({ subject, room, along, grid }: InspectingProps) {
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const areas = useSyncExternalStore(watchAreas, areasNow);
  const [now, setNow] = useState(() => Date.now());
  const legend = useLegend();

  useEffect(() => {
    const often = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(often);
  }, []);

  // An area the player deleted is not a window they shut, so the window goes rather than saying nothing -
  // and it leaves the trail with it, because a thing that has stopped existing is not a way back to
  // anything. A house merely out of view is a different case: it still exists, so the trail keeps it.
  const area = subject.kind === 'area' ? (areas.areas.find((one) => one.id === subject.id) ?? null) : null;
  useEffect(() => {
    if (subject.kind === 'area' && area === null) {
      forgetSubject(subject);
      forget(subject);
    }
  }, [subject, area]);

  if (room.size === 'strip') {
    return <Strip name={subject.kind === 'house' ? 'House' : 'Area'} room={room} />;
  }

  if (subject.kind === 'area') {
    if (area === null) {
      return null;
    }
    const said = describeArea(area, housesInView(heard.houses), legend, grid);
    return <InspectWindow subject={subject} said={said} along={along} room={room} />;
  }

  const house =
    housesInView(heard.houses).find((one) => one.id === subject.id) ??
    (heard.yourHouse?.id === subject.id ? heard.yourHouse : undefined);

  if (house === undefined) {
    return <OutOfView subject={subject} room={room} />;
  }

  const said = describeHouse(house, now, heard.yourHouse?.id === house.id, areas.areas, grid);
  return <InspectWindow subject={subject} said={said} along={along} room={room} />;
}

/** A house that has left the held cells. It is not gone from the world, only from what this page can see. */
function OutOfView({ subject, room }: { subject: Subject; room: Room }) {
  return (
    <section className="inspect">
      <header className="inspect__bar">
        <span className="inspect__kind">House</span>
        <PaneSizeControl room={room} />
        <button
          type="button"
          className="inspect__close"
          aria-label="close this window"
          title="close this window"
          onClick={() => {
            forgetSubject(subject);
          }}
        >
          <Icon name="close" />
        </button>
      </header>
      <p className="inspect__gone">Out of view. Pan back to it, or pick something else.</p>
    </section>
  );
}

function Strip({ name, room }: { name: string; room: Room }) {
  return (
    <section className="inspect inspect--strip">
      <span className="inspect__kind">{name}</span>
      <PaneSizeControl room={room} />
    </section>
  );
}

/**
 * What terrain a class id means.
 *
 * The same one fetch the painter and the area census already made - `terrainPalette` keeps its promise - so
 * asking here costs nothing after the first time.
 */
function useLegend(): Legend | null {
  const [legend, setLegend] = useState<Legend | null>(null);

  useEffect(() => {
    let looking = true;
    void terrainPalette().then((palette) => {
      if (looking) {
        setLegend({ byId: new Map(palette.classes.map((one: TerrainClass) => [one.id, one])) });
      }
    });
    return () => {
      looking = false;
    };
  }, []);

  return legend;
}
