import { useEffect, useState, useSyncExternalStore } from 'react';

import { charactersInView, housesInView } from '@villages/client-core';
import type { MasterGrid, TerrainClass } from '@villages/world';

import { areasNow, watchAreas } from '../areas/areas';
import { Icon } from '../stage/Icons';
import { PaneSizeControl } from '../stage/PaneSizeControl';
import { terrainPalette } from '../map/terrainClasses';
import { gatewayState, watchGateway } from '../net/gateway';
import type { Room } from '../stage/panes';
import { describeArea, describeCharacter, describeHouse, type Legend } from './describe';
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
  const legend = useLegend();

  // Nothing in an inspect window moves any more. The treasury was the only ticking figure on it, and
  // what a house has is its owner's to see now, so redrawing four times a second would redraw the same
  // thing. The house card still ticks, because that one is yours.
  useEffect(() => {}, []);

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
    return <Strip name={KIND_WORDS[subject.kind]} room={room} />;
  }

  // A character is seen standing in a held cell, or as one of this player's own key figures wherever they
  // are; the second is how your own people stay inspectable after the camera has left them.
  if (subject.kind === 'character') {
    const standing = charactersInView(heard.houses).find((one) => one.id === subject.id);
    const yours = heard.yourKeyFigures?.find((one) => one.id === subject.id);
    const seen = standing ?? yours;
    if (seen === undefined) {
      return <OutOfView subject={subject} room={room} />;
    }
    const said = describeCharacter(seen, heard.world?.today ?? null, yours !== undefined);
    return <InspectWindow subject={subject} said={said} along={along} room={room} />;
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
    (heard.yourHouse?.house.id === subject.id ? heard.yourHouse.house : undefined);

  if (house === undefined) {
    return <OutOfView subject={subject} room={room} />;
  }

  const said = describeHouse(house, heard.yourHouse?.house.id === house.id, areas.areas, grid);
  return <InspectWindow subject={subject} said={said} along={along} room={room} />;
}

/** What each kind of subject is called above its window, and on its strip. */
const KIND_WORDS: Record<Subject['kind'], string> = {
  house: 'House',
  area: 'Area',
  character: 'Key figure',
};

/**
 * A house or a person who has left the held cells. Not gone from the world, only from what this page can
 * see: a stranger's key figure the camera has left, or a house panned away from.
 */
function OutOfView({ subject, room }: { subject: Subject; room: Room }) {
  return (
    <section className="inspect">
      <header className="inspect__bar">
        <span className="inspect__kind">{KIND_WORDS[subject.kind]}</span>
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
