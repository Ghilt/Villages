import { useEffect, useState, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { CAMERA } from '../map/mapConfig';
import { setTiltRamp } from '../map/tilt';
import { pullNow, watchPull } from '../room/pull';

import {
  STEEPEST_PARALLEL_PITCH,
  cameraNow,
  isPlayers,
  isSquareGround,
  lensOf,
  PLAYERS,
  setCamera,
  watchCamera,
} from '../map/camera';
import {
  DIAMOND_BEARING,
  DIAMOND_LATTICE_SIZE,
  DIAMOND_LATTICE_TURN,
  DIMETRIC_PITCH,
  ISOMETRIC_PITCH,
  TRIMETRIC_BEARING,
  TRIMETRIC_PITCH,
} from './cameraPresets';
import { Section } from './Section';

/**
 * Where the camera stands, and what the world looks like from there.
 *
 * **The lever of experiment 0008, not a part of the game.** Nothing here is reachable by anybody
 * playing. Every control starts at the player's camera: north-up on a diamond lattice, flat from zoom 7
 * out and tipped back forty-five degrees at the closest zoom, which is decision record 0060 as amended by
 * experiment 0011, and `player` puts it back there. Everything else is for looking at a world from another angle, which is answered by
 * looking and is why it is a slider and not a proposal. See decision record 0023.
 *
 * The terrain, the coast, the areas, the marks and the scenery all follow the camera, the marks and the
 * scenery standing upright on the ground as it tips. North-up, the desk and the room follow it too: a
 * tip north-up only squashes the height of what lies flat, and they are squashed with it. Turned, they
 * do not, because a turned desk is not a rectangle of CSS any more. The experiment record says so.
 *
 * There is no lever for how wide the camera sees: tipped it is always parallel, because the overlay is
 * only right for a parallel camera. See `lensOf`.
 */

interface CameraSectionProps {
  map: maplibregl.Map | null;
}

/**
 * The zoom, always, in the section's header whether it is open or folded, because the camera now tips by
 * the zoom and the number that says where it is on the ramp is the one worth a glance. In the room it is a
 * dash: the camera is pinned at its floor there and the pull, not the zoom, is what is moving.
 */
function ZoomReading({ map }: CameraSectionProps) {
  const [zoom, setZoom] = useState<number | null>(() => map?.getZoom() ?? null);
  const pull = useSyncExternalStore(watchPull, pullNow);
  useEffect(() => {
    if (map === null) {
      return;
    }
    const read = () => setZoom(map.getZoom());
    read();
    map.on('move', read);
    return () => {
      map.off('move', read);
    };
  }, [map]);
  const inTheRoom = pull.amount > 0 || pull.dive !== null;
  return (
    <span className="debug__quiet" title="the camera's zoom, or a dash in the room">
      {inTheRoom || zoom === null ? '–' : `z${zoom.toFixed(2)}`}
    </span>
  );
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
    // The tilt is the zoom's now, so the panel moves the ramp and not the camera, and then asks for a camera
    // update, which is what runs the ramp: MapLibre's hook tips the camera on every one. See experiment 0011.
    setTiltRamp({ from: how.tiltFrom, to: CAMERA.maxZoom, most: how.tilt });
    const lens = lensOf(how);
    if (map.getVerticalFieldOfView() !== lens) {
      map.setVerticalFieldOfView(lens);
    }
    map.jumpTo({ bearing: how.bearing });
    map.triggerRepaint();
  }, [map, how]);

  const players = isPlayers(how);
  const wide = (1 / Math.cos((how.tilt * Math.PI) / 180)).toFixed(2);

  const tools = (
    <button
      type="button"
      className={players ? 'debug__button debug__button--on' : 'debug__button'}
      onClick={() => setCamera(PLAYERS)}
      aria-pressed={players}
      title="put the camera back where a player has it: north-up, on diamonds, tipping as it comes in"
    >
      player
    </button>
  );

  return (
    <Section name="Camera" tools={tools} reading={<ZoomReading map={map} />} shutToStart>
      <label className="debug-map__label" htmlFor="camera-tilt">
        How far it tips at the closest zoom
      </label>
      <input
        id="camera-tilt"
        className="debug__slider"
        type="range"
        min={0}
        max={STEEPEST_PARALLEL_PITCH}
        step={0.5}
        value={how.tilt}
        onChange={(event) => setCamera({ tilt: Number(event.target.value) })}
      />
      <p className="debug-map__note">
        {how.tilt === 0
          ? 'Straight down at every zoom, a map rather than a world'
          : `${how.tilt.toFixed(1)} degrees at zoom ${CAMERA.maxZoom}, where a square of ground is drawn ${wide} times as wide as it is tall, seen parallel, with no horizon`}
        {how.tilt === STEEPEST_PARALLEL_PITCH &&
          '. This is as far as it tips: past here a parallel camera asks for no tiles and the screen goes one colour'}
      </p>

      <label className="debug-map__label" htmlFor="camera-tilt-from">
        Where it starts to tip
      </label>
      <input
        id="camera-tilt-from"
        className="debug__slider"
        type="range"
        min={3}
        max={CAMERA.maxZoom - 0.25}
        step={0.25}
        value={how.tiltFrom}
        onChange={(event) => setCamera({ tiltFrom: Number(event.target.value) })}
      />
      <p className="debug-map__note">
        {`Straight down from zoom ${how.tiltFrom.toFixed(2)} out, tipping up to the full tilt at zoom ${CAMERA.maxZoom}, eased at both ends`}
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
          ? 'One world unit, as wide as a master pixel: the finest the terrain goes, and what an area steps along'
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
          onClick={() => setCamera({ tilt: ISOMETRIC_PITCH, bearing: DIAMOND_BEARING })}
          title="all three axes foreshortened equally"
        >
          isometric
        </button>
        <button
          type="button"
          className="debug__button"
          onClick={() => setCamera({ tilt: DIMETRIC_PITCH, bearing: DIAMOND_BEARING })}
          title="the two-to-one every isometric game actually draws"
        >
          dimetric
        </button>
        <button
          type="button"
          className="debug__button"
          onClick={() => setCamera({ tilt: TRIMETRIC_PITCH, bearing: TRIMETRIC_BEARING })}
          title="no two axes alike, so a square of ground reads as a lopsided diamond"
        >
          trimetric
        </button>
      </div>
    </Section>
  );
}
