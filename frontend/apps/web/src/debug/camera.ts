import { note } from './log';

/**
 * Where the camera is standing: how far it has tipped, which way is up, and how wide it sees.
 *
 * The same shape as `scenery.ts` and every other switch in the panel: a module with a set of listeners,
 * read through `useSyncExternalStore`. Adam's, not a player's. A player's map is flat and north-up and
 * these all start at the numbers that mean exactly that; see decision record 0014.
 *
 * The third number is the one that does the work, and it is the one nobody expects. A camera with a wide
 * field of view stands close to what it looks at, so the far side of the window is further away than the
 * near side and the world converges to a horizon - a tilted map. Narrow the field of view and the camera
 * has to retreat to keep the same amount in frame, until at a fraction of a degree it is so far back that
 * near and far are the same distance and nothing converges at all. That is a parallel projection, and a
 * parallel projection of a tilted plane is what every isometric game has ever drawn. See experiment 0008.
 */

export interface CameraSettings {
  /** How far the camera has tipped from straight down, in degrees. Zero is the flat map a player gets. */
  pitch: number;
  /** Which way is up, in degrees clockwise from north. Zero is north-up, which a player also gets. */
  bearing: number;
  /**
   * How wide the camera sees, in degrees. MapLibre's own default is the one below, and it clamps at a
   * tenth of a degree; a couple of degrees is already parallel to the eye and much kinder to the depth
   * buffer than the floor is, which is why the slider stops where it does rather than at the clamp.
   */
  fov: number;
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

/** MapLibre's own field of view, which is what a camera standing in the world looks like. */
export const WIDE_FOV = 36.86989764584402;

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

/** Below this the projection is parallel to the eye, and the note under the slider says so. */
export const PARALLEL_BELOW = 2;

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

const START: CameraSettings = {
  pitch: 0,
  bearing: 0,
  fov: WIDE_FOV,
  latticeTurn: 0,
  latticeSize: 1,
};

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

/** Whether this camera is flat and north-up, which is the only one a player is ever shown. */
export function isFlat(how: CameraSettings): boolean {
  return how.pitch === 0 && how.bearing === 0;
}

/** Whether the ground is painted on the grid it is stored on, which is what it was before 0008. */
export function isSquareGround(how: CameraSettings): boolean {
  return how.latticeTurn === 0 && how.latticeSize === 1;
}

export function setCamera(change: Partial<CameraSettings>): void {
  const next = { ...settings, ...change };
  if (
    next.pitch === settings.pitch &&
    next.bearing === settings.bearing &&
    next.fov === settings.fov &&
    next.latticeTurn === settings.latticeTurn &&
    next.latticeSize === settings.latticeSize
  ) {
    return;
  }

  // Said as the thing that is seen rather than as the three numbers behind it, because the three only
  // mean anything together: a tilt with a wide field of view is a different picture from the same tilt
  // without one. See decision record 0023.
  if (isFlat(next) && !isFlat(settings)) {
    note('camera', 'flat and north-up, the way a player gets it');
  } else if (next.pitch !== settings.pitch || next.bearing !== settings.bearing) {
    note(
      'camera',
      `tipped ${next.pitch.toFixed(1)} degrees, turned ${next.bearing.toFixed(0)}, ` +
        `so a square of ground is drawn ${(1 / Math.cos((next.pitch * Math.PI) / 180)).toFixed(2)} times ` +
        'as wide as it is tall',
    );
  }
  if (next.fov !== settings.fov) {
    note(
      'camera',
      next.fov <= PARALLEL_BELOW
        ? `seeing ${next.fov.toFixed(1)} degrees wide, which is parallel: no horizon, one scale everywhere`
        : `seeing ${next.fov.toFixed(1)} degrees wide, which is a camera standing in the world`,
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
