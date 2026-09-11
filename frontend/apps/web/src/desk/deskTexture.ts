/**
 * A placeholder grain for the desk: fractal noise stretched along one axis so it reads as a wooden
 * surface, drawn by the browser from an SVG rather than shipped as an image. The tile stitches, so it
 * repeats without a seam, and swapping it for a painted desk when there is one is a change to this line.
 */

/** The side of one repeat of the grain, in the SVG's own pixels; the desk scales it to the sheet. */
const GRAIN = 256;

// Rows are red, green, blue and alpha out; columns are red, green, blue, alpha and a constant in. Only the
// red channel of the noise is read, so the three outputs vary together and the result stays a brown.
const BROWNS = ['0.42 0 0 0 0.20', '0.28 0 0 0 0.12', '0.15 0 0 0 0.06', '0 0 0 0 1'].join('  ');

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${GRAIN}" height="${GRAIN}">` +
  '<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
  '<feTurbulence type="fractalNoise" baseFrequency="0.012 0.16" numOctaves="4" seed="11" stitchTiles="stitch"/>' +
  `<feColorMatrix type="matrix" values="${BROWNS}"/>` +
  '</filter>' +
  '<rect width="100%" height="100%" fill="#5c3f28"/>' +
  '<rect width="100%" height="100%" filter="url(#grain)"/>' +
  '</svg>';

/** The grain as a CSS background image. */
export const deskGrain = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
