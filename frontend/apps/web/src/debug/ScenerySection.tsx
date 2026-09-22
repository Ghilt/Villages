import { useEffect, useState, useSyncExternalStore } from 'react';

import { forgetWorstGap, hasNoSpriteMap, sceneryDrawn, sceneryMap } from '../sprites/scenery/sceneryCells';
import type { SceneryDrawnTally } from '../sprites/scenery/sceneryCells';
import { sceneryNow, setScenery, watchScenery } from './scenery';
import { Section } from './Section';

/**
 * What the world is furnished with, how thickly, and what it costs.
 *
 * This reads the **sprite map** the master was generated with - the biomes and the stands that
 * `npm run world:sprites` wrote - and then what the browser actually did with it. So the top half says
 * what was asked for and the bottom half says what happened, and the two numbers to compare are the
 * density the generator promised and the frame gap while the map is moving.
 *
 * The frame gap is only counted between frames of a *moving* map, because a still map draws nothing at
 * all and reporting that as a stall would be the panel lying. See decision record 0023.
 */

/** How often the readings are taken. The same quarter second everything else in the panel gathers over. */
const EVERY_MS = 250;

/** What the dial steps through, as a multiple of what the sprite map asked for. */
const DIALS = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3];

function useDrawn(): SceneryDrawnTally {
  const [drawn, setDrawn] = useState(sceneryDrawn);
  useEffect(() => {
    const often = setInterval(() => setDrawn(sceneryDrawn()), EVERY_MS);
    return () => clearInterval(often);
  }, []);
  return drawn;
}

function useSpriteMap(): ReturnType<typeof sceneryMap> {
  const [map, setMap] = useState(sceneryMap);
  useEffect(() => {
    // Polled rather than watched: it arrives once, early, and then never changes for this master.
    const often = setInterval(() => setMap(sceneryMap()), EVERY_MS);
    return () => clearInterval(often);
  }, []);
  return map;
}

export function ScenerySection() {
  const how = useSyncExternalStore(watchScenery, sceneryNow);
  const drawn = useDrawn();
  const map = useSpriteMap();
  const step = Math.max(0, DIALS.indexOf(how.dial));

  const tools = (
    <button
      type="button"
      className={how.on ? 'debug__button debug__button--on' : 'debug__button'}
      onClick={() => setScenery({ on: !how.on })}
      aria-pressed={how.on}
      title="draw the world's furniture, or leave the ground bare"
    >
      {how.on ? 'furnished' : 'bare'}
    </button>
  );

  return (
    <Section name="Scenery" tools={tools}>
      {map === null ? (
        <p className="debug-map__note">
          {hasNoSpriteMap()
            ? 'This master has no sprite map, so nothing grows on it. Run npm run world:sprites --prefix frontend'
            : 'Reading the sprite map…'}
        </p>
      ) : (
        <dl className="debug__state">
          <div className="debug__row">
            <dt>sprite map</dt>
            <dd>
              {map.file.stands.toLocaleString()} stands in {map.file.chunks.toLocaleString()} chunks,{' '}
              {map.names.length} biomes, {map.kinds.length} kinds
            </dd>
          </div>
          <div className="debug__row">
            <dt>thickest</dt>
            <dd>
              {map.file.density.worst} at {map.file.density.perUnit} points a unit², against a ceiling of{' '}
              {map.file.density.ceiling}
            </dd>
          </div>
          <div className="debug__row">
            <dt>here</dt>
            <dd>{drawn.biome === '' ? 'nothing drawn yet' : drawn.biome}</dd>
          </div>
        </dl>
      )}

      <label className="debug-map__label" htmlFor="scenery-density">
        How much of what the map asked for
      </label>
      <input
        id="scenery-density"
        className="debug__slider"
        type="range"
        min={0}
        max={DIALS.length - 1}
        step={1}
        value={step}
        onChange={(event) => setScenery({ dial: DIALS[Number(event.target.value)] ?? 1 })}
      />
      <p className="debug-map__note">
        {how.dial === 1
          ? 'Exactly what the sprite map asked for'
          : how.dial === 0
            ? 'None of it, so the stands can be seen against bare ground'
            : `${how.dial} times what the sprite map asked for`}
      </p>

      <label className="debug-map__label" htmlFor="scenery-later">
        How far in before it arrives
      </label>
      <input
        id="scenery-later"
        className="debug__slider"
        type="range"
        min={-1}
        max={2}
        step={0.25}
        value={how.laterBy}
        onChange={(event) => setScenery({ laterBy: Number(event.target.value) })}
      />
      <p className="debug-map__note">
        {how.laterBy === 0
          ? 'At the zoom each kind is big enough to read'
          : `${how.laterBy > 0 ? 'Later' : 'Sooner'} than that by ${Math.abs(how.laterBy).toFixed(2)} of a zoom level`}
      </p>

      <dl className="debug__state">
        <div className="debug__row">
          <dt>drawn</dt>
          <dd>
            {drawn.particles.toLocaleString()} particles
            {drawn.moving > 0 ? `, ${drawn.moving} groups still arriving` : ', settled'}
          </dd>
        </div>
        <div className="debug__row">
          <dt>cells</dt>
          <dd>
            {drawn.cells} on screen, {drawn.held} cut, {drawn.points.toLocaleString()} points kept
            {drawn.waiting > 0 && `, ${drawn.waiting} waiting on the ground`}
          </dd>
        </div>
        <div className="debug__row">
          <dt>stands</dt>
          <dd>
            {drawn.stands.toLocaleString()} held, in {drawn.chunks.toLocaleString()} chunks
          </dd>
        </div>
        <div className="debug__row">
          <dt>frame</dt>
          <dd>
            {drawn.frameGapMs === 0
              ? 'nothing drawn yet'
              : `${drawn.frameGapMs.toFixed(1)} ms, worst ${drawn.worstGapMs.toFixed(1)} ms while moving`}
          </dd>
        </div>
      </dl>

      <div className="debug__levers">
        <button type="button" className="debug__button" onClick={forgetWorstGap}>
          forget the worst
        </button>
        <button
          type="button"
          className="debug__button"
          onClick={() => setScenery({ dial: DIALS[DIALS.length - 1] ?? 3, on: true })}
          title="three times what the generator asked for, to find the edge"
        >
          stress it
        </button>
      </div>
    </Section>
  );
}
