import { useEffect, useState } from 'react';

import { charactersInView, structuresInView } from '@villages/client-core';
import { describeDay, shortDay } from '@villages/protocol';
import type { StructureView } from '@villages/protocol';
import type { TerrainClass } from '@villages/world';

import { areasStore } from '../areas/areas';
import { terrainPalette } from '../geometry/terrainClasses';
import { inspectSubject, sessionStore } from '../net/gateway';
import { cultureOfPlace, useCultureMap } from '../map/culture';
import { useStructureCatalogue } from '../net/structureCatalogue';
import type { Room } from '../stage/panes';
import {
  type Description,
  describeArea,
  describeCharacter,
  describeHouse,
  describeStructure,
  describeWater,
  type Legend,
} from './describe';
import { InspectWindow, WindowBar } from './InspectWindow';
import { sayingOrLastSaid } from './remembered';
import { forgetSubject, isWaterKind, type Subject } from './subjects';
import { trailStore, forget, lastNamed } from './trail';
import { watersStore } from './waters';
import { useStore } from '../store/useStore';

/**
 * One inspect window, fed from what the browser already knows, and where that is nothing, from the gateway.
 *
 * It reads the cells the camera holds rather than keeping a copy, so a house that changes while it is being looked
 * at changes here. Once the camera has left it, it says what it last said; and a window this page has never been
 * able to say anything of asks the gateway after its subject, once, and says what it is answered. A window is for
 * reading about a thing wherever the map is: Adam's word of 2026-10-07, and decision record 0088.
 */

interface InspectingProps {
  subject: Subject;
  room: Room;
  /** How the stage is cut, or null in the spread, where a link needs no arrows. */
  along: 'rows' | 'columns' | null;
}

