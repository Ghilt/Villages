import { useEffect, useState, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import type { TerrainClass } from '@villages/world';

import { Section } from '../debug/Section';
import { inspect, stopInspecting } from '../inspect/opening';
import { subjectsNow, watchSubjects } from '../inspect/subjects';
import { terrainPalette } from '../map/terrainClasses';
import type { Census } from './census';
import { areasNow, armDrawing, countArea, deleteArea, forgetAreas, shadeArea, watchAreas } from './areas';
import type { Area } from './areas';

/**
 * The areas, and what the selected one holds. This is where an area is verified, per decision 0023: the
 * button that makes one, and the numbers that say what it turned out to be.
 */

interface AreasViewProps {
  map: maplibregl.Map | null;
  worldRoot: string;
}

/** Class names and the colours they are drawn in, read from the world rather than written down here. */
interface Legend {
  byId: ReadonlyMap<number, TerrainClass>;
  colours: Record<string, string>;
}

function CensusRows({ census, legend }: { census: Census; legend: Legend | null }) {
  return (
    <>
      <dl className="debug__state">
        <div className="debug__row">
          <dt>encloses</dt>
          <dd>
            {census.diamonds.toLocaleString()} diamonds, from {census.tiles} tiles in {census.tookMs} ms
            {census.unknown > 0 && `, ${census.unknown.toLocaleString()} with no tile to read`}
          </dd>
        </div>
      </dl>
      <ol className="areas__classes">
        {[...census.byClass]
          .sort((one, other) => other[1] - one[1])
          .map(([id, count]) => {
            const terrain = legend?.byId.get(id);
            const name = terrain?.name ?? `class ${id}`;
            const colour = terrain === undefined ? '#888888' : (legend?.colours[terrain.name] ?? '#888888');
            const share = (100 * count) / census.diamonds;
            return (
              <li key={id}>
                <span className="areas__swatch" style={{ background: colour }} />
                <span className="areas__name">{name}</span>
                <span className="areas__count">{count.toLocaleString()}</span>
                <span className="areas__share">{share < 0.1 ? '<0.1' : share.toFixed(1)}%</span>
              </li>
            );
          })}
      </ol>
    </>
  );
}

function Selected({ area, legend, worldRoot }: { area: Area; legend: Legend | null; worldRoot: string }) {
  return (
    <div className="areas__census">
      <header className="areas__bar">
        <span className="debug__title">{area.id}</span>
        <button type="button" className="debug__button" onClick={() => shadeArea(area.id, !area.shaded)}>
          {area.shaded ? 'unshade' : 'shade'}
        </button>
        <button
          type="button"
          className="debug__button"
          onClick={() => countArea(area.id, worldRoot)}
          disabled={area.counting}
        >
          recount
        </button>
        <button type="button" className="debug__button" onClick={() => deleteArea(area.id)}>
          delete
        </button>
      </header>

      {area.problem !== null && <p className="areas__hint">{area.problem}</p>}
      {area.counting && <p className="debug__quiet">counting…</p>}
      {area.census !== null && <CensusRows census={area.census} legend={legend} />}
    </div>
  );
}

export function AreasView({ map, worldRoot }: AreasViewProps) {
  const state = useSyncExternalStore(watchAreas, areasNow);
  const [legend, setLegend] = useState<Legend | null>(null);

  useEffect(() => {
    let wanted = true;
    void terrainPalette().then(
      (palette) => {
        if (wanted) {
          setLegend({
            byId: new Map(palette.classes.map((terrain) => [terrain.id, terrain])),
            colours: palette.colours,
          });
        }
      },
      () => {
        // The debug log already says the world is missing; a legend is the least of it.
      },
    );
    return () => {
      wanted = false;
    };
  }, []);

  // Which area this section shows the census of is the same question as which one has an inspect window
  // open on it, so it is the same answer: the newest subject, if that is an area. One store, one truth.
  const top = useSyncExternalStore(watchSubjects, subjectsNow).open[0];
  const looking = top?.kind === 'area' ? top.id : null;
  const selected = state.areas.find((area) => area.id === looking) ?? null;

  const tools = (
    <>
      <button
        type="button"
        className="debug__button"
        onClick={() => armDrawing(!state.armed)}
        disabled={map === null}
      >
        {state.armed ? 'stop drawing' : 'draw an area'}
      </button>
      <button
        type="button"
        className="debug__button"
        onClick={forgetAreas}
        disabled={state.areas.length === 0}
      >
        delete all
      </button>
    </>
  );

  return (
    <Section name="Areas" tools={tools}>
      {state.armed && <p className="areas__hint">Drag on the map. The ends join themselves; escape stops.</p>}

      <ol className="areas__list">
        {state.areas.length === 0 && !state.armed && (
          <li className="debug__quiet">none yet; draw one to see what it holds</li>
        )}
        {state.areas.map((area) => (
          <li key={area.id}>
            <button
              type="button"
              className={`areas__pick${area.id === looking ? ' areas__pick--on' : ''}`}
              onClick={() =>
                area.id === looking
                  ? stopInspecting({ kind: 'area', id: area.id })
                  : inspect({ kind: 'area', id: area.id })
              }
            >
              <span className="debug__area">{area.id}</span>
              {area.diamonds.toLocaleString()} diamonds
              {area.counting ? ', counting' : area.problem !== null ? ', uncounted' : ''}
            </button>
          </li>
        ))}
      </ol>

      {selected !== null && <Selected area={selected} legend={legend} worldRoot={worldRoot} />}
    </Section>
  );
}
