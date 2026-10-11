import { useEffect, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { parseStructureCatalogue } from '@villages/world';
import type { StructureTypeSpec } from '@villages/world';

import { sessionStore } from '../net/gateway';
import { useStore } from '../store/useStore';
import { Section } from './Section';
import { raiseAntarctica, raiseStructure } from './levers';

interface StructuresSectionProps {
  map: maplibregl.Map | null;
}

/**
 * Adam's levers for structures, standing in for the world: one raised at the middle of the map, of a type and a level,
 * his own house's or nobody's, and Antarctica's sixteen raised again after a wipe has taken them. Each is a real
 * command, said in the log under `structures` with its answer, and each raising is an event on the event page. The
 * types are the catalogue's, read as `/admin/inspect-structures` reads it, so a type added there is here on a reload.
 * See docs/plans/structures.md.
 */
export function StructuresSection({ map }: StructuresSectionProps) {
  const connection = useStore(sessionStore, (state) => state.connection);
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
    <Section name="Structures">
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
    </Section>
  );
}
