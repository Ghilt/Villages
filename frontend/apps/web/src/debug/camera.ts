import { CAMERA, lensFor } from '../map/mapConfig';
import { PLAYERS_TILT } from '../map/tilt';

import { note } from './log';

export { PARALLEL_FOV, WIDE_FOV } from '../map/mapConfig';

/**
 * Where the camera is standing: how far it tips as it comes in, from where, and which way is up.
 *
 * The same shape as `scenery.ts` and every other switch in the panel: a module with a set of listeners,
 * read through `useSyncExternalStore`. Adam's, not a player's. These all start at the player's camera,
 * `CAMERA` in `map/mapConfig.ts`: north-up on a diamond lattice, flat from zoom 7 out and tipped back 45
 * degrees at the closest zoom, eased between. See decision record 0058 and experiment 0011.
 *
 * How wide the camera sees is not a setting: it follows from whether the camera tips at all, `lensOf`. A camera with a wide
 * field of view stands close to what it looks at, so the far side of the window is further away than the
 * near side and the world converges to a horizon - a tilted map. Narrow the field of view and the camera
 * has to retreat to keep the same amount in frame, until at a fraction of a degree it is so far back that
 * near and far are the same distance and nothing converges at all. That is a parallel projection, and a
 * parallel projection of a tilted plane is what every isometric game has ever drawn. See experiment 0008.
 */

export interface CameraSettings {
  /**
   * How far the camera is tipped from straight down at the closest zoom, in degrees. It tips less the
   * further out it is, down to none at `tiltFrom`; see `tiltAt` in `map/tilt.ts`. A player's is 45.
   */
  tilt: number;
  /** The zoom at which the camera starts to tip as it comes in. Straight down from here out. A player's is 7. */
  tiltFrom: number;
  /** Which way is up, in degrees clockwise from north. Zero is north-up, which a player gets. */
  bearing: number;
  /**
   * How far the grid the ground's colour is decided on is turned from the world's own axes, in degrees.
   *
   * This is the other turn, and it is not the camera's. Turning the camera turns the world with it, so a
   * square of ground becomes a diamond and north stops pointing up. Turning the lattice instead leaves
   * the world exactly where it was - north up, every coastline where it was - and changes only the shape
   * of the cell the colour is read on. Forty-five degrees is diamonds on a map that is still a map.
   */
  latticeTurn: number;
  /** How wide one of those cells is, in world units, where one is a master pixel. */
  latticeSize: number;
}

/** How wide the camera sees for these settings: `lensFor` in `map/mapConfig.ts`, parallel if it tips at all. */
export function lensOf(how: Pick<CameraSettings, 'tilt'>): number {
  return lensFor(how.tilt);
}

/**
 * The angles worth pressing a button for.
 *
 * True isometric is the one where all three axes are foreshortened equally, and it falls at a tilt whose
 * cosine is one over root three. Dimetric is the one games actually draw, because at sixty degrees the
 * cosine is exactly a half and a square of ground is twice as wide as it is tall - which is a whole
 * number of pixels either way, and the reason every isometric tile ever cut is 2:1.
 */
export const ISOMETRIC_PITCH = (Math.acos(1 / Math.sqrt(3)) * 180) / Math.PI;
export const DIMETRIC_PITCH = 60;

/**
 * And the third of the family, which is every angle that is neither of the other two.
 *
 * The three names count how many of the three axes are foreshortened the same amount: all three for
 * isometric, two for dimetric, none for trimetric. On this map the turn is what decides it. At
 * forty-five degrees the two ground axes are the same length by symmetry, so a square of ground reads
 * as an even diamond; at any other turn they are different and it reads as a lopsided one, which is
 * the whole of what trimetric looks like.
 *
 * The turn is a starting point rather than a rule - there is no canonical trimetric, that being the
 * point of it - and it keeps the same tilt as dimetric so that the two buttons differ in one thing only.
 * The ratios come out clearly apart: the east axis drawn at 0.94, the north at 0.60, the upright at 0.87.
 *
 * The tilt is not free to choose anyway. Above sixty degrees at a parallel field of view the map draws
 * nothing at all - see `STEEPEST_PARALLEL_PITCH`.
 */
export const TRIMETRIC_PITCH = 60;
export const TRIMETRIC_BEARING = 22.5;