export function Inspecting({ subject, room, along }: InspectingProps) {
  const onTheMap = useStore(sessionStore, (state) => state.onTheMap);
  const yourKeyFigures = useStore(sessionStore, (state) => state.yourKeyFigures);
  const yourHoldings = useStore(sessionStore, (state) => state.yourHoldings);
  const today = useStore(sessionStore, (state) => state.world?.today ?? null);
  const yourHouse = useStore(sessionStore, (state) => state.yourHouse);
  const areas = useStore(areasStore);
  const waters = useStore(watersStore, (state) => state.seen);
  const trail = useStore(trailStore, (state) => state.steps);
  const legend = useLegend();
  const answers = useStore(sessionStore, (state) => state.inspected);
  const connection = useStore(sessionStore, (state) => state.connection);
  const catalogue = useStructureCatalogue();
  const cultures = useCultureMap();
  /** A structure as its window says it, by the catalogue's entry for its type and whether it is the player's. */
  const sayStructure = (structure: StructureView): Description =>
    describeStructure(
      structure,
      catalogue?.types.find((one) => one.type === structure.structureType),
      structure.holder !== undefined && structure.holder.id === yourHouse?.house.id,
      cultureOfPlace(cultures, structure.place),
    );

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

  /**
   * What the window can say now, and the day the fog hid what it says it of as the gateway sent it - absent for the
   * player's own and for anything it sees - or null for a subject not in what the camera holds.
   */
  const describeSubject = (): { said: Description; hidden: number | undefined } | null => {
    // A character is seen standing in a held cell, or as one of this player's own key figures wherever
    // they are; the second is how your own people stay inspectable after the camera has left them.
    if (subject.kind === 'character') {
      const standing = charactersInView(onTheMap).find((one) => one.id === subject.id);
      const yours = yourKeyFigures?.find((one) => one.id === subject.id);
      const seen = standing ?? yours;
      return seen === undefined
        ? null
        : { said: describeCharacter(seen, today, yours !== undefined), hidden: standing?.seenUntil };
    }

    // A structure is seen standing in a held cell, in the face its house is sent, or as one of this player's own
    // holdings wherever it stands, which is sent again whenever it changes: of the two, the later stamp.
    if (subject.kind === 'structure') {
      const standing = structuresInView(onTheMap).find((one) => one.id === subject.id);
      const yours = yourHoldings?.find((one) => one.id === subject.id);
      const seen =
        standing === undefined || (yours !== undefined && yours.stamp > standing.stamp) ? yours : standing;
      return seen === undefined ? null : { said: sayStructure(seen), hidden: seen.seenUntil };
    }

    if (subject.kind === 'area') {
      return area === null
        ? null
        : { said: describeArea(area, structuresInView(onTheMap), legend), hidden: undefined };
    }

    // Water is what the server said of it when it was clicked, kept for this page's life.
    if (isWaterKind(subject.kind)) {
      const seen = waters.get(subject.id);
      return seen === undefined ? null : { said: describeWater(seen), hidden: undefined };
    }

    // A house is not on the map, so only the player's own is known without asking; any other is asked after.
    const house = yourHouse?.house.id === subject.id ? yourHouse.house : undefined;
    return house === undefined
      ? null
      : {
          said: describeHouse(house, yourHouse?.house.id === house.id, areas.areas),
          hidden: house.seenUntil,
        };
  };

  /** What the gateway answered when the window asked after its subject, if it has. See 0088. */
  const answer = subject.kind === 'area' ? undefined : answers[`${subject.kind}:${subject.id}`];
  const describeAnswer = (): Description | null => {
    if (answer?.house !== undefined) {
      return describeHouse(answer.house, false, areas.areas);
    }
    if (answer?.structure !== undefined) {
      return sayStructure(answer.structure);
    }
    return answer?.character === undefined ? null : describeCharacter(answer.character, today, false);
  };

  // Out of what the camera holds, it says what the gateway answered, and what it last said until the gateway has:
  // the window is for reading, wherever the map is.
  const live = describeSubject();
  const said =
    live === null
      ? (describeAnswer() ?? sayingOrLastSaid(subject, null))
      : sayingOrLastSaid(subject, live.said);

  // Out of what the camera holds, it asks the gateway after a house or a person: once a connection, answered once,
  // so what it says and how fresh that is do not hang on where the camera is. Water is asked after by a click, and
  // an area is the player's own. See 0087, 0088 and 0089.
  const asks =
    live === null &&
    (subject.kind === 'house' || subject.kind === 'character' || subject.kind === 'structure');
  useEffect(() => {
    if (asks && connection === 'open') {
      inspectSubject(subject.kind, subject.id);
    }
  }, [asks, connection, subject]);

  /**
   * How fresh what it shows is, said beside its name: `current`, or the day the fog hid it. The gateway says which,
   * on the house or the person it sends, and the page works none of it out; what is only remembered waits for the
   * gateway's answer; an area, which is the player's own drawing, has none, and nor has water, which the fog
   * does not hide once a click has named it. See 0089.
   */
  const freshness = (): { said: string; meant: string } | null => {
    const answered = answer?.house ?? answer?.character ?? answer?.structure;
    const hidden = live !== null ? live.hidden : answered === undefined ? null : answered.seenUntil;
    if (subject.kind === 'area' || isWaterKind(subject.kind) || said === null || hidden === null) {
      return null;
    }
    return hidden === undefined
      ? { said: 'current', meant: 'as it is now' }
      : { said: shortDay(hidden), meant: `as last seen: the fog hid it on ${describeDay(hidden)}` };
  };
  const fresh = freshness();

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
        <WindowBar subject={subject} kind={kind} name={name} room={room} along={along} fresh={fresh} />
      </section>
    );
  }

  if (said === null) {
    return <NothingKnown subject={subject} kind={kind} name={name} room={room} along={along} />;
  }
  return <InspectWindow subject={subject} said={said} along={along} room={room} fresh={fresh} />;
}

/** What each kind of subject is called where nothing more specific is known: its mark's words. */
const KIND_WORDS: Record<Subject['kind'], string> = {
  house: 'House',
  area: 'Area',
  character: 'Key figure',
  structure: 'Structure',
  river: 'River',
  lake: 'Lake',
  sea: 'Sea',
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
