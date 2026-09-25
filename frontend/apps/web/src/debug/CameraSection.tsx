import { useEffect, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import {
  DIAMOND_BEARING,
  DIAMOND_LATTICE_SIZE,
  DIAMOND_LATTICE_TURN,
  DIMETRIC_PITCH,
  ISOMETRIC_PITCH,
  STEEPEST_PARALLEL_PITCH,
  TRIMETRIC_BEARING,
  TRIMETRIC_PITCH,
  cameraNow,
  isFlat,
  isSquareGround,
  lensOf,
  setCamera,
  watchCamera,
} from './camera';
import { Section } from './Section';

/**
 * Where the camera stands, and what the world looks like from there.
 *
 * **The lever of experiment 0008, not a part of the game.** A player's map is flat and north-up, which
 * is decision record 0014 and is still true: nothing here is reachable by anybody playing, and every
 * control starts at the number that means flat. This is the instrument for one question - whether a
 * world drawn at an angle is a world worth having - and that question is answered by looking, which is
 * why it is a slider and not a proposal. See decision record 0023.
 *
 * What the map does under it is honest and what everything else does is not, on purpose. The terrain,
 * the coast, the areas, the marks and the scenery all follow the camera, the marks and the scenery
 * standing upright on the ground as it tips. The desk does not, because it is a square of CSS and a
 * tilted world is not a square. That is a finding, not a bug. The experiment record says so.
 *
 * There is no lever for how wide the camera sees: tipped it is always parallel, because the overlay is
 * only right for a parallel camera. See `lensOf`.
 */

interface CameraSectionProps {
  map: maplibregl.Map | null;
}

export function CameraSection({ map }: CameraSectionProps) {
  const how = useSyncExternalStore(watchCamera, cameraNow);

  // The panel holds the intent and the map holds the camera, so this is the one place they meet. It runs
  // on every change rather than being called from each control, which is what keeps a preset and a slider
  // the same act as far as the map is concerned.
  useEffect(() => {
    if (map === null) {
      return;
    }
    const lens = lensOf(how);
    if (map.getVerticalFieldOfView() !== lens) {
      map.setVerticalFieldOfView(lens);
    }
    map.jumpTo({ pitch: how.pitch, bearing: how.bearing });
  }, [map, how]);

  const flat = isFlat(how);
  const wide = (1 / Math.cos((how.pitch * Math.PI) / 180)).toFixed(2);

  const tools = (
    <button
      type="button"
      className={flat ? 'debug__button debug__button--on' : 'debug__button'}
      onClick={() => setCamera({ pitch: 0, bearing: 0 })}
      aria-pressed={flat}
      title="put the camera back where a player has it"
    >
      flat
    </button>
  );

  return (
    <Section name="Camera" tools={tools} shutToStart>
      <label className="debug-map__label" htmlFor="camera-pitch">
        How far it has tipped
      </label>
      <input
        id="camera-pitch"
        className="debug__slider"
        type="range"
        min={0}
        max={STEEPEST_PARALLEL_PITCH}
        step={0.5}
        value={how.pitch}
        onChange={(event) => setCamera({ pitch: Number(event.target.value) })}
      />
      <p className="debug-map__note">
        {how.pitch === 0
          ? 'Straight down, which is the map a player gets'
          : `${how.pitch.toFixed(1)} degrees, so a square of ground is drawn ${wide} times as wide as it is tall, and seen parallel, with no horizon`}
        {how.pitch === STEEPEST_PARALLEL_PITCH &&
          '. This is as far as it tips: past here a parallel camera asks for no tiles and the screen goes one colour'}
      </p>

      <label className="debug-map__label" htmlFor="camera-bearing">
        Which way is up
      </label>
      <input
        id="camera-bearing"
        className="debug__slider"
        type="range"
        min={0}
        max={90}
        step={1}
        value={how.bearing}
        onChange={(event) => setCamera({ bearing: Number(event.target.value) })}
      />
      <p className="debug-map__note">
        {how.bearing === 0
          ? 'North, which is the map a player gets'
          : how.bearing === DIAMOND_BEARING
            ? `Turned ${DIAMOND_BEARING} degrees, so the two ground axes are the same length and a square reads as an even diamond`
            : `Turned ${how.bearing.toFixed(1)} degrees, so no two axes are alike and a square reads as a lopsided diamond`}
      </p>

      <hr className="debug__rule" />

      <label className="debug-map__label" htmlFor="lattice-turn">
        How far the ground&rsquo;s own grid is turned
      </label>
      <input
        id="lattice-turn"
        className="debug__slider"
        type="range"
        min={0}
        max={45}
        step={1}
        value={how.latticeTurn}
        onChange={(event) => setCamera({ latticeTurn: Number(event.target.value) })}
      />
      <p className="debug-map__note">
        {how.latticeTurn === 0
          ? 'Square, along the world’s own axes, which is how the terrain is stored'
          : `Turned ${how.latticeTurn} degrees, so a cell is a diamond and north still points up`}
      </p>

      <label className="debug-map__label" htmlFor="lattice-size">
        How big one of its cells is
      </label>
      <input
        id="lattice-size"
        className="debug__slider"
        type="range"
        min={1}
        max={16}
        step={1}
        value={how.latticeSize}
        onChange={(event) => setCamera({ latticeSize: Number(event.target.value) })}
      />
      <p className="debug-map__note">
        {how.latticeSize === 1
          ? 'One master pixel, which is the finest the terrain goes'
          : `${how.latticeSize} world units across, about ${Math.round(how.latticeSize * 8 * Math.SQRT2)} pixels corner to corner at the closest the camera comes`}
      </p>

      <div className="debug__levers">
        <button
          type="button"
          className={isSquareGround(how) ? 'debug__button' : 'debug__button debug__button--on'}
          onClick={() =>
            setCamera(
              isSquareGround(how)
                ? { latticeTurn: DIAMOND_LATTICE_TURN, latticeSize: DIAMOND_LATTICE_SIZE }
                : { latticeTurn: 0, latticeSize: 1 },
            )
          }
          aria-pressed={!isSquareGround(how)}
          title="draw the ground on a turned grid, with the world left where it is"
        >
          {isSquareGround(how) ? 'diamonds' : 'squares'}
        </button>
      </div>

      <hr className="debug__rule" />

      <div className="debug__levers">
        <button
          type="button"
          className="debug__button"
          onClick={() => setCamera({ pitch: ISOMETRIC_PITCH, bearing: DIAMOND_BEARING })}
          title="all three axes foreshortened equally"
        >
          isometric
        </button>
        <button
          type="button"
          className="debug__button"
          onClick={() => setCamera({ pitch: DIMETRIC_PITCH, bearing: DIAMOND_BEARING })}
          title="the two-to-one every isometric game actually draws"
        >
          dimetric
        </button>
        <button
          type="button"
          className="debug__button"
          onClick={() => setCamera({ pitch: TRIMETRIC_PITCH, bearing: TRIMETRIC_BEARING })}
          title="no two axes alike, so a square of ground reads as a lopsided diamond"
        >
          trimetric
        </button>
      </div>
    </Section>
  );
}
