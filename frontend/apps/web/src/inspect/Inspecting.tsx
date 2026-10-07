import { useEffect, useState } from 'react';

import { charactersInView, housesInView } from '@villages/client-core';
import type { TerrainClass } from '@villages/world';

import { areasStore } from '../areas/areas';
import { terrainPalette } from '../geometry/terrainClasses';
import { sessionStore } from '../net/gateway';
import type { Room } from '../stage/panes';
import {
  type Description,
  describeArea,
  describeCharacter,
  describeHouse,
  describeWater,
  type Legend,
} from './describe';
import { InspectWindow, WindowBar } from './InspectWindow';
import { forgetSubject, isWaterKind, type Subject } from './subjects';
import { trailStore, forget, lastNamed } from './trail';
import { watersStore } from './waters';
import { useStore } from '../store/useStore';

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

export function Inspecting({ subject, room, along }: InspectingProps) {
  const houses = useStore(sessionStore, (state) => state.houses);
  const yourKeyFigures = useStore(sessionStore, (state) => state.yourKeyFigures);
  const today = useStore(sessionStore, (state) => state.world?.today ?? null);
  const yourHouse = useStore(sessionStore, (state) => state.yourHouse);
  const areas = useStore(areasStore);
  const waters = useStore(watersStore, (state) => state.seen);
  const trail = useStore(trailStore, (state) => state.steps);
  const legend = useLegend();

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
      const standing = charactersInView(houses).find((one) => one.id === subject.id);
      const yours = yourKeyFigures?.find((one) => one.id === subject.id);
      const seen = standing ?? yours;
      return seen === undefined ? null : describeCharacter(seen, today, yours !== undefined);
    }

    if (subject.kind === 'area') {
      return area === null ? null : describeArea(area, housesInView(houses), legend);
    }

    // Water is what the server said of it when it was clicked, kept for this page's life.
    if (isWaterKind(subject.kind)) {
      const seen = waters.get(subject.id);
      return seen === undefined ? null : describeWater(seen);
    }

    const house =
      housesInView(houses).find((one) => one.id === subject.id) ??
      (yourHouse?.house.id === subject.id ? yourHouse.house : undefined);
    return house === undefined ? null : describeHouse(house, yourHouse?.house.id === house.id, areas.areas);
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
  river: 'River',
  lake: 'Lake',
  sea: 'Sea',
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
