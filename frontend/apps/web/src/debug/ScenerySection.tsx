import { useEffect, useState, useSyncExternalStore } from 'react';

import { forgetWorstGap, sceneryDrawn } from '../sprites/scenery/sceneryCells';
import type { SceneryDrawnTally } from '../sprites/scenery/sceneryCells';
import { sceneryNow, setScenery, watchScenery } from './scenery';
import { Section } from './Section';

/**
 * How thickly the world is furnished, and what it costs.
 *
 * **The levers of experiment 0006, not a part of the game.** They are here to find the ceiling and
 * not to furnish a world; see `docs/plans/world-generator.md` for what replaces them.
 *
 * This is the instrument for the question Adam asked - how much scenery can the browser draw before
 * it lags - so it is levers and numbers and nothing else. The numbers say what they measure: the
 * frame gap is only counted between frames of a *moving* map, because a still map draws nothing at
 * all and reporting that as a stall would be the panel lying. See decision record 0023.
 */

/** How often the readings are taken. The same quarter second everything else in the panel gathers over. */
const EVERY_MS = 250;

/** The spacings the slider steps through, in world units. Each step is about twice the scenery. */
const SPACINGS = [8, 6, 4, 3, 2, 1.5, 1, 0.75, 0.5];

function useDrawn(): SceneryDrawnTally {
  const [drawn, setDrawn] = useState(sceneryDrawn);
  useEffect(() => {
    const often = setInterval(() => setDrawn(sceneryDrawn()), EVERY_MS);
    return () => clearInterval(often);
  }, []);
  return drawn;
}

export function ScenerySection() {
  const how = useSyncExternalStore(watchScenery, sceneryNow);
  const drawn = useDrawn();
  const step = Math.max(0, SPACINGS.indexOf(how.spacing));

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
      <label className="debug-map__label" htmlFor="scenery-density">
        How much
      </label>
      <input
        id="scenery-density"
        className="debug__slider"
        type="range"
        min={0}
        max={SPACINGS.length - 1}
        step={1}
        value={step}
        onChange={(event) => setScenery({ spacing: SPACINGS[Number(event.target.value)] ?? 2 })}
      />
      <p className="debug-map__note">
        A point every {how.spacing} world units, which is about{' '}
        {Math.round(1000 / (how.spacing * how.spacing)) / 1000} to the unit squared
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
            {drawn.showing.toLocaleString()} of {drawn.particles.toLocaleString()} held
          </dd>
        </div>
        <div className="debug__row">
          <dt>cells</dt>
          <dd>
            {drawn.cells} on screen, {drawn.held} cut, {drawn.points.toLocaleString()} points kept
            {drawn.waiting > 0 && `, ${drawn.waiting} waiting on terrain`}
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
          onClick={() => setScenery({ spacing: SPACINGS[SPACINGS.length - 1] ?? 0.5, on: true })}
          title="as much as it will take"
        >
          stress it
        </button>
      </div>
    </Section>
  );
}
