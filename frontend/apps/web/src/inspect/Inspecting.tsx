import { useEffect, useState } from 'react';

import { charactersInView, housesInView } from '@villages/client-core';
import type { TerrainClass } from '@villages/world';

import { areasStore } from '../areas/areas';
import { terrainPalette } from '../geometry/terrainClasses';
import { inspectSubject, sessionStore } from '../net/gateway';
import type { Room } from '../stage/panes';
import { type Description, describeArea, describeCharacter, describeHouse, type Legend } from './describe';
import { InspectWindow, WindowBar } from './InspectWindow';
import { sayingOrLastSaid } from './remembered';
import { forgetSubject, type Subject } from './subjects';
import { trailStore, forget, lastNamed } from './trail';
import { useStore } from '../store/useStore';

/**
 * One inspect window, fed from what the browser already knows, and where that is nothing, from the gateway.
 *
 * It reads the cells the camera holds rather than keeping a copy, so a house that changes while it is being looked
 * at changes here. Once the camera has left it, it says what it last said; and a window this page has never been
 * able to say anything of asks the gateway after its subject, once, and says what it is answered. A window is for
 * reading about a thing wherever the map is: Adam's word of 2026-10-07, and decision record 0087.
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
  const trail = useStore(trailStore, (state) => state.steps);
  const legend = useLegend();
  const answers = useStore(sessionStore, (state) => state.inspected);
  const connection = useStore(sessionStore, (state) => state.connection);

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

  /** What the window can say now, or null for a subject not in what the camera holds. */
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

    const house =
      housesInView(houses).find((one) => one.id === subject.id) ??
      (yourHouse?.house.id === subject.id ? yourHouse.house : undefined);
    return house === undefined ? null : describeHouse(house, yourHouse?.house.id === house.id, areas.areas);
  };

  /** What the gateway answered when the window asked after its subject, if it has. See 0087. */
  const describeAnswer = (): Description | null => {
    const answer = subject.kind === 'area' ? undefined : answers[`${subject.kind}:${subject.id}`];
    if (answer?.house !== undefined) {
      return describeHouse(answer.house, false, areas.areas);
    }
    return answer?.character === undefined ? null : describeCharacter(answer.character, today, false);
  };

  // Out of what the camera holds, it says what it last said, and what the gateway answered where it has said
  // nothing: the window is for reading, wherever the map is.
  const said = sayingOrLastSaid(subject, describeSubject()) ?? describeAnswer();

  // Knowing nothing of a house or a person, it asks the gateway after them: once a connection, and answered once.
  const knowsNothing = said === null && subject.kind !== 'area';
  useEffect(() => {
    if (knowsNothing && connection === 'open') {
      inspectSubject(subject.kind, subject.id);
    }
  }, [knowsNothing, connection, subject]);

  if (subject.kind === 'area' && area === null) {
    return null;
  }
  // Which one, even put away and even never seen: the name the trail kept when it was last seen, and the
  // word for the kind only where nothing has ever named it.
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
    return <NothingKnown subject={subject} kind={kind} name={name} room={room} along={along} />;
  }
  return <InspectWindow subject={subject} said={said} along={along} room={room} />;
}

/** What each kind of subject is called where nothing more specific is known: its mark's words. */
const KIND_WORDS: Record<Subject['kind'], string> = {
  house: 'House',
  area: 'Area',
  character: 'Key figure',
};

interface NothingKnownProps {
  subject: Subject;
  kind: string;
  name: string;
  room: Room;
  along: 'rows' | 'columns' | null;
}

/**
 * A house or a person nothing can be said of: one the gateway has not answered yet, or one it answered with
 * nothing - none such, or under the fog. It is named, and says so plainly; it does not send the player off to find
 * it on the map, because a window is for reading about a thing wherever the map is.
 */
function NothingKnown({ subject, kind, name, room, along }: NothingKnownProps) {
  return (
    <section className="inspect">
      <header className="inspect__bar">
        <WindowBar subject={subject} kind={kind} name={name} room={room} along={along} />
      </header>
      <p className="inspect__gone">Nothing known of it yet.</p>
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