/** The turn that puts the compass between two screen axes, which is what makes a square read as a diamond. */
export const DIAMOND_BEARING = 45;

/**
 * How far the camera can tip before a parallel field of view stops drawing the world at all.
 *
 * Found by looking: at sixty degrees the terrain is there and at sixty-one the screen is one flat
 * colour, on every renderer. It is MapLibre's own default pitch ceiling, and that is not a coincidence.
 * How it decides which tiles a tilted view needs is tuned against a normal field of view - the exponent
 * it raises a cosine to is worked out from the field of view, and at a tenth of a degree that exponent
 * goes from about minus one to about thirty, so past sixty degrees it asks for no detail at all and the
 * whole screen is one stretched tile.
 *
 * Sixty is exactly the dimetric angle, so the whole of what this section is for fits underneath it. A
 * steeper tilt is still possible with a field of view wide enough to have a horizon; it is the pairing
 * of a steep tilt and a parallel camera that MapLibre will not draw. See experiment 0008.
 */
export const STEEPEST_PARALLEL_PITCH = 60;

/** The turn that makes a square cell a diamond, which is the same forty-five the camera uses. */
export const DIAMOND_LATTICE_TURN = 45;

/**
 * How big a diamond is when the button is pressed, in world units.
 *
 * Four, because one is a master pixel and a master pixel is eight screen pixels at the closest the
 * camera comes - a diamond that small reads as noise rather than as a tile. Four is a diamond about
 * forty-five pixels across at that zoom, which is the size an isometric game would cut one at.
 */
export const DIAMOND_LATTICE_SIZE = 4;

/** Where a player's camera is, which is where the panel starts and where its `player` button goes back to. */
export const PLAYERS: CameraSettings = {
  tilt: PLAYERS_TILT.most,
  tiltFrom: PLAYERS_TILT.from,
  bearing: CAMERA.bearing,
  latticeTurn: CAMERA.lattice.turn,
  latticeSize: CAMERA.lattice.size,
};

const START: CameraSettings = PLAYERS;

let settings: CameraSettings = { ...START };
const listeners = new Set<() => void>();

export function cameraNow(): CameraSettings {
  return settings;
}

export function watchCamera(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether this is the camera a player is shown, turn, tip and lattice alike. */
export function isPlayers(how: CameraSettings): boolean {
  return (
    how.tilt === PLAYERS.tilt &&
    how.tiltFrom === PLAYERS.tiltFrom &&
    how.bearing === PLAYERS.bearing &&
    how.latticeTurn === PLAYERS.latticeTurn &&
    how.latticeSize === PLAYERS.latticeSize
  );
}

/** Whether the ground is painted on the grid it is stored on, which is what it was before 0008. */
export function isSquareGround(how: CameraSettings): boolean {
  return how.latticeTurn === 0 && how.latticeSize === 1;
}

export function setCamera(change: Partial<CameraSettings>): void {
  const next = { ...settings, ...change };
  if (
    next.tilt === settings.tilt &&
    next.tiltFrom === settings.tiltFrom &&
    next.bearing === settings.bearing &&
    next.latticeTurn === settings.latticeTurn &&
    next.latticeSize === settings.latticeSize
  ) {
    return;
  }

  // Said as the thing that is seen rather than as the numbers behind it. See decision record 0023.
  if (isPlayers(next) && !isPlayers(settings)) {
    note('camera', 'back where a player has it');
  } else if (
    next.tilt !== settings.tilt ||
    next.tiltFrom !== settings.tiltFrom ||
    next.bearing !== settings.bearing
  ) {
    note(
      'camera',
      next.tilt === 0
        ? `straight down at every zoom, turned ${next.bearing.toFixed(0)}`
        : `flat from zoom ${next.tiltFrom.toFixed(2)} out, tipping to ${next.tilt.toFixed(1)} degrees at the ` +
            `closest zoom, turned ${next.bearing.toFixed(0)}, seen parallel`,
    );
  }

  if (next.latticeTurn !== settings.latticeTurn || next.latticeSize !== settings.latticeSize) {
    note(
      'camera',
      isSquareGround(next)
        ? 'the ground painted on the grid it is stored on, a cell to a master pixel'
        : `the ground painted on cells ${next.latticeSize} world units across, turned ${next.latticeTurn.toFixed(0)} degrees`,
    );
  }

  settings = next;
  for (const listener of listeners) {
    listener();
  }
}
