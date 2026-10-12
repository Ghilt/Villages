import { useEffect, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { structuresInView } from '@villages/client-core';
import { parseStructureCatalogue } from '@villages/world';
import type { StructureTypeSpec } from '@villages/world';

import { subjectsStore } from '../inspect/subjects';
import { Icon } from '../stage/Icons';
import { sessionStore } from '../net/gateway';
import { useStore } from '../store/useStore';
import { Section } from './Section';
import { SlotLevers } from './SlotLevers';
import {
  changeLevel,
  raiseAntarctica,
  raiseStructure,
  rebuildStructure,
  ruinStructure,
  takeControl,
} from './levers';

/**
 * The middle of Antarctica's sixteen, on the island the server raises them on (`Antarctica.placeOf` in the
 * application module), and the zoom from which all of them are on the screen at once.
 */
const ANTARCTICA = { lat: -63.247, lon: -56.03, zoom: 9 };

interface StructuresSectionProps {
  map: maplibregl.Map | null;
}

/**
 * Adam's levers for structures, standing in for the world: one raised at the middle of the map, of a type and a level,
 * his own house's or nobody's, Antarctica's sixteen raised again after a wipe has taken them, and the one whose window
 * is open handed to his house, standing in for a story handing it over or a house taking it; its level, its slots
 * filled and emptied, its ruin. Each is a real
 * command, said in the log under `structures` with its answer, and each raising is an event on the event page. The
 * types are the catalogue's, read as `/admin/inspect-structures` reads it, so a type added there is here on a reload.
 * See docs/plans/structures.md.
 */
export function StructuresSection({ map }: StructuresSectionProps) {
  const connection = useStore(sessionStore, (state) => state.connection);
  // The structure whose window was opened last, and what it is called wherever the page has heard of it.
  const open = useStore(subjectsStore, (state) => state.open.find((one) => one.kind === 'structure') ?? null);
  const openName = useStore(sessionStore, (state) =>
    open === null
      ? null
      : (structuresInView(state.onTheMap).find((one) => one.id === open.id)?.name ??
        state.inspected[`structure:${open.id}`]?.structure?.name ??
        open.id.slice(0, 8)),
  );
  const openType = useStore(sessionStore, (state) =>
    open === null
      ? null
      : (structuresInView(state.onTheMap).find((one) => one.id === open.id)?.structureType ??
        state.inspected[`structure:${open.id}`]?.structure?.structureType ??
        null),
  );
  const [types, setTypes] = useState<readonly StructureTypeSpec[]>([]);
  const [type, setType] = useState('castle');
  const [level, setLevel] = useState(1);
  const [yours, setYours] = useState(true);

  useEffect(() => {
    let live = true;
    fetch('/structures.json', { cache: 'no-store' })
      .then((response) => response.text())
      .then((text) => live && setTypes(parseStructureCatalogue(text).types))
      .catch(() => live && setTypes([]));
    return () => {
      live = false;
    };
  }, []);

  const chosen = types.find((one) => one.type === type);
  const idle = connection !== 'open' || map === null || chosen === undefined;

  /** Raises one at the middle of what the map shows. */
  const raiseHere = () => {
    if (map === null) return;
    const centre = map.getCenter();
    raiseStructure(type, level, { lat: centre.lat, lon: centre.lng }, yours);
  };

  return (
    <Section
      name="Structures"
      control={
        <button
          type="button"
          className="debug__button debug__mapmark"
          disabled={map === null}
          onClick={() => map?.flyTo({ center: [ANTARCTICA.lon, ANTARCTICA.lat], zoom: ANTARCTICA.zoom })}
          title="take the camera to Antarctica's sixteen"
          aria-label="take the camera to Antarctica's sixteen"
        >
          <Icon name="map" />
        </button>
      }
    >
      <div className="debug__levers">
        <select
          className="debug-map__select"
          aria-label="type of structure"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setLevel(1);
          }}
        >
          {types.map((one) => (
            <option key={one.type} value={one.type}>
              {one.words.european}
            </option>
          ))}
        </select>
        {Array.from({ length: chosen?.levels ?? 1 }, (_, at) => at + 1).map((each) => (
          <button
            type="button"
            key={each}
            className={each === level ? 'debug__button debug__button--on' : 'debug__button'}
            aria-pressed={each === level}
            title={`level ${each}`}
            onClick={() => setLevel(each)}
          >
            {each}
          </button>
        ))}
      </div>
      <div className="debug__levers">
        <button
          type="button"
          className={yours ? 'debug__button debug__button--on' : 'debug__button'}
          aria-pressed={yours}
          onClick={() => setYours(true)}
        >
          yours
        </button>
        <button
          type="button"
          className={yours ? 'debug__button' : 'debug__button debug__button--on'}
          aria-pressed={!yours}
          onClick={() => setYours(false)}
        >
          nobody&apos;s
        </button>
        <button type="button" className="debug__button" disabled={idle} onClick={raiseHere}>
          raise here
        </button>
      </div>
      <div className="debug__levers">
        <button
          type="button"
          className="debug__button"
          disabled={connection !== 'open'}
          title="raise whichever of the sixteen in Antarctica a wipe took"
          onClick={raiseAntarctica}
        >
          raise Antarctica again
        </button>
      </div>
      <div className="debug__levers">
        <button
          type="button"
          className="debug__button"
          disabled={connection !== 'open' || open === null}
          title={openName === null ? "open a structure's window first" : `hand ${openName} to your house`}
          onClick={() => open !== null && takeControl(open.id, openName ?? open.id)}
        >
          take control of this building
        </button>
        <button
          type="button"
          className="debug__button"
          disabled={connection !== 'open' || open === null}
          title={openName === null ? "open a structure's window first" : `raise ${openName} a level`}
          onClick={() => open !== null && changeLevel(open.id, openName ?? open.id, 1)}
        >
          level up
        </button>
        <button
          type="button"
          className="debug__button"
          disabled={connection !== 'open' || open === null}
          title={openName === null ? "open a structure's window first" : `lower ${openName} a level`}
          onClick={() => open !== null && changeLevel(open.id, openName ?? open.id, -1)}
        >
          level down
        </button>
        <button
          type="button"
          className="debug__button"
          disabled={connection !== 'open' || open === null}
          title={openName === null ? "open a structure's window first" : `bring ${openName} down, by fire`}
          onClick={() => open !== null && ruinStructure(open.id, openName ?? open.id)}
        >
          ruin it
        </button>
        <button
          type="button"
          className="debug__button"
          disabled={connection !== 'open' || open === null}
          title={
            openName === null ? "open a structure's window first" : `raise ${openName} again, for nobody`
          }
          onClick={() => open !== null && rebuildStructure(open.id, openName ?? open.id)}
        >
          rebuild it
        </button>
      </div>
      <SlotLevers open={open?.id ?? null} name={openName} spec={types.find((one) => one.type === openType)} />
      <p className="debug__quiet">
        {openName === null ? "open a structure's window to take control of it" : `this building: ${openName}`}
      </p>
    </Section>
  );
}
