import { useMemo, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { InfluenceZone } from './areas/InfluenceZone';
import { inspect } from './inspect/opening';
import { subjectsStore } from './inspect/subjects';
import type { Subject } from './inspect/subjects';
import { cultureOfPlace, useCultureMap } from './map/culture';
import { candidatesOf, rememberingMapSprites } from './mapSprites';
import { sessionStore } from './net/gateway';
import { drawnIn, markedOf, peopleIn, yoursIn } from './onTheMapDrawn';
import { useStructureCatalogue } from './net/structureCatalogue';
import { SpriteOverlay } from './sprites/SpriteOverlay';
import { useStore } from './store/useStore';
import type { StructureView } from '@villages/protocol';

/**
 * What the map holds, drawn by the parts of the map's pane that show it, which watch it themselves: a cell's contents
 * arriving, a building going up or a person taking a step redraws these and not the page and every pane on it, as it
 * did when App watched it (decision record 0119). The lists are worked out once a change of what they are made from,
 * so every part that reads them, however often it asks, is handed the very same list.
 */

function useMarked(drawn: readonly StructureView[]): Subject | undefined {
  const top = useStore(subjectsStore, (subjects) => subjects.open[0]);
  return useMemo(() => markedOf(top, drawn), [top, drawn]);
}

/** The structures and people on the map, and the seats a choice offers, handed to the sprite canvas. */
export function MapSprites({
  map,
  master,
  worldRoot,
  started,
}: {
  map: maplibregl.Map;
  master: string;
  worldRoot: string;
  started: boolean;
}) {
  const drawn = useStore(sessionStore, drawnIn);
  const people = useStore(sessionStore, peopleIn);
  const yours = useStore(sessionStore, yoursIn);
  const choice = useStore(sessionStore, (state) => state.yourChoice);
  const catalogue = useStructureCatalogue();
  // The culture each structure stands in, read off the culture map of the master drawn, so its picture is drawn in it.
  const cultures = useCultureMap(master);
  const marked = useMarked(drawn);
  // Structures first, so that a person standing in front of one is drawn over it; each the object it was while
  // nothing about it changed, and the list the list it was.
  const [mapSprites] = useState(rememberingMapSprites);
  const sprites = useMemo(
    () =>
      mapSprites(
        drawn,
        people.map((one) => ({ ...one, yours: yours !== null && one.keyFigureOf[0]?.id === yours })),
        catalogue,
        (structure) => cultureOfPlace(cultures, structure.place),
        yours,
        candidatesOf(choice),
      ),
    [mapSprites, drawn, people, yours, catalogue, cultures, choice],
  );
  return (
    <SpriteOverlay
      map={map}
      sprites={sprites}
      worldRoot={worldRoot}
      picked={marked}
      onPick={inspect}
      started={started}
    />
  );
}

/** The ground the marked structure reaches, drawn while it is marked, for a type the catalogue gives a zone. */
export function MarkedZone({ map, turn }: { map: maplibregl.Map | null; turn: number }) {
  const drawn = useStore(sessionStore, drawnIn);
  const catalogue = useStructureCatalogue();
  const marked = useMarked(drawn);
  const zone = useMemo(() => {
    const structure = marked?.kind === 'structure' ? drawn.find((one) => one.id === marked.id) : undefined;
    const reach = catalogue?.types.find((one) => one.type === structure?.structureType)?.zone?.reach;
    return structure === undefined || reach === undefined
      ? null
      : { id: structure.id, at: structure.place, reach };
  }, [marked, drawn, catalogue]);
  return <InfluenceZone map={map} zone={zone} turn={turn} />;
}
