import { WORKED_GROUND_START, setWorkedGround, workedGroundStore } from '../sprites/ground/settings';
import { useStore } from '../store/useStore';

/**
 * The worked ground's levers, in the Structures section: whether the buildings stand in worn ground or on the painted
 * ground as before, how much of the earth covers the paint, how near two buildings stand for a path to join them, how
 * much of a settlement's ground is grass, and the earth's colour. Matters of taste, settled by eye with the map at
 * zoom 9 or 10 over a few buildings. See docs/plans/worked-ground.md.
 */
export function WorkedGroundLevers() {
  const how = useStore(workedGroundStore);
  return (
    <>
      <label
        className="debug__check"
        title="the ground worn bare under every building, or the painted ground as before"
      >
        <input
          type="checkbox"
          checked={how.on}
          onChange={(event) => setWorkedGround({ on: event.target.checked })}
        />
        worn ground under the buildings
      </label>
      <label className="debug-map__label" htmlFor="worked-ground-strength">
        How much of the earth covers the paint
      </label>
      <input
        id="worked-ground-strength"
        className="debug__slider"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={how.strength}
        onChange={(event) => setWorkedGround({ strength: Number(event.target.value) })}
      />
      <label className="debug-map__label" htmlFor="worked-ground-reach">
        How near two buildings stand for a path to join them
      </label>
      <input
        id="worked-ground-reach"
        className="debug__slider"
        type="range"
        min={0}
        max={40}
        step={1}
        value={how.reach}
        onChange={(event) => setWorkedGround({ reach: Number(event.target.value) })}
      />
      <label className="debug-map__label" htmlFor="worked-ground-grass">
        How much of a settlement's ground is grass
      </label>
      <input
        id="worked-ground-grass"
        className="debug__slider"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={how.grass}
        onChange={(event) => setWorkedGround({ grass: Number(event.target.value) })}
      />
      <label className="debug-map__label" htmlFor="worked-ground-road-width">
        How wide the roads are drawn
      </label>
      <input
        id="worked-ground-road-width"
        className="debug__slider"
        type="range"
        min={0.5}
        max={3}
        step={0.1}
        value={how.roadWidth}
        onChange={(event) => setWorkedGround({ roadWidth: Number(event.target.value) })}
      />
      <label className="debug-map__label" htmlFor="worked-ground-road">
        The roads
      </label>
      <div className="debug__levers">
        <input
          id="worked-ground-road"
          type="color"
          value={how.road}
          onChange={(event) => setWorkedGround({ road: event.target.value })}
        />
      </div>
      <label className="debug-map__label" htmlFor="worked-ground-earth">
        The earth
      </label>
      <div className="debug__levers">
        <input
          id="worked-ground-earth"
          type="color"
          value={how.earth}
          onChange={(event) => setWorkedGround({ earth: event.target.value })}
        />
        <button
          type="button"
          className="debug__button"
          title={`back to ${WORKED_GROUND_START.earth} at ${WORKED_GROUND_START.strength}, paths within ${WORKED_GROUND_START.reach}`}
          onClick={() => setWorkedGround({ ...WORKED_GROUND_START })}
        >
          as it was
        </button>
      </div>
      <p className="debug-map__note">
        {how.on
          ? `${Math.round(how.strength * 100)}% earth, ${how.earth}; ${how.reach === 0 ? 'no paths' : `paths between buildings within ${how.reach} units`}`
          : 'the painted ground, as before'}
      </p>
    </>
  );
}
