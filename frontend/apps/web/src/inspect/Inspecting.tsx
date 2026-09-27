import { useEffect, useState, useSyncExternalStore } from 'react';

import { charactersInView, housesInView } from '@villages/client-core';
import type { TerrainClass } from '@villages/world';

import { areasNow, watchAreas } from '../areas/areas';
import { terrainPalette } from '../map/terrainClasses';
import { gatewayState, watchGateway } from '../net/gateway';
import type { Room } from '../stage/panes';
import { type Description, describeArea, describeCharacter, describeHouse, type Legend } from './describe';
import { InspectWindow, WindowBar } from './InspectWindow';
import { sizeWindow } from './opening';
import { forgetSubject, type Subject } from './subjects';
import { forget, lastNamed, trailNow, watchTrail } from './trail';

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
}

export function Inspecting({ subject, room: given, along }: InspectingProps) {
  // Its own size control opens a put-away window at the top of the rail rather than where it stood.
  const room: Room = { ...given, ask: (size) => sizeWindow(subject, size) };
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const areas = useSyncExternalStore(watchAreas, areasNow);
  const trail = useSyncExternalStore(watchTrail, trailNow);
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

  if (subject.kind === 'area' && area === null) {
    return null;
  }

  /** What the window says, or null for a subject that has left what this page can see. */
  const describeSubject = (): Description | null => {
    // A character is seen standing in a held cell, or as one of this player's own key figures wherever
    // they are; the second is how your own people stay inspectable after the camera has left them.
    if (subject.kind === 'character') {
      const standing = charactersInView(heard.houses).find((one) => one.id === subject.id);
      const yours = heard.yourKeyFigures?.find((one) => one.id === subject.id);
      const seen = standing ?? yours;
      return seen === undefined
        ? null
        : describeCharacter(seen, heard.world?.today ?? null, yours !== undefined);
    }

    if (subject.kind === 'area') {
      return area === null ? null : describeArea(area, housesInView(heard.houses), legend);
    }

    const house =
      housesInView(heard.houses).find((one) => one.id === subject.id) ??
      (heard.yourHouse?.house.id === subject.id ? heard.yourHouse.house : undefined);
    return house === undefined
      ? null
      : describeHouse(house, heard.yourHouse?.house.id === house.id, areas.areas);
  };

  const said = describeSubject();
  // Which one, even put away and even out of view: the name the trail kept when it was last seen, and
  // the word for the kind only where nothing has ever named it.
  const name = said?.name ?? lastNamed(trail, subject) ?? KIND_WORDS[subject.kind];
  const kind = said?.kind ?? KIND_WORDS[subject.kind];

  if (room.size === 'strip') {
    return (
      <section className="inspect inspect--strip" aria-label={name}>
        <WindowBar subject={subject} kind={kind} name={name} room={room} along={along} />
      </section>
    );
  }

  if (said === null) {
    return <OutOfView subject={subject} kind={kind} name={name} room={room} along={along} />;
  }
  return <InspectWindow subject={subject} said={said} along={along} room={room} />;
}

/** What each kind of subject is called where nothing more specific is known: its mark's words. */
const KIND_WORDS: Record<Subject['kind'], string> = {
  house: 'House',
  area: 'Area',
  character: 'Key figure',
};

interface OutOfViewProps {
  subject: Subject;
  kind: string;
  name: string;
  room: Room;
  along: 'rows' | 'columns' | null;
}

/**
 * A house or a person who has left the held cells. Not gone from the world, only from what this page can
 * see: a stranger's key figure the camera has left, or a house panned away from.
 */
function OutOfView({ subject, kind, name, room, along }: OutOfViewProps) {
  return (
    <section className="inspect">
      <header className="inspect__bar">
        <WindowBar subject={subject} kind={kind} name={name} room={room} along={along} />
      </header>
      <p className="inspect__gone">Out of view. Pan back to it, or pick something else.</p>
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
