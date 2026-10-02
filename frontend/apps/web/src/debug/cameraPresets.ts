/*
 * The camera angles worth pressing a button for in the Camera section, and the diamond the lattice button
 * turns the ground to. The panel's, not the camera's: the camera and its settings are `map/camera.ts`.
 */

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
 * nothing at all - see `STEEPEST_PARALLEL_PITCH` in `map/camera.ts`.
 */
export const TRIMETRIC_PITCH = 60;
export const TRIMETRIC_BEARING = 22.5;

/** The turn that puts the compass between two screen axes, which is what makes a square read as a diamond. */
export const DIAMOND_BEARING = 45;

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
